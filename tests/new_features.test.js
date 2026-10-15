import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { categories } from '../js/services/dataService.js';
import { loadSampleOrders } from '../js/services/orderService.js';
import { cartService } from '../js/services/cartService.js';
import { processCheckout, PENDING_CLEANUP_KEY, validatePendingCleanupMarker, MAX_PENDING_CLEANUP_AGE } from '../js/services/checkoutService.js';
import { initCheckoutFormSubmit } from '../js/render/checkout.js';
import { storage } from '../js/services/storage.js';
import { normalizeOrderStatus, loadOrderStatuses, PROFILE_KEY } from '../js/render/profile.js';
import { validation } from '../js/modules/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Mock localStorage cho môi trường kiểm thử
const memoryStore = new Map();
globalThis.window = {
  localStorage: {
    getItem(key) { return memoryStore.has(key) ? memoryStore.get(key) : null; },
    setItem(key, val) { memoryStore.set(key, String(val)); },
    removeItem(key) { memoryStore.delete(key); },
    clear() { memoryStore.clear(); }
  },
  dispatchEvent() {}
};
globalThis.CustomEvent = class CustomEvent {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts?.detail;
  }
};

test('16. IDEMPOTENCY & REPEAT CHECKOUT (R2 FIX)', async (t) => {
  await t.test('LEGITIMATE REPEAT ORDER: mua lại cùng sản phẩm với token mới phải tạo đơn mới thành công', () => {
    memoryStore.clear();

    // Đơn 1: Mua sản phẩm p1 (165k)
    cartService.clearCart();
    cartService.addToCart('p1', 1);
    const tokenA = 'tok_first_order_111';
    const resA = processCheckout({
      idempotencyToken: tokenA,
      customer: { name: 'Khách A', phone: '0901111222', email: 'a@gmail.com' },
      shippingAddress: 'Cần Thơ'
    });

    assert.strictEqual(resA.success, true);
    assert.strictEqual(resA.clearedCart, true);
    const orderIdA = resA.order.id;

    const ordersDbAfterA = storage.get('lasen_orders', []);
    assert.strictEqual(ordersDbAfterA.length, 1);

    // Người dùng tiếp tục mua lại đúng sản phẩm p1 đó (cùng fingerprint lịch sử) với token mới
    cartService.addToCart('p1', 1);
    const tokenB = 'tok_repeat_order_222';
    const resB = processCheckout({
      idempotencyToken: tokenB,
      customer: { name: 'Khách A', phone: '0901111222', email: 'a@gmail.com' },
      shippingAddress: 'Cần Thơ'
    });

    assert.strictEqual(resB.success, true);
    assert.notStrictEqual(resB.alreadyProcessed, true, 'Đơn mới không được đánh dấu alreadyProcessed');
    assert.notStrictEqual(resB.order.id, orderIdA, 'Đơn lặp lại hợp lệ phải sinh mã đơn mới');

    const ordersDbAfterB = storage.get('lasen_orders', []);
    assert.strictEqual(ordersDbAfterB.length, 2, 'Tổng số đơn hàng phải là 2 đơn');
  });

  await t.test('REVIEWER EVIDENCE CASE: storage có sẵn đơn cũ ORD-OLD với fingerprint và token mới không bị trả ORD-OLD', () => {
    memoryStore.clear();

    // Giả lập đơn hàng cũ đã hoàn tất từ phiên trước nằm trong storage
    const oldOrder = {
      id: 'ORD-OLD',
      userId: 1,
      idempotencyToken: 'tok_old_session',
      cartFingerprint: 'p1:1:165000',
      date: '2026-09-01T10:00:00Z',
      status: 'Đã giao hàng',
      customer: { name: 'Người dùng cũ', phone: '0901111222', email: 'cu@gmail.com' },
      shippingAddress: 'Cần Thơ',
      paymentMethod: 'COD',
      items: [{ productId: 'p1', name: 'Sản phẩm 1', price: 165000, quantity: 1 }],
      totals: { subtotal: 165000, shipping: 30000, total: 195000 }
    };
    storage.set('lasen_orders', [oldOrder]);
    storage.set('lasen_last_completed_order', oldOrder);

    // Khách hàng hiện tại thêm lại sản phẩm p1:1 vào giỏ
    cartService.clearCart();
    cartService.addToCart('p1', 1);

    // Tiến hành thanh toán với token mới của phiên hiện tại
    const tokenNew = 'tok_new_session_999';
    const res = processCheckout({
      idempotencyToken: tokenNew,
      customer: { name: 'Khách mới', phone: '0909999888', email: 'moi@gmail.com' },
      shippingAddress: '128 Trần Hưng Đạo, Cần Thơ',
      paymentMethod: 'COD'
    });

    assert.strictEqual(res.success, true);
    assert.notStrictEqual(res.alreadyProcessed, true, 'Không được nhận diện nhầm là alreadyProcessed');
    assert.notStrictEqual(res.order.id, 'ORD-OLD', 'Mã đơn phải là đơn mới, không được là ORD-OLD');

    const ordersDb = storage.get('lasen_orders', []);
    assert.strictEqual(ordersDb.length, 2, 'Số lượng đơn hàng phải tăng từ 1 lên 2');
    assert.strictEqual(ordersDb[0].id, res.order.id);
    assert.strictEqual(ordersDb[1].id, 'ORD-OLD');
  });

  await t.test('DOUBLE SUBMIT: cùng một idempotencyToken không nhân bản đơn hàng', () => {
    memoryStore.clear();
    cartService.clearCart();
    cartService.addToCart('p2', 1);

    const token = 'tok_double_submit_test';
    const res1 = processCheckout({
      idempotencyToken: token,
      customer: { name: 'Khách B', phone: '0903333444', email: 'b@gmail.com' },
      shippingAddress: 'Cần Thơ'
    });
    assert.strictEqual(res1.success, true);

    // Gửi lại đúng token đó
    const res2 = processCheckout({
      idempotencyToken: token,
      customer: { name: 'Khách B', phone: '0903333444', email: 'b@gmail.com' },
      shippingAddress: 'Cần Thơ'
    });
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.alreadyProcessed, true);
    assert.strictEqual(res2.order.id, res1.order.id);

    const ordersDb = storage.get('lasen_orders', []);
    assert.strictEqual(ordersDb.length, 1, 'Không nhân bản đơn hàng');
  });

  await t.test('PENDING CLEANUP RECOVERY: scoped phiên khi clearCart fail và reload với token mới', () => {
    memoryStore.clear();

    let clearFail = true;
    const mockCartService = {
      getCartDetails: () => cartService.getCartDetails(),
      getCartTotals: () => cartService.getCartTotals(),
      clearCart: () => {
        if (clearFail) return false;
        return cartService.clearCart();
      }
    };

    cartService.clearCart();
    cartService.addToCart('p3', 1);

    const tokenInitial = 'tok_clear_fail_scoped';
    const res1 = processCheckout(
      {
        idempotencyToken: tokenInitial,
        customer: { name: 'Khách C', phone: '0905555666', email: 'c@gmail.com' },
        shippingAddress: 'Cần Thơ'
      },
      { cartService: mockCartService }
    );

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.clearedCart, false);
    assert.ok(res1.warning);

    // Kiểm tra pending marker đã được ghi
    const marker = storage.get(PENDING_CLEANUP_KEY);
    assert.ok(marker, 'Phải có marker pending cleanup');
    assert.strictEqual(marker.orderId, res1.order.id);

    // Lần 2: Giả lập reload trang với token mới, dọn giỏ thành công
    clearFail = false;
    const tokenReloaded = 'tok_new_reloaded_scoped';
    const res2 = processCheckout(
      {
        idempotencyToken: tokenReloaded,
        customer: { name: 'Khách C', phone: '0905555666', email: 'c@gmail.com' },
        shippingAddress: 'Cần Thơ'
      },
      { cartService: mockCartService }
    );

    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.alreadyProcessed, true);
    assert.strictEqual(res2.order.id, res1.order.id);

    // Marker pending cleanup phải được giải phóng
    assert.strictEqual(storage.get(PENDING_CLEANUP_KEY), null);
  });
});

test('17. ORDER STATUS FILTER & JSON METADATA (R3 FIX)', async (t) => {
  await t.test('File js/data/order-statuses.json tồn tại và có đủ 5 trạng thái', () => {
    const jsonPath = path.join(projectRoot, 'js', 'data', 'order-statuses.json');
    assert.ok(fs.existsSync(jsonPath), 'js/data/order-statuses.json phải tồn tại');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.strictEqual(data.length, 5);
    const keys = data.map(d => d.key);
    assert.deepStrictEqual(keys, ['tat-ca', 'cho-xac-nhan', 'dang-giao', 'da-giao', 'da-huy']);
  });

  await t.test('profile.html không còn các thẻ chip filter hardcode', () => {
    const profileHtml = fs.readFileSync(path.join(projectRoot, 'profile.html'), 'utf8');
    assert.strictEqual(profileHtml.includes('data-order-filter="tat-ca"'), false, 'Không được hardcode chip trong HTML');
    assert.ok(profileHtml.includes('data-order-filters'), 'Phải có container [data-order-filters] để JS render động');
  });

  await t.test('loadOrderStatuses nạp đúng dữ liệu từ file JSON thật', async () => {
    const statuses = await loadOrderStatuses();
    assert.ok(Array.isArray(statuses));
    assert.strictEqual(statuses.length, 5);
    assert.strictEqual(statuses[0].key, 'tat-ca');
    assert.strictEqual(statuses[1].key, 'cho-xac-nhan');
    assert.strictEqual(statuses[2].key, 'dang-giao');
    assert.strictEqual(statuses[3].key, 'da-giao');
    assert.strictEqual(statuses[4].key, 'da-huy');
  });

  await t.test('normalizeOrderStatus chuẩn hóa đúng các biến thể chuỗi tiếng Việt và slug', () => {
    assert.strictEqual(normalizeOrderStatus('Chờ xác nhận').key, 'cho-xac-nhan');
    assert.strictEqual(normalizeOrderStatus('cho-xac-nhan').key, 'cho-xac-nhan');
    assert.strictEqual(normalizeOrderStatus('Đang vận chuyển').key, 'dang-giao');
    assert.strictEqual(normalizeOrderStatus('dang-giao').key, 'dang-giao');
    assert.strictEqual(normalizeOrderStatus('Đã giao hàng').key, 'da-giao');
    assert.strictEqual(normalizeOrderStatus('da-giao').key, 'da-giao');
    assert.strictEqual(normalizeOrderStatus('Đã huỷ').key, 'da-huy');
    assert.strictEqual(normalizeOrderStatus('da-huy').key, 'da-huy');
    assert.strictEqual(normalizeOrderStatus('Trạng thái lạ').key, 'khac');
  });
});

test('18. SAMPLE ORDERS JSON & USER ORDER DISTINCTION (R4 FIX)', async (t) => {
  await t.test('File js/data/sample-orders.json tồn tại, đúng JSON và mọi đơn đều có flag isDemo: true', () => {
    const jsonPath = path.join(projectRoot, 'js', 'data', 'sample-orders.json');
    assert.ok(fs.existsSync(jsonPath), 'js/data/sample-orders.json phải tồn tại');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.ok(Array.isArray(data) && data.length >= 4);
    for (const order of data) {
      assert.strictEqual(order.isDemo, true, `Đơn ${order.id} phải có cờ isDemo: true`);
      assert.ok(order.id.startsWith('DEMO-') || order.id.includes('DEMO'));
    }
  });

  await t.test('loadSampleOrders đọc dữ liệu từ js/data/sample-orders.json', async () => {
    const samples = await loadSampleOrders();
    assert.ok(Array.isArray(samples));
    assert.ok(samples.length >= 4);
    const statuses = new Set(samples.map(s => normalizeOrderStatus(s.status).key));
    assert.ok(statuses.has('cho-xac-nhan'));
    assert.ok(statuses.has('dang-giao'));
    assert.ok(statuses.has('da-giao'));
    assert.ok(statuses.has('da-huy'));
  });

  await t.test('Ưu tiên hiển thị: khi user có đơn thật trong storage, không merge đơn mẫu', () => {
    memoryStore.clear();

    const realUserOrder = {
      id: 'ORD-REAL-123',
      userId: 1,
      date: '2026-10-12T09:00:00Z',
      status: 'Chờ xác nhận',
      customer: { name: 'Lan', phone: '0912345678', email: 'lan@gmail.com' },
      items: [{ productId: 'p1', name: 'Sản phẩm', price: 165000, quantity: 1 }],
      totals: { subtotal: 165000, shipping: 30000, total: 195000 }
    };
    storage.set('lasen_orders', [realUserOrder]);

    const rawLocal = storage.get('lasen_orders', []);
    assert.strictEqual(rawLocal.length, 1);
    assert.strictEqual(rawLocal[0].id, 'ORD-REAL-123');
    assert.strictEqual(Boolean(rawLocal[0].isDemo), false, 'Đơn thực tế không được mang nhãn demo');
  });
});

test('19. PROFILE PERSISTENCE & VALIDATION', async (t) => {
  await t.test('PROFILE_KEY lưu và đọc dữ liệu hồ sơ chuẩn', () => {
    memoryStore.clear();
    const testProfile = {
      name: 'Nguyễn Thị Hoa',
      phone: '0988123456',
      email: 'hoa.nguyen@email.com',
      skin: 'da-dau'
    };
    storage.set(PROFILE_KEY, testProfile);
    const loaded = storage.get(PROFILE_KEY);
    assert.deepStrictEqual(loaded, testProfile);
  });

  await t.test('Validation helpers bảo vệ dữ liệu hồ sơ', () => {
    assert.strictEqual(validation.isRequired('Nguyễn Văn A') && 'Nguyễn Văn A'.length >= 2, true);
    assert.strictEqual(validation.isRequired(''), false);
    assert.strictEqual(validation.isValidPhone('0912345678'), true);
    assert.strictEqual(validation.isValidPhone('123'), false);
    assert.strictEqual(validation.isValidEmail('test@domain.com'), true);
    assert.strictEqual(validation.isValidEmail('sai-email'), false);
  });
});

test('20. AUDIT CHECKS: COMPARE REMOVAL, HOMEPAGE WHITELIST & LOGIN LINKS', async (t) => {
  const htmlFiles = [
    'index.html',
    'about.html',
    'cart.html',
    'checkout.html',
    'contact.html',
    'product-detail.html',
    'products.html',
    'profile.html'
  ];

  await t.test('Không còn bất kỳ liên kết compare.html hay nút data-compare-add nào', () => {
    for (const file of htmlFiles) {
      const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
      assert.strictEqual(content.includes('compare.html'), false, `${file} không được chứa compare.html`);
      assert.strictEqual(content.includes('data-compare-add'), false, `${file} không được chứa data-compare-add`);
    }
  });

  await t.test('Không còn liên kết login.html trong các file HTML (đã trỏ profile.html)', () => {
    for (const file of htmlFiles) {
      const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
      assert.strictEqual(content.includes('href="login.html"'), false, `${file} không được trỏ về login.html`);
    }
  });

  await t.test('Liên kết bộ lọc trang chủ dùng danh mục hợp lệ', () => {
    const indexContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    assert.strictEqual(indexContent.includes('cat=xit-khoang'), false, 'index.html không được chứa cat=xit-khoang');

    // Mọi category slug tham chiếu trong index.html phải thuộc categories.json
    const catMatches = [...indexContent.matchAll(/products\.html\?cat=([a-z0-9-]+)/g)].map(m => m[1]);
    assert.ok(catMatches.length > 0);
    const validCatSlugs = new Set(categories.map(c => c.slug));
    for (const slug of catMatches) {
      assert.ok(validCatSlugs.has(slug), `Category slug ${slug} phải có trong categories.json`);
    }

    assert.doesNotMatch(indexContent, /products\.html\?[^"']*(?:brand|skin|sale)=/);
  });

  await t.test('products.html chỉ có bộ lọc loại sản phẩm và giá, giữ công cụ xem danh sách', () => {
    const productsHtml = fs.readFileSync(path.join(projectRoot, 'products.html'), 'utf8');
    const filterTypes = [...productsHtml.matchAll(/data-filter="([^"]+)"/g)].map(m => m[1]);
    assert.strictEqual(filterTypes.length, categories.length);
    assert.deepStrictEqual([...new Set(filterTypes)], ['category']);
    for (const control of [
      'data-price-min', 'data-price-max', 'data-price-apply', 'data-search',
      'data-sort', 'data-pagination', 'data-filters-open', 'data-filters-close'
    ]) {
      assert.ok(productsHtml.includes(control), `products.html phải giữ ${control}`);
    }
  });
});

test('21. BOUNDED RECOVERY & MARKER INVALIDATION (C2-R3 FIX)', async (t) => {
  const currentFingerprint = 'p1:1:165000';
  const orderList = [
    {
      id: 'ORD-PENDING-1',
      cartFingerprint: currentFingerprint,
      pendingCartCleanup: true
    },
    {
      id: 'ORD-COMPLETED-2',
      cartFingerprint: currentFingerprint,
      pendingCartCleanup: false
    }
  ];

  await t.test('Marker quá 15 phút (Expired) phải bị từ chối và giải phóng', () => {
    const expiredTimestamp = Date.now() - (MAX_PENDING_CLEANUP_AGE + 5000);
    const expiredMarker = {
      orderId: 'ORD-PENDING-1',
      fingerprint: currentFingerprint,
      timestamp: expiredTimestamp
    };
    const res = validatePendingCleanupMarker(expiredMarker, currentFingerprint, orderList);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.reason, 'EXPIRED_MARKER');
  });

  await t.test('Marker có orderId không tồn tại trong danh sách đơn phải bị từ chối, không fallback lastOrder', () => {
    const fakeMarker = {
      orderId: 'ORD-NON-EXISTENT',
      fingerprint: currentFingerprint,
      timestamp: Date.now()
    };
    const res = validatePendingCleanupMarker(fakeMarker, currentFingerprint, orderList);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.reason, 'ORDER_NOT_FOUND');
    assert.strictEqual(res.order, null);
  });

  await t.test('Marker trỏ tới đơn đã hoàn tất không có cờ pendingCartCleanup phải bị từ chối', () => {
    const completedMarker = {
      orderId: 'ORD-COMPLETED-2',
      fingerprint: currentFingerprint,
      timestamp: Date.now()
    };
    const res = validatePendingCleanupMarker(completedMarker, currentFingerprint, orderList);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.reason, 'NOT_PENDING_CLEANUP');
  });

  await t.test('Marker hợp lệ trong vòng 15 phút, đúng orderId có cờ pendingCartCleanup được chấp nhận', () => {
    const validMarker = {
      orderId: 'ORD-PENDING-1',
      fingerprint: currentFingerprint,
      timestamp: Date.now() - 5000
    };
    const res = validatePendingCleanupMarker(validMarker, currentFingerprint, orderList);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.order.id, 'ORD-PENDING-1');
  });

  await t.test('Khi người dùng chủ động sửa giỏ hàng (saveCart/updateQuantity), marker pending cleanup bị xóa', () => {
    memoryStore.clear();
    storage.set(PENDING_CLEANUP_KEY, {
      orderId: 'ORD-TEST',
      fingerprint: currentFingerprint,
      timestamp: Date.now()
    });
    assert.ok(storage.get(PENDING_CLEANUP_KEY));

    // Người dùng thay đổi giỏ hàng
    cartService.clearCart();
    cartService.addToCart('p1', 1);

    // Marker phải bị xóa để không chặn hành vi mua sắm mới
    assert.strictEqual(storage.get(PENDING_CLEANUP_KEY), null);
  });
});

test('24. BEHAVIORAL REGRESSION: CHECKOUT VALIDATION & DOUBLE SUBMIT GUARD', async (t) => {
  memoryStore.clear();
  cartService.clearCart();
  cartService.addToCart('p1', 1);

  // Tạo DOM form stub và elements stub
  let submitDisabled = false;
  let submitText = 'Đặt hàng';

  const mockSubmitBtn = {
    get disabled() { return submitDisabled; },
    set disabled(v) { submitDisabled = v; },
    get textContent() { return submitText; },
    set textContent(v) { submitText = v; }
  };

  const createFieldStub = (initialValue, isCheckbox = false) => ({
    value: isCheckbox ? '' : initialValue,
    checked: isCheckbox ? Boolean(initialValue) : false,
    classList: { remove() {}, add() {} },
    removeAttribute() {},
    setAttribute() {},
    focus() {},
    closest() { return null; },
    style: { display: '' },
    addEventListener() {}
  });

  const fields = {
    hoTen: createFieldStub('Nguyễn Thị Lan'),
    soDienThoai: createFieldStub('0912345678'),
    email: createFieldStub('lan@gmail.com'),
    tinhThanh: createFieldStub('can-tho'),
    quanHuyen: createFieldStub('ninh-kieu'),
    diaChi: createFieldStub('128 Trần Hưng Đạo'),
    dongY: createFieldStub(true, true),
    ghiChu: createFieldStub('')
  };

  const formListeners = {};
  const mockForm = {
    querySelector(selector) {
      if (selector === '[data-input="hoTen"]') return fields.hoTen;
      if (selector === '[data-input="soDienThoai"]') return fields.soDienThoai;
      if (selector === '[data-input="email"]') return fields.email;
      if (selector === '[data-input="tinhThanh"]') return fields.tinhThanh;
      if (selector === '[data-input="quanHuyen"]') return fields.quanHuyen;
      if (selector === '[data-input="diaChi"]') return fields.diaChi;
      if (selector === '[data-input="dongY"]') return fields.dongY;
      if (selector === '[data-input="ghiChu"]') return fields.ghiChu;
      if (selector === 'input[name="thanhToan"]:checked') return { value: 'cod' };
      return null;
    },
    querySelectorAll(selector) {
      if (selector && (selector.includes('error') || selector.includes('data-error-for'))) {
        return [];
      }
      return Object.values(fields);
    },
    addEventListener(event, fn) {
      formListeners[event] = fn;
    }
  };

  const toastBox = {
    appendChild() {},
    contains() { return true; },
    removeChild() {},
    setAttribute() {}
  };

  const previousDocument = globalThis.document;
  t.after(() => { globalThis.document = previousDocument; });
  globalThis.document = {
    body: { appendChild() {} },
    querySelector(selector) {
      if (selector === '[data-place-order]') return mockSubmitBtn;
      if (selector === '[data-toast]' || selector === '.toast-stack[data-toast]') return toastBox;
      return null;
    },
    querySelectorAll() { return []; },
    createElement() {
      return {
        className: '',
        textContent: '',
        innerHTML: '',
        style: { opacity: '', display: '' },
        setAttribute() {},
        removeAttribute() {},
        remove() {},
        addEventListener() {},
        classList: { add() {}, remove() {} }
      };
    }
  };

  const token = 'tok_behavioral_c3_test';
  initCheckoutFormSubmit(mockForm, token);
  assert.ok(typeof formListeners['submit'] === 'function', 'Phải đăng ký submit listener');

  // Thông tin không hợp lệ phải giữ form hoạt động để người dùng sửa.
  fields.soDienThoai.value = '123';
  let defaultPrevented = false;
  formListeners['submit']({ preventDefault() { defaultPrevented = true; } });

  assert.strictEqual(defaultPrevented, true);
  assert.strictEqual(mockSubmitBtn.disabled, false);
  assert.strictEqual(mockSubmitBtn.textContent, 'Đặt hàng');
  assert.strictEqual(storage.get('lasen_orders', []).length, 0);

  fields.soDienThoai.value = '0912345678';
  formListeners['submit']({ preventDefault() {} });

  const ordersDb = storage.get('lasen_orders', []);
  assert.strictEqual(ordersDb.length, 1, 'Đơn hàng được tạo sau khi sửa thông tin');
  assert.deepStrictEqual(ordersDb[0].totals, {
    subtotal: 165000,
    shipping: 30000,
    total: 195000
  });
  assert.strictEqual(mockSubmitBtn.disabled, true, 'Khóa nút sau khi gửi thành công');
  assert.strictEqual(cartService.getCartDetails().length, 0);

  formListeners['submit']({ preventDefault() {} });
  assert.strictEqual(storage.get('lasen_orders', []).length, 1, 'Gửi lại không tạo đơn trùng');
});
