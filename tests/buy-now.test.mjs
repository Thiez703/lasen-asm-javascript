import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// dataService uses browser fetch to load the catalogue. Read the same JSON in Node.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = input instanceof URL ? input : new URL(input);
  if (url.protocol === 'file:') {
    return new Response(await readFile(url), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return originalFetch(input, options);
};

const { createBuyNowSource } = await import('../js/services/buyNowService.js');
const { cartService } = await import('../js/services/cartService.js');
const { products } = await import('../js/services/dataService.js');
const { renderCheckout } = await import('../js/render/checkout.js');
const { formatPrice } = await import('../js/utils/format.js');
const {
  processCheckout,
  generateCartFingerprint,
  ORDERS_KEY,
  COMPLETED_CHECKOUT_KEY,
  PENDING_CLEANUP_KEY
} = await import('../js/services/checkoutService.js');
globalThis.fetch = originalFetch;

const CART_KEY = 'lasen_cart';
const BUY_NOW_COMPLETED_KEY = `${COMPLETED_CHECKOUT_KEY}_buy_now`;
const selected = products.find(product => product.stock > 10 && product.salePrice > 0);
const other = products.find(product => product.id !== selected.id && product.stock > 5);
const regularCart = [
  { productId: selected.id, quantity: 8 },
  { productId: other.id, quantity: 3 }
];
const clone = value => structuredClone(value);

function setupStorage(seed = {}, failedKeys = []) {
  const data = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  const calls = [];
  const failures = new Set(failedKeys);
  const localStorage = {
    getItem(key) {
      calls.push({ operation: 'get', key });
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      calls.push({ operation: 'set', key });
      if (failures.has(key)) throw new Error('Simulated storage failure');
      data.set(key, String(value));
    },
    removeItem(key) {
      calls.push({ operation: 'remove', key });
      data.delete(key);
    }
  };

  globalThis.window = { localStorage, dispatchEvent() {} };
  globalThis.CustomEvent ??= class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  const storage = {
    get(key, fallback = null) {
      const value = localStorage.getItem(key);
      return value === null ? clone(fallback) : JSON.parse(value);
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      localStorage.removeItem(key);
      return true;
    }
  };
  return {
    storage,
    calls,
    peek(key) {
      return data.has(key) ? JSON.parse(data.get(key)) : null;
    }
  };
}

function checkoutInput(overrides = {}) {
  return {
    id: 'ORD-BUY-NOW',
    userId: null,
    idempotencyToken: 'buy-now-token',
    customer: { name: 'Khách mua ngay', phone: '0901234567', email: 'buyer@example.com' },
    shippingAddress: '123 Đường Hoa Sen, TP. Hồ Chí Minh',
    paymentMethod: 'COD',
    ...overrides
  };
}

function directDeps(state, source = createBuyNowSource(selected.id, 2)) {
  return {
    storage: state.storage,
    cartService: {
      ...source,
      clearCart() {
        assert.fail('Direct checkout must never clear a cart');
      }
    },
    preserveCart: true,
    completedKey: BUY_NOW_COMPLETED_KEY
  };
}

function pendingOrder(source) {
  const details = source.getCartDetails();
  return {
    id: 'ORD-EXISTING-PENDING',
    userId: null,
    idempotencyToken: 'previous-normal-checkout',
    pendingCartCleanup: true,
    cartFingerprint: generateCartFingerprint(details),
    customer: { name: 'Khách hàng cũ' },
    items: details.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.itemPrice,
      name: item.product.name
    })),
    totals: source.getCartTotals()
  };
}

function assertRegularStateUnchanged(state, marker, previousCompleted) {
  assert.deepEqual(state.peek(CART_KEY), regularCart);
  assert.deepEqual(state.peek(PENDING_CLEANUP_KEY), marker);
  assert.deepEqual(state.peek(COMPLETED_CHECKOUT_KEY), previousCompleted);
  assert.deepEqual(
    state.calls.filter(call => [CART_KEY, PENDING_CLEANUP_KEY, COMPLETED_CHECKOUT_KEY].includes(call.key)),
    [],
    'Direct checkout must neither read nor mutate regular checkout state'
  );
}

test('buy-now uses only the selected quantity and catalogue price, independent of the regular cart', () => {
  const state = setupStorage({ [CART_KEY]: regularCart });
  const source = createBuyNowSource(selected.id, 2);
  const price = selected.salePrice;
  const subtotal = price * 2;
  const shipping = subtotal >= 500000 ? 0 : 30000;

  assert.deepEqual(source.getRawCart(), [{ productId: selected.id, quantity: 2 }]);
  const details = source.getCartDetails();
  assert.equal(details.length, 1);
  assert.equal(details[0].product, selected);
  assert.equal(details[0].quantity, 2);
  assert.equal(details[0].itemPrice, price);
  assert.equal(details[0].lineTotal, subtotal);
  assert.deepEqual(source.getCartTotals(), {
    itemCount: 1,
    totalQuantity: 2,
    subtotal,
    shipping,
    total: subtotal + shipping,
    isEmpty: false
  });
  assert.deepEqual(createBuyNowSource(selected.id, selected.stock + 10).getRawCart(), [
    { productId: selected.id, quantity: selected.stock }
  ]);
  assert.deepEqual(state.peek(CART_KEY), regularCart);
  assert.deepEqual(state.calls, []);
});

for (const withMarker of [true, false]) {
  test(`direct order ignores same-fingerprint pending recovery ${withMarker ? 'with' : 'without'} a marker and is idempotent`, () => {
    const source = createBuyNowSource(selected.id, 2);
    const existingOrder = pendingOrder(source);
    const marker = withMarker ? {
      orderId: existingOrder.id,
      fingerprint: existingOrder.cartFingerprint,
      timestamp: Date.now()
    } : null;
    const previousCompleted = { ...existingOrder, id: 'ORD-NORMAL-COMPLETED' };
    const state = setupStorage({
      [CART_KEY]: regularCart,
      [ORDERS_KEY]: [existingOrder],
      [PENDING_CLEANUP_KEY]: marker,
      [COMPLETED_CHECKOUT_KEY]: previousCompleted
    });
    const deps = directDeps(state, source);
    const input = checkoutInput();
    const result = processCheckout(input, deps);

    assert.equal(result.success, true);
    assert.equal(result.alreadyProcessed, undefined);
    assert.equal(result.order.id, input.id);
    assert.equal(result.order.userId, null, 'Guest orders must not become demo-account orders');
    assert.equal(result.order.pendingCartCleanup, false);
    assert.equal(result.warning, undefined);
    assert.deepEqual(result.order.items.map(item => ({ productId: item.productId, quantity: item.quantity })), [
      { productId: selected.id, quantity: 2 }
    ]);
    assert.equal(result.order.items[0].price, selected.salePrice);
    assert.equal(result.order.totals.total, source.getCartTotals().total);
    assert.equal(state.peek(ORDERS_KEY).length, 2);
    assert.equal(state.peek(ORDERS_KEY)[1].pendingCartCleanup, true);
    assert.equal(state.peek(BUY_NOW_COMPLETED_KEY).id, input.id);
    assertRegularStateUnchanged(state, marker, previousCompleted);

    const repeated = processCheckout(input, deps);
    assert.equal(repeated.success, true);
    assert.equal(repeated.alreadyProcessed, true);
    assert.equal(repeated.order.id, result.order.id);
    assert.equal(repeated.order.userId, null);
    assert.equal(state.peek(ORDERS_KEY).length, 2);
    assertRegularStateUnchanged(state, marker, previousCompleted);
  });
}

test('failed direct-order storage preserves the regular cart, pending recovery and completion metadata', () => {
  const source = createBuyNowSource(selected.id, 2);
  const existingOrder = pendingOrder(source);
  const marker = {
    orderId: existingOrder.id,
    fingerprint: existingOrder.cartFingerprint,
    timestamp: Date.now()
  };
  const previousCompleted = { ...existingOrder, id: 'ORD-NORMAL-COMPLETED' };
  const state = setupStorage({
    [CART_KEY]: regularCart,
    [ORDERS_KEY]: [existingOrder],
    [PENDING_CLEANUP_KEY]: marker,
    [COMPLETED_CHECKOUT_KEY]: previousCompleted
  }, [ORDERS_KEY]);

  const result = processCheckout(checkoutInput(), directDeps(state, source));

  assert.equal(result.success, false);
  assert.equal(result.error, 'ORDER_WRITE_FAILED');
  assert.deepEqual(state.peek(ORDERS_KEY), [existingOrder]);
  assert.equal(state.peek(BUY_NOW_COMPLETED_KEY), null);
  assert.deepEqual(source.getRawCart(), [{ productId: selected.id, quantity: 2 }]);
  assertRegularStateUnchanged(state, marker, previousCompleted);
  assert.deepEqual(state.calls.filter(call => call.operation !== 'get'), [
    { operation: 'set', key: ORDERS_KEY }
  ]);
});

test('invalid or unavailable buy-now selections cannot fall back to the regular cart', async t => {
  const cases = [
    ['unknown product', 'missing-product', 2],
    ['missing product', undefined, 2],
    ['zero quantity', selected.id, 0],
    ['negative quantity', selected.id, -1],
    ['fractional quantity', selected.id, 1.5],
    ['invalid quantity', selected.id, 'abc'],
    ['missing quantity', selected.id, undefined]
  ];

  for (const [name, productId, quantity] of cases) {
    await t.test(name, () => {
      const state = setupStorage({ [CART_KEY]: regularCart });
      const source = createBuyNowSource(productId, quantity);
      assert.deepEqual(source.getRawCart(), []);
      assert.equal(source.getCartTotals().isEmpty, true);
      const result = processCheckout(checkoutInput(), directDeps(state, source));
      assert.equal(result.success, false);
      assert.equal(result.error, 'EMPTY_CART');
      assert.deepEqual(state.peek(CART_KEY), regularCart);
      assert.equal(state.peek(ORDERS_KEY), null);
      assert.deepEqual(state.calls.filter(call => call.operation !== 'get'), []);
      assert.equal(state.calls.some(call => call.key === CART_KEY), false);
    });
  }

  await t.test('out of stock', () => {
    const state = setupStorage({ [CART_KEY]: regularCart });
    const stock = selected.stock;
    try {
      selected.stock = 0;
      const source = createBuyNowSource(selected.id, 2);
      assert.deepEqual(source.getRawCart(), []);
      const result = processCheckout(checkoutInput(), directDeps(state, source));
      assert.equal(result.success, false);
      assert.equal(result.error, 'EMPTY_CART');
      assert.deepEqual(state.peek(CART_KEY), regularCart);
      assert.equal(state.peek(ORDERS_KEY), null);
      assert.deepEqual(state.calls.filter(call => call.operation !== 'get'), []);
    } finally {
      selected.stock = stock;
    }
  });
});

test('normal checkout still purchases and clears the entire regular cart', () => {
  const state = setupStorage({ [CART_KEY]: regularCart });
  const totals = cartService.getCartTotals();
  const result = processCheckout(checkoutInput({
    id: 'ORD-NORMAL',
    userId: 1,
    idempotencyToken: 'normal-token'
  }), { storage: state.storage, cartService });

  assert.equal(result.success, true);
  assert.equal(result.clearedCart, true);
  assert.deepEqual(result.order.items.map(item => ({ productId: item.productId, quantity: item.quantity })), regularCart);
  assert.equal(result.order.totals.total, totals.total);
  assert.deepEqual(state.peek(CART_KEY), []);
  assert.equal(state.peek(ORDERS_KEY).length, 1);
  assert.equal(state.peek(COMPLETED_CHECKOUT_KEY).id, 'ORD-NORMAL');
  assert.equal(state.peek(PENDING_CLEANUP_KEY), null);
  assert.equal(state.peek(BUY_NOW_COMPLETED_KEY), null);
});

// Minimal DOM surface used by checkout: capture markup and invoke the real submit handler.
function setupCheckoutDom(search) {
  const element = () => ({
    innerHTML: '',
    textContent: '',
    style: {},
    offsetTop: 100,
    listeners: new Map(),
    addEventListener(name, callback) { this.listeners.set(name, callback); },
    appendChild() {}
  });
  const fields = Object.fromEntries(Object.entries({
    hoTen: 'Khách mua ngay',
    soDienThoai: '0901234567',
    email: 'buyer@example.com',
    tinhThanh: 'ho-chi-minh',
    quanHuyen: 'q1',
    diaChi: '123 Đường Hoa Sen',
    ghiChu: ''
  }).map(([name, value]) => [`[data-input="${name}"]`, { value }]));
  fields['[data-input="dongY"]'] = { checked: true };
  fields['input[name="thanhToan"]:checked'] = { value: 'cod' };
  const form = Object.assign(element(), {
    querySelector: selector => fields[selector] ?? null,
    querySelectorAll: () => []
  });
  const nodes = new Map([
    ['[data-checkout-form]', form],
    ['.checkout', element()],
    ['[data-list="order"]', element()],
    ['.checkout__aside [data-cart-count-items]', element()],
    ['.checkout__aside [data-cart-total]', element()],
    ['.toast-stack[data-toast]', element()]
  ]);
  const created = [];
  globalThis.document = {
    querySelector: selector => nodes.get(selector) ?? null,
    createElement() {
      const node = element();
      created.push(node);
      return node;
    }
  };
  Object.assign(window, {
    location: { search },
    addEventListener() {},
    scrollTo() {}
  });
  return {
    form,
    node: selector => nodes.get(selector),
    submit() {
      try {
        form.listeners.get('submit')({ preventDefault() {} });
      } finally {
        // Dismiss toast immediately so its UI timer does not keep the Node test alive.
        created.forEach(node => node.listeners.get('click')?.());
      }
    }
  };
}

test('checkout renderer displays and submits only the buy-now item and reloads its completed order', async () => {
  const source = createBuyNowSource(selected.id, 2);
  const existingOrder = pendingOrder(source);
  const marker = {
    orderId: existingOrder.id,
    fingerprint: existingOrder.cartFingerprint,
    timestamp: Date.now()
  };
  const previousCompleted = { ...existingOrder, id: 'ORD-NORMAL-COMPLETED' };
  const state = setupStorage({
    [CART_KEY]: regularCart,
    [ORDERS_KEY]: [existingOrder],
    [PENDING_CLEANUP_KEY]: marker,
    [COMPLETED_CHECKOUT_KEY]: previousCompleted
  });
  const search = `?buyNow=${selected.id}&quantity=2&token=buy_123_test`;
  const dom = setupCheckoutDom(search);

  await renderCheckout();

  const summary = dom.node('[data-list="order"]').innerHTML;
  assert.match(summary, new RegExp(`data-id="${selected.id}"`));
  assert.doesNotMatch(summary, new RegExp(`data-id="${other.id}"`));
  assert.equal(dom.node('.checkout__aside [data-cart-count-items]').textContent, 2);
  assert.equal(dom.node('.checkout__aside [data-cart-total]').textContent, formatPrice(source.getCartTotals().total));
  assertRegularStateUnchanged(state, marker, previousCompleted);

  dom.submit();

  const [order] = state.peek(ORDERS_KEY);
  assert.equal(state.peek(ORDERS_KEY).length, 2);
  assert.equal(order.idempotencyToken, 'buy_123_test');
  assert.equal(order.userId, null);
  assert.deepEqual(order.items.map(item => ({ productId: item.productId, quantity: item.quantity })), [
    { productId: selected.id, quantity: 2 }
  ]);
  assert.equal(order.totals.total, source.getCartTotals().total);
  assert.equal(state.peek(BUY_NOW_COMPLETED_KEY).id, order.id);
  assert.match(dom.node('.checkout').innerHTML, /Đặt hàng thành công!/);
  assertRegularStateUnchanged(state, marker, previousCompleted);

  const reloaded = setupCheckoutDom(search);
  await renderCheckout();
  assert.match(reloaded.node('.checkout').innerHTML, /Đặt hàng thành công!/);
  assert.ok(reloaded.node('.checkout').innerHTML.includes(order.id));
  assert.equal(reloaded.form.listeners.has('submit'), false);
  assert.equal(state.peek(ORDERS_KEY).length, 2);
  assertRegularStateUnchanged(state, marker, previousCompleted);
});

test('invalid buy-now URLs display an error without using the populated regular cart', async () => {
  for (const search of [
    '?buyNow=missing&quantity=2&token=buy_123_test',
    `?buyNow=${selected.id}&quantity=0&token=buy_123_test`,
    `?buyNow=${selected.id}&quantity=2&token=invalid`
  ]) {
    const state = setupStorage({ [CART_KEY]: regularCart });
    const dom = setupCheckoutDom(search);
    await renderCheckout();
    assert.match(dom.node('.checkout').innerHTML, /Không thể mua ngay sản phẩm này/);
    assert.equal(dom.node('[data-list="order"]').innerHTML, '');
    assert.equal(dom.form.listeners.has('submit'), false);
    assert.deepEqual(state.peek(CART_KEY), regularCart);
    assert.equal(state.peek(ORDERS_KEY), null);
    assert.deepEqual(state.calls.filter(call => call.operation !== 'get'), []);
    assert.equal(state.calls.some(call => call.key === CART_KEY), false);
  }
});
