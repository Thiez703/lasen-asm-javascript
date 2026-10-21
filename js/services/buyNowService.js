import { cartService, normalizeCart } from './cartService.js';
import { products } from './dataService.js';

/** Nguồn thanh toán riêng cho một sản phẩm, không ghi vào giỏ hàng. */
export function createBuyNowSource(productId, quantity) {
  return {
    getRawCart() {
      return normalizeCart([{ productId, quantity }], products);
    },
    // Dùng chung cách tra giá, kiểm tra tồn kho và tính phí giao hàng.
    getCartDetails: cartService.getCartDetails,
    getCartTotals: cartService.getCartTotals
  };
}
