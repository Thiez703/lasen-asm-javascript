import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPrice, parseInteger, escapeHTML } from '../js/utils/format.js';
import { validation } from '../js/modules/validation.js';
import { storage } from '../js/services/storage.js';
import { cartService, normalizeCart } from '../js/services/cartService.js';
import { products, getProductById, categories } from '../js/services/dataService.js';

// Mock môi trường browser
const memoryStore = new Map();
let eventDispatched = false;

globalThis.window = {
  localStorage: {
    getItem(key) { return memoryStore.has(key) ? memoryStore.get(key) : null; },
    setItem(key, val) { memoryStore.set(key, String(val)); },
    removeItem(key) { memoryStore.delete(key); },
    clear() { memoryStore.clear(); }
  },
  dispatchEvent(event) {
    if (event.name === 'cart:updated') {
      eventDispatched = true;
    }
  }
};
globalThis.CustomEvent = class CustomEvent {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts?.detail;
  }
};

test('1. Helper định dạng tiền tệ và thoát HTML (XSS)', async (t) => {
  await t.test('formatPrice định dạng chuẩn tiền tệ Việt Nam', () => {
    assert.match(formatPrice(100000), /100[.,]000đ/);
    assert.match(formatPrice(289000), /289[.,]000đ/);
    assert.strictEqual(formatPrice(0), '0đ');
    assert.strictEqual(formatPrice(null), '0đ');
    assert.strictEqual(formatPrice(undefined), '0đ');
    assert.strictEqual(formatPrice('abc'), '0đ');
  });

  await t.test('parseInteger parse số nguyên an toàn', () => {
    assert.strictEqual(parseInteger('5', 1), 5);
    assert.strictEqual(parseInteger('0', 1), 0);
    assert.strictEqual(parseInteger('-3', 1), -3);
    assert.strictEqual(parseInteger('invalid', 1), 1);
    assert.strictEqual(parseInteger(null, 10), 10);
  });

  await t.test('escapeHTML chống XSS an toàn', () => {
    const malicious = '<script>alert("xss")</script>&foo=\'bar\'';
    const escaped = escapeHTML(malicious);
    assert.strictEqual(escaped.includes('<script>'), false);
    assert.strictEqual(escaped.includes('&lt;script&gt;'), true);
    assert.strictEqual(escaped.includes('&amp;foo='), true);
    assert.strictEqual(escaped.includes('&quot;'), true);
    assert.strictEqual(escaped.includes('&#039;'), true);
  });
});

test('2. Kiểm tra dữ liệu sản phẩm và danh mục chuẩn hóa', async (t) => {
  await t.test('Có đủ 30 sản phẩm với đầy đủ trường thông tin', () => {
    assert.strictEqual(products.length, 30);
    for (const p of products) {
      assert.ok(p.id, 'Sản phẩm phải có id');
      assert.ok(p.name, `Sản phẩm ${p.id} phải có name`);
      assert.ok(typeof p.price === 'number' && p.price > 0, `Giá sản phẩm ${p.id} phải là số dương`);
      assert.ok(typeof p.salePrice === 'number' && p.salePrice <= p.price, `Giá sale của ${p.id} phải <= giá gốc`);
      assert.ok(typeof p.stock === 'number' && p.stock >= 0, `Tồn kho của ${p.id} phải >= 0`);
      assert.ok(['lam-sach', 'duong-am', 'chong-nang', 'dac-tri', 'mat-na'].includes(p.category), `Category ${p.category} không hợp lệ`);
      assert.ok(['la-sen', 'sen-viet', 'pure-lotus', 'thao-moc-xanh'].includes(p.brand), `Brand ${p.brand} không hợp lệ`);
      assert.ok(Array.isArray(p.skin) && p.skin.length > 0, `Skin của ${p.id} phải là mảng không rỗng`);
    }
  });

  await t.test('Danh mục chuẩn hóa 5 slug chính xác', () => {
    assert.strictEqual(categories.length, 5);
    const slugs = categories.map(c => c.slug);
    assert.deepStrictEqual(slugs, ['lam-sach', 'duong-am', 'chong-nang', 'dac-tri', 'mat-na']);
  });
});

test('3. normalizeCart kiểm tra và chuẩn hóa dữ liệu giỏ hàng bẩn', async (t) => {
  await t.test('Xử lý input không phải mảng (null, undefined, string, object)', () => {
    assert.deepStrictEqual(normalizeCart(null), []);
    assert.deepStrictEqual(normalizeCart(undefined), []);
    assert.deepStrictEqual(normalizeCart('not-an-array'), []);
    assert.deepStrictEqual(normalizeCart({ productId: 'p1', quantity: 2 }), []);
    assert.deepStrictEqual(normalizeCart(12345), []);
  });

  await t.test('Bỏ qua các phần tử null, undefined hoặc không phải object', () => {
    const raw = [null, undefined, 'string', 42, { productId: 'p1', quantity: 2 }];
    const result = normalizeCart(raw);
    assert.deepStrictEqual(result, [{ productId: 'p1', quantity: 2 }]);
  });

  await t.test('Loại bỏ item có productId lạ hoặc không tồn tại', () => {
    const raw = [
      { productId: 'p9999_fake', quantity: 2 },
      { productId: '', quantity: 1 },
      { quantity: 3 },
      { productId: 'p1', quantity: 1 }
    ];
    const result = normalizeCart(raw);
    assert.deepStrictEqual(result, [{ productId: 'p1', quantity: 1 }]);
  });

  await t.test('Từ chối quantity không hợp lệ (số âm, số 0, số thập phân, chuỗi ký tự, NaN)', () => {
    const raw = [
      { productId: 'p1', quantity: -1 },
      { productId: 'p1', quantity: 0 },
      { productId: 'p1', quantity: 2.5 },
      { productId: 'p1', quantity: 'abc' },
      { productId: 'p1', quantity: NaN },
      { productId: 'p1', quantity: '-3' },
      { productId: 'p1', quantity: '2.8' },
      { productId: 'p2', quantity: 2 },
      { productId: 'p3', quantity: '3' } // chuỗi số nguyên hợp lệ được chấp nhận
    ];
    const result = normalizeCart(raw);
    assert.deepStrictEqual(result, [
      { productId: 'p2', quantity: 2 },
      { productId: 'p3', quantity: 3 }
    ]);
  });

  await t.test('Consolidate duplicates và Cap ở mức stock của sản phẩm', () => {
    const p1 = getProductById('p1'); // stock ví dụ 45
    const raw = [
      { productId: 'p1', quantity: 10 },
      { productId: 'p1', quantity: 15 },
      { productId: 'p1', quantity: 999 } // tổng cộng vượt quá p1.stock
    ];
    const result = normalizeCart(raw);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].productId, 'p1');
    assert.strictEqual(result[0].quantity, p1.stock);
  });
});

test('4. cartService error propagation & mutation failures', async (t) => {
  memoryStore.clear();

  await t.test('saveCart không dispatch event khi storage.set thất bại', () => {
    eventDispatched = false;

    // Giả lập storage.set lỗi
    const originalSet = storage.set;
    storage.set = () => false;

    const ok = cartService.saveCart([{ productId: 'p1', quantity: 1 }]);
    assert.strictEqual(ok, false);
    assert.strictEqual(eventDispatched, false, 'Không được dispatch cart:updated khi lưu thất bại');

    // Khôi phục storage.set
    storage.set = originalSet;
  });

  await t.test('addToCart, updateQuantity, removeFromCart trả về success: false khi storage fail', () => {
    const originalSet = storage.set;
    storage.set = () => false;

    const addRes = cartService.addToCart('p1', 1);
    assert.strictEqual(addRes.success, false);
    assert.match(addRes.message, /thất bại/);

    const updateRes = cartService.updateQuantity('p1', 2);
    assert.strictEqual(updateRes.success, false);

    const removeRes = cartService.removeFromCart('p1');
    assert.strictEqual(removeRes.success, false);

    storage.set = originalSet;
  });
});

test('5. cartService luồng chuẩn với storage bình thường', async (t) => {
  memoryStore.clear();

  await t.test('Thêm và gộp sản phẩm', () => {
    const r1 = cartService.addToCart('p1', 2);
    assert.strictEqual(r1.success, true);

    const r2 = cartService.addToCart('p1', 3);
    assert.strictEqual(r2.success, true);

    const details = cartService.getCartDetails();
    assert.strictEqual(details.length, 1);
    assert.strictEqual(details[0].quantity, 5);
  });

  await t.test('Chặn thêm số lượng vượt quá tồn kho', () => {
    const p1 = getProductById('p1');
    const r = cartService.addToCart('p1', p1.stock * 2);
    const details = cartService.getCartDetails();
    assert.strictEqual(details[0].quantity, p1.stock);
  });

  await t.test('Cập nhật số lượng và tính tổng tiền theo giá bán sản phẩm', () => {
    cartService.clearCart();
    cartService.addToCart('p2', 1);

    const product = getProductById('p2');
    assert.ok(product.salePrice < product.price);
    assert.strictEqual(cartService.getCartDetails()[0].lineTotal, product.salePrice);
    assert.strictEqual(cartService.getCartTotals().total, product.salePrice + 30000);

    assert.strictEqual(cartService.updateQuantity('p2', 2).success, true);
    assert.deepStrictEqual(cartService.getCartTotals(), {
      itemCount: 1,
      totalQuantity: 2,
      subtotal: 578000,
      shipping: 0,
      total: 578000,
      isEmpty: false
    });
  });

  await t.test('Đơn dưới 500.000đ có phí vận chuyển 30.000đ', () => {
    cartService.clearCart();
    cartService.addToCart('p1', 3);

    const totals = cartService.getCartTotals();
    assert.strictEqual(totals.subtotal, 495000);
    assert.strictEqual(totals.shipping, 30000);
    assert.strictEqual(totals.total, 525000);
  });

  await t.test('Đơn đúng 500.000đ tự động miễn phí vận chuyển', () => {
    cartService.clearCart();
    cartService.addToCart('p19', 2);

    const totals = cartService.getCartTotals();
    assert.strictEqual(totals.subtotal, 500000);
    assert.strictEqual(totals.shipping, 0);
    assert.strictEqual(totals.total, 500000);
  });

  await t.test('Giỏ hàng rỗng có tổng tiền và phí vận chuyển bằng 0', () => {
    cartService.clearCart();

    assert.deepStrictEqual(cartService.getCartTotals(), {
      itemCount: 0,
      totalQuantity: 0,
      subtotal: 0,
      shipping: 0,
      total: 0,
      isEmpty: true
    });
  });
});

test('6. Validation helpers', async (t) => {
  await t.test('Kiểm tra email', () => {
    assert.strictEqual(validation.isValidEmail('test@gmail.com'), true);
    assert.strictEqual(validation.isValidEmail('user.name+tag@sub.domain.vn'), true);
    assert.strictEqual(validation.isValidEmail('invalid-email'), false);
    assert.strictEqual(validation.isValidEmail(''), false);
  });

  await t.test('Kiểm tra số điện thoại Việt Nam 10 chữ số', () => {
    assert.strictEqual(validation.isValidPhone('0901234567'), true);
    assert.strictEqual(validation.isValidPhone('0389998888'), true);
    assert.strictEqual(validation.isValidPhone('0912 345 678'), true);
    assert.strictEqual(validation.isValidPhone('123456'), false);
    assert.strictEqual(validation.isValidPhone('0123456789'), false);
  });

  await t.test('Kiểm tra isRequired', () => {
    assert.strictEqual(validation.isRequired('Lá Sen'), true);
    assert.strictEqual(validation.isRequired('   '), false);
    assert.strictEqual(validation.isRequired(''), false);
    assert.strictEqual(validation.isRequired(null), false);
  });
});
