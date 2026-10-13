import test from 'node:test';
import assert from 'node:assert/strict';

import { products } from '../js/services/dataService.js';
import { filterAndSortProducts } from '../js/modules/filter.js';
import { processCheckout } from '../js/services/checkoutService.js';
import { cartService } from '../js/services/cartService.js';

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

test('7. filterAndSortProducts production function', async (t) => {
  await t.test('Lọc theo Danh mục (Category)', () => {
    const res = filterAndSortProducts(products, { categories: ['lam-sach', 'dac-tri'] });
    assert.ok(res.length > 0);
    for (const p of res) {
      assert.ok(['lam-sach', 'dac-tri'].includes(p.category));
    }
  });

  await t.test('Lọc theo Thương hiệu (Brand)', () => {
    const res = filterAndSortProducts(products, { brands: ['la-sen'] });
    assert.ok(res.length > 0);
    for (const p of res) {
      assert.strictEqual(p.brand, 'la-sen');
    }
  });

  await t.test('Lọc theo Loại da (Skin)', () => {
    const res = filterAndSortProducts(products, { skins: ['da-dau'] });
    assert.ok(res.length > 0);
    for (const p of res) {
      assert.ok(p.skin.includes('da-dau'));
    }
  });

  await t.test('Lọc theo Khoảng giá (Price min - max)', () => {
    const res = filterAndSortProducts(products, { priceMin: 200000, priceMax: 300000 });
    assert.ok(res.length > 0);
    for (const p of res) {
      const price = p.salePrice || p.price;
      assert.ok(price >= 200000 && price <= 300000);
    }
  });

  await t.test('Lọc sản phẩm khuyến mãi (saleOnly)', () => {
    const res = filterAndSortProducts(products, { saleOnly: true });
    assert.ok(res.length > 0);
    for (const p of res) {
      assert.ok(typeof p.salePrice === 'number' && p.salePrice < p.price);
    }
  });

  await t.test('Tìm kiếm từ khóa (Search theo tên hoặc mô tả)', () => {
    const res = filterAndSortProducts(products, { search: 'vitamin c' });
    assert.ok(res.length > 0);
    assert.ok(res.some(p => p.name.toLowerCase().includes('vitamin c') || p.description.toLowerCase().includes('vitamin c')));
  });

  await t.test('Kết hợp AND giữa các nhóm tiêu chí', () => {
    const res = filterAndSortProducts(products, {
      categories: ['lam-sach'],
      brands: ['la-sen'],
      skins: ['da-dau']
    });
    for (const p of res) {
      assert.strictEqual(p.category, 'lam-sach');
      assert.strictEqual(p.brand, 'la-sen');
      assert.ok(p.skin.includes('da-dau'));
    }
  });

  await t.test('Sắp xếp giá tăng dần (price-asc)', () => {
    const res = filterAndSortProducts(products, { sort: 'price-asc' });
    for (let i = 0; i < res.length - 1; i++) {
      const aPrice = res[i].salePrice || res[i].price;
      const bPrice = res[i+1].salePrice || res[i+1].price;
      assert.ok(aPrice <= bPrice);
    }
  });

  await t.test('Sắp xếp giá giảm dần (price-desc)', () => {
    const res = filterAndSortProducts(products, { sort: 'price-desc' });
    for (let i = 0; i < res.length - 1; i++) {
      const aPrice = res[i].salePrice || res[i].price;
      const bPrice = res[i+1].salePrice || res[i+1].price;
      assert.ok(aPrice >= bPrice);
    }
  });

  await t.test('Sắp xếp bán chạy nhất (best-seller)', () => {
    const res = filterAndSortProducts(products, { sort: 'best-seller' });
    for (let i = 0; i < res.length - 1; i++) {
      assert.ok((res[i].sold || 0) >= (res[i+1].sold || 0));
    }
  });
});

test('8. processCheckout production function & resilience cases', async (t) => {
  memoryStore.clear();

  await t.test('Chặn đặt hàng khi giỏ hàng rỗng (EMPTY_CART)', () => {
    cartService.clearCart();
    const res = processCheckout({
      customer: { name: 'Lan', phone: '0901234567', email: 'lan@gmail.com' },
      shippingAddress: 'Cần Thơ',
      paymentMethod: 'COD'
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'EMPTY_CART');
  });

  await t.test('Quy trình đặt hàng thành công chuẩn', () => {
    memoryStore.clear();
    cartService.addToCart('p1', 1);
    cartService.addToCart('p2', 2);

    const token = 'tok_test_success_1';
    const res = processCheckout({
      idempotencyToken: token,
      customer: { name: 'Nguyễn Văn A', phone: '0901234567', email: 'a@gmail.com' },
      shippingAddress: '128 Trần Hưng Đạo, Ninh Kiều, Cần Thơ',
      paymentMethod: 'COD'
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.clearedCart, true);
    assert.ok(res.order.id.startsWith('ORD-'));
    assert.strictEqual(res.order.items.length, 2);

    // Kiểm tra giỏ hàng đã được xóa sạch
    assert.strictEqual(cartService.getCartDetails().length, 0);
  });

  await t.test('Xử lý Idempotency: Không nhân bản đơn hàng khi gửi lại cùng token', () => {
    const token = 'tok_test_success_1';
    const res2 = processCheckout({
      idempotencyToken: token,
      customer: { name: 'Nguyễn Văn A', phone: '0901234567', email: 'a@gmail.com' },
      shippingAddress: '128 Trần Hưng Đạo, Ninh Kiều, Cần Thơ',
      paymentMethod: 'COD'
    });

    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.alreadyProcessed, true);
  });

  await t.test('Trường hợp Order write fail: Giỏ hàng phải được bảo toàn, không bị xóa', () => {
    memoryStore.clear();
    cartService.addToCart('p1', 2);
    assert.strictEqual(cartService.getCartDetails().length, 1);

    // Mock storage lỗi khi ghi orders
    const mockStorage = {
      get(key, fallback) {
        if (key === 'lasen_orders') return [];
        return fallback;
      },
      set(key, val) {
        if (key === 'lasen_orders') return false; // Giả lập lỗi ghi order
        return true;
      }
    };

    let cartCleared = false;
    const mockCartService = {
      getCartDetails: () => cartService.getCartDetails(),
      getCartTotals: () => cartService.getCartTotals(),
      clearCart: () => { cartCleared = true; return true; }
    };

    const res = processCheckout(
      {
        customer: { name: 'Test', phone: '0912345678', email: 't@gmail.com' },
        shippingAddress: 'Cần Thơ'
      },
      { storage: mockStorage, cartService: mockCartService }
    );

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'ORDER_WRITE_FAILED');
    assert.strictEqual(cartCleared, false, 'Tuyệt đối không được gọi clearCart khi order lưu thất bại');
    assert.strictEqual(cartService.getCartDetails().length, 1, 'Giỏ hàng phải được giữ nguyên');
  });

  await t.test('Trường hợp Clear cart fail: Order đã lưu nhưng có warning, không claim là đã clear', () => {
    memoryStore.clear();
    cartService.addToCart('p2', 1);

    let savedOrders = [];
    const mockStorage = {
      get(key, fallback) {
        if (key === 'lasen_orders') return savedOrders;
        return fallback;
      },
      set(key, val) {
        if (key === 'lasen_orders') { savedOrders = val; return true; }
        return true;
      }
    };

    const mockCartService = {
      getCartDetails: () => cartService.getCartDetails(),
      getCartTotals: () => cartService.getCartTotals(),
      clearCart: () => false // Giả lập lỗi khi clearCart
    };

    const res = processCheckout(
      {
        customer: { name: 'Test Clear Fail', phone: '0912345678', email: 'fail@gmail.com' },
        shippingAddress: 'Cần Thơ'
      },
      { storage: mockStorage, cartService: mockCartService }
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.clearedCart, false, 'Phải đánh dấu clearedCart = false');
    assert.ok(res.warning, 'Phải có thông báo warning rõ ràng cho người dùng');
    assert.strictEqual(savedOrders.length, 1, 'Order phải được lưu thành công');
  });
});
