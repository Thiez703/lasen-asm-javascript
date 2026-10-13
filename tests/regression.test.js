import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { cartService } from '../js/services/cartService.js';
import { processCheckout, validateAndSanitizeOrder } from '../js/services/checkoutService.js';
import { storage } from '../js/services/storage.js';
import { renderHomeVouchers } from '../js/modules/ui.js';
import { setCachedCoupons, loadCoupons } from '../js/services/couponService.js';

// Setup Mock cho window / localStorage
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
globalThis.CustomEvent = class CustomEvent { constructor(name, opts) { this.name = name; this.detail = opts?.detail; } };

test('9. REGRESSION: Clear Cart Fail -> Simulated Reload/New Token -> Same Cart No Duplicate', async () => {
  memoryStore.clear();

  // 1. Thêm 2 sản phẩm vào giỏ
  cartService.addToCart('p1', 2);
  const items = cartService.getCartDetails();
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].quantity, 2);

  let ordersDatabase = [];
  const mockStorage = {
    get(key, fallback) {
      if (key === 'lasen_orders') return ordersDatabase;
      if (key === 'lasen_last_completed_order') return null;
      return fallback;
    },
    set(key, val) {
      if (key === 'lasen_orders') {
        ordersDatabase = val;
        return true;
      }
      return true;
    }
  };

  // Giả lập clearCart THẤT BẠI
  let clearAttemptCount = 0;
  const mockCartService = {
    getCartDetails: () => cartService.getCartDetails(),
    getCartTotals: (coupon) => cartService.getCartTotals(coupon),
    clearCart: () => {
      clearAttemptCount++;
      return false; // Thất bại!
    }
  };

  // Lần đặt 1 với token ban đầu
  const token1 = 'tok_checkout_initial_123';
  const res1 = processCheckout(
    {
      idempotencyToken: token1,
      customer: { name: 'Lan', phone: '0912345678', email: 'lan@gmail.com' },
      shippingAddress: 'Ninh Kiều, Cần Thơ'
    },
    { storage: mockStorage, cartService: mockCartService }
  );

  // Đơn hàng đã được lưu nhưng clear giỏ thất bại
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.clearedCart, false);
  assert.ok(res1.warning, 'Phải có cảnh báo clearCart thất bại');
  assert.strictEqual(ordersDatabase.length, 1, 'Hệ thống đã lưu 1 đơn hàng');
  const savedOrderId = res1.order.id;

  // Giỏ hàng vẫn còn nguyên sản phẩm do clear thất bại
  assert.strictEqual(cartService.getCartDetails().length, 1);

  // Lần đặt 2: Mô phỏng người dùng reload trang, sinh ra một idempotencyToken MỚI HOÀN TOÀN
  const token2 = 'tok_checkout_reloaded_456';
  const res2 = processCheckout(
    {
      idempotencyToken: token2,
      customer: { name: 'Lan', phone: '0912345678', email: 'lan@gmail.com' },
      shippingAddress: 'Ninh Kiều, Cần Thơ'
    },
    { storage: mockStorage, cartService: mockCartService }
  );

  // Hệ thống PHẢI nhận diện đây là cùng một giỏ hàng (same fingerprint)
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.alreadyProcessed, true);
  assert.strictEqual(res2.order.id, savedOrderId, 'Phải trả về đúng đơn hàng cũ');
  assert.strictEqual(ordersDatabase.length, 1, 'KHÔNG ĐƯỢC TẠO ĐƠN TRÙNG LẶP');
});

test('10. REGRESSION: Changed Cart -> Permits Next Order', async () => {
  memoryStore.clear();

  // Đơn 1
  cartService.addToCart('p1', 1);
  const res1 = processCheckout({
    customer: { name: 'Lan', phone: '0912345678', email: 'lan@gmail.com' },
    shippingAddress: 'Cần Thơ'
  });
  assert.strictEqual(res1.success, true);

  // Giỏ hàng đã sạch, giờ thêm sản phẩm khác (p2)
  cartService.addToCart('p2', 1);
  const items = cartService.getCartDetails();
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].productId, 'p2');

  // Đơn 2 với giỏ hàng mới
  const res2 = processCheckout({
    customer: { name: 'Lan', phone: '0912345678', email: 'lan@gmail.com' },
    shippingAddress: 'Cần Thơ'
  });
  assert.strictEqual(res2.success, true);
  assert.notStrictEqual(res2.order.id, res1.order.id, 'Phải tạo mã đơn hàng mới');

  const orders = storage.get('lasen_orders', []);
  assert.strictEqual(orders.length, 2, 'Tổng số đơn hàng phải là 2');
});

test('11. REGRESSION: Idempotency fallback to orders snapshot when metadata write fails', async () => {
  memoryStore.clear();
  cartService.addToCart('p3', 1);

  let ordersDb = [];
  const mockStorage = {
    get(key, fallback) {
      if (key === 'lasen_orders') return ordersDb;
      if (key === 'lasen_last_completed_order') return null; // Metadata hoàn tất không đọc được
      return fallback;
    },
    set(key, val) {
      if (key === 'lasen_orders') {
        ordersDb = val;
        return true; // Ghi orders thành công
      }
      if (key === 'lasen_last_completed_order') {
        return false; // Giả lập metadata write lỗi!
      }
      return true;
    }
  };

  const token = 'tok_metadata_fail_test';
  const res = processCheckout(
    {
      idempotencyToken: token,
      customer: { name: 'A', phone: '0901234567', email: 'a@gmail.com' },
      shippingAddress: 'Cần Thơ'
    },
    { storage: mockStorage, cartService }
  );

  assert.strictEqual(res.success, true);
  assert.strictEqual(ordersDb.length, 1);

  // Thử submit lại với cùng token: snapshot trong ordersDb phải nhận diện được
  const resRetry = processCheckout(
    {
      idempotencyToken: token,
      customer: { name: 'A', phone: '0901234567', email: 'a@gmail.com' },
      shippingAddress: 'Cần Thơ'
    },
    { storage: mockStorage, cartService }
  );

  assert.strictEqual(resRetry.alreadyProcessed, true);
  assert.strictEqual(ordersDb.length, 1);
});

test('12. REGRESSION: validateAndSanitizeOrder guard malformed orders', () => {
  // 1. Input rác
  assert.strictEqual(validateAndSanitizeOrder(null), null);
  assert.strictEqual(validateAndSanitizeOrder(undefined), null);
  assert.strictEqual(validateAndSanitizeOrder('string'), null);
  assert.strictEqual(validateAndSanitizeOrder(123), null);

  // 2. Object thiếu trường
  const emptyObj = validateAndSanitizeOrder({});
  assert.ok(emptyObj);
  assert.ok(emptyObj.id.startsWith('ORD-'));
  assert.strictEqual(emptyObj.customer.name, 'Khách hàng');
  assert.deepStrictEqual(emptyObj.items, []);
  assert.strictEqual(emptyObj.totals.total, 0);

  // 3. Object có items hỏng
  const corruptedItemsOrder = validateAndSanitizeOrder({
    id: 'ORD-TEST',
    items: [null, undefined, 'bad', { productId: 'p1', price: -50, quantity: 2.5 }]
  });
  assert.strictEqual(corruptedItemsOrder.items.length, 1);
  assert.strictEqual(corruptedItemsOrder.items[0].productId, 'p1');
  assert.strictEqual(corruptedItemsOrder.items[0].price, 0); // giá âm bị clamp
  assert.strictEqual(corruptedItemsOrder.items[0].quantity, 1); // float bị fallback
});

test('13. REGRESSION: Voucher Parity đầy đủ 5 mã khuyến mãi', () => {
  memoryStore.clear();
  cartService.addToCart('p1', 1); // 165k
  cartService.addToCart('p2', 1); // 289k
  cartService.addToCart('p4', 1); // 295k
  // subtotal = 165 + 289 + 295 = 749k

  // 1. LASEN30 (đơn từ 299k)
  const t1 = cartService.getCartTotals('LASEN30');
  assert.strictEqual(t1.discount, 30000);
  assert.strictEqual(t1.coupon.code, 'LASEN30');

  // 2. SEN50 (đơn từ 300k)
  const t2 = cartService.getCartTotals('SEN50');
  assert.strictEqual(t2.discount, 50000);
  assert.strictEqual(t2.coupon.code, 'SEN50');

  // 3. SEN10 (giảm 10% tối đa 80k đơn từ 500k)
  const t3 = cartService.getCartTotals('SEN10');
  assert.strictEqual(t3.discount, Math.min(80000, Math.round(749000 * 0.1)));
  assert.strictEqual(t3.coupon.code, 'SEN10');

  // 4. CHAOBAN (giảm 50k đơn từ 250k)
  const t4 = cartService.getCartTotals('CHAOBAN');
  assert.strictEqual(t4.discount, 50000);
  assert.strictEqual(t4.coupon.code, 'CHAOBAN');

  // 5. FREESHIP (đơn dưới 500k có phí ship 30k)
  cartService.clearCart();
  cartService.addToCart('p2', 1); // 289k -> chưa đủ 350k
  const t5_not_qualified = cartService.getCartTotals('FREESHIP');
  assert.strictEqual(t5_not_qualified.discount, 0);

  cartService.addToCart('p1', 1); // thêm 165k -> subtotal = 454k (> 350k, < 500k có ship 30k)
  const t5_qualified = cartService.getCartTotals('FREESHIP');
  assert.strictEqual(t5_qualified.shipping, 30000);
  assert.strictEqual(t5_qualified.discount, 30000); // miễn phí vận chuyển
  assert.strictEqual(t5_qualified.total, 454000);
});

test('14. REGRESSION: Callers Failure and DOM Stub Test', () => {
  memoryStore.clear();

  // Khởi tạo giỏ hàng có 1 sản phẩm với số lượng 2
  cartService.addToCart('p1', 2);
  const initialDetails = cartService.getCartDetails();
  assert.strictEqual(initialDetails[0].quantity, 2);

  // Mock DOM input element
  const inputStub = {
    value: '5', // người dùng cố đổi lên 5
    setAttribute(k, v) { this[k] = v; }
  };

  // Giả lập storage gặp sự cố khi lưu
  const originalSet = storage.set;
  storage.set = () => false;

  // Thử cập nhật số lượng
  const res = cartService.updateQuantity('p1', 5);
  assert.strictEqual(res.success, false, 'Phải trả về success = false');

  // Caller handler phục hồi lại giá trị UI từ dữ liệu persisted
  if (!res.success) {
    const currentActual = cartService.getCartDetails().find(i => i.productId === 'p1');
    inputStub.value = String(currentActual.quantity);
  }

  // Xác nhận input đã được khôi phục về giá trị thực 2 (không bị kẹt ở số 5 ảo)
  assert.strictEqual(inputStub.value, '2');

  // Thử xóa giỏ khi storage lỗi
  const clearOk = cartService.clearCart();
  assert.strictEqual(clearOk, false, 'clearCart phải trả về false khi lưu thất bại');

  // Khôi phục storage
  storage.set = originalSet;
});

test('25. REGRESSION: UI Voucher Visibility & Safe Fallback', async (t) => {
  const projectRoot = path.resolve(process.cwd());

  await t.test('app.js khởi tạo initUI() để kích hoạt luồng giao diện voucher', () => {
    const appPath = path.join(projectRoot, 'js', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.ok(appContent.includes("import { initUI } from './modules/ui.js';") || appContent.includes('import { initUI }'), 'app.js phải import initUI');
    assert.ok(appContent.includes('initUI();'), 'app.js phải gọi initUI()');
  });

  await t.test('renderHomeVouchers nạp và hiển thị đầy đủ 5 voucher hợp lệ từ coupons.json', async () => {
    // Mock container
    let containerInnerHtml = '';
    const mockContainer = {
      get innerHTML() { return containerInnerHtml; },
      set innerHTML(val) { containerInnerHtml = val; }
    };

    const prevDoc = globalThis.document;
    globalThis.document = {
      querySelector(selector) {
        if (selector === '[data-list="vouchers"]') return mockContainer;
        return null;
      }
    };

    try {
      await renderHomeVouchers();

      // Kiểm tra đầy đủ 5 mã
      const expectedCodes = ['LASEN30', 'SEN50', 'SEN10', 'FREESHIP', 'CHAOBAN'];
      for (const code of expectedCodes) {
        assert.ok(containerInnerHtml.includes(code), `UI voucher phải chứa mã ${code}`);
        assert.ok(containerInnerHtml.includes(`data-copy-code="${code}"`), `UI voucher phải có nút copy cho mã ${code}`);
      }

      // Kiểm tra cấu trúc phần tử và class CSS
      assert.ok(containerInnerHtml.includes('class="voucher"'), 'Phải có thẻ li class="voucher"');
      assert.ok(containerInnerHtml.includes('class="voucher__value"'), 'Phải có badge voucher__value');
      assert.ok(containerInnerHtml.includes('class="voucher__title"'), 'Phải có voucher__title');
      assert.ok(containerInnerHtml.includes('class="voucher__code"'), 'Phải có button voucher__code');
    } finally {
      globalThis.document = prevDoc;
    }
  });

  await t.test('Trạng thái lỗi/rỗng không che mất dữ liệu voucher hợp lệ đã hiển thị', async () => {
    const existingHtml = '<li class="voucher"><span class="voucher__title">Mã đã có</span></li>';
    let containerInnerHtml = existingHtml;
    const mockContainer = {
      get innerHTML() { return containerInnerHtml; },
      set innerHTML(val) { containerInnerHtml = val; }
    };

    const prevDoc = globalThis.document;
    globalThis.document = {
      querySelector(selector) {
        if (selector === '[data-list="vouchers"]') return mockContainer;
        return null;
      }
    };

    try {
      // 1. Giả lập loader lỗi mạng và cache rỗng
      setCachedCoupons([]);
      await renderHomeVouchers(async () => { throw new Error('Network offline'); });

      // Dữ liệu hợp lệ cũ không bị xóa hay che mất
      assert.strictEqual(containerInnerHtml, existingHtml, 'Không được ghi đè làm mất dữ liệu voucher hợp lệ khi mạng lỗi');

      // 2. Giả lập loader trả về rỗng
      await renderHomeVouchers(async () => []);
      assert.strictEqual(containerInnerHtml, existingHtml, 'Không được ghi đè làm mất dữ liệu voucher hợp lệ khi danh sách rỗng');

      // 3. Khi loader lỗi nhưng cache có sẵn voucher, vẫn hiển thị được voucher từ cache
      setCachedCoupons([
        { code: 'CACHED10', badge: '10K', title: 'Giảm 10K Cache', description: 'Đơn từ 100K' }
      ]);
      await renderHomeVouchers(async () => { throw new Error('Offline'); });
      assert.ok(containerInnerHtml.includes('CACHED10'), 'Phục hồi hiển thị từ cache khi mạng lỗi');
    } finally {
      // Khôi phục cache coupons từ file thật
      try { await loadCoupons(); } catch {}
      globalThis.document = prevDoc;
    }
  });
});

