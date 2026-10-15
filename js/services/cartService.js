/**
 * Cart Service — Quản lý giỏ hàng dùng chung trong localStorage
 * Đảm bảo dữ liệu luôn được chuẩn hóa và xử lý lỗi lưu trữ triệt để
 */

import { storage } from './storage.js';
import { products } from './dataService.js';
import { PENDING_CLEANUP_KEY } from './checkoutService.js';

const STORAGE_KEY = 'lasen_cart';

/**
 * Chuẩn hóa mảng giỏ hàng:
 * 1. Từ chối dữ liệu không phải mảng, phần tử null/undefined/sai định dạng
 * 2. Loại bỏ productId không tồn tại trong danh mục sản phẩm
 * 3. Từ chối số lượng không phải số nguyên dương (chuỗi ký tự, số âm, thập phân, số 0, NaN)
 * 4. Gom các item trùng ID và giới hạn tổng số lượng không vượt quá tồn kho (stock)
 * 
 * @param {*} rawCart 
 * @param {Array} validProducts 
 * @returns {Array<{productId: string, quantity: number}>}
 */
export function normalizeCart(rawCart, validProducts = products) {
  if (!Array.isArray(rawCart)) return [];

  const productMap = new Map(validProducts.map(p => [p.id, p]));
  const consolidated = new Map();

  for (const item of rawCart) {
    if (!item || typeof item !== 'object') continue;
    const { productId, quantity } = item;
    if (!productId || typeof productId !== 'string') continue;

    const product = productMap.get(productId);
    if (!product) continue;

    // Kiểm tra số lượng phải là số nguyên dương > 0
    let validQty = null;
    if (typeof quantity === 'number') {
      if (Number.isInteger(quantity) && quantity > 0) {
        validQty = quantity;
      }
    } else if (typeof quantity === 'string') {
      const trimmed = quantity.trim();
      if (/^\d+$/.test(trimmed)) {
        const parsed = parseInt(trimmed, 10);
        if (parsed > 0) {
          validQty = parsed;
        }
      }
    }

    if (validQty === null) continue;

    const prevQty = consolidated.get(productId) || 0;
    consolidated.set(productId, prevQty + validQty);
  }

  const result = [];
  for (const [productId, totalQty] of consolidated.entries()) {
    const product = productMap.get(productId);
    if (!product || product.stock <= 0) continue;

    // Giới hạn số lượng không vượt quá tồn kho của sản phẩm
    const capped = Math.min(totalQty, product.stock);
    if (capped > 0) {
      result.push({ productId, quantity: capped });
    }
  }

  return result;
}

export const cartService = {
  /**
   * Lấy danh sách item từ storage đã qua chuẩn hóa
   * @returns {Array<{productId: string, quantity: number}>}
   */
  getRawCart() {
    const data = storage.get(STORAGE_KEY, []);
    return normalizeCart(data, products);
  },

  /**
   * Lưu giỏ hàng vào storage sau khi chuẩn hóa.
   * CHỈ phát sự kiện cart:updated khi ghi storage thành công!
   * @param {Array<{productId: string, quantity: number}>} cart 
   * @returns {boolean}
   */
  saveCart(cart) {
    const normalized = normalizeCart(cart, products);
    const success = storage.set(STORAGE_KEY, normalized);

    if (success) {
      // Khi người dùng chủ động sửa đổi giỏ hàng, hủy bỏ marker pending cleanup cũ (nếu có)
      if (storage && typeof storage.remove === 'function') {
        storage.remove(PENDING_CLEANUP_KEY);
      } else if (storage && typeof storage.set === 'function') {
        storage.set(PENDING_CLEANUP_KEY, null);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: normalized } }));
      }
    }
    return success;
  },

  /**
   * Lấy danh sách chi tiết các mặt hàng trong giỏ, ghép kèm đối tượng sản phẩm
   * @returns {Array<{productId: string, quantity: number, product: Object, itemPrice: number, lineTotal: number}>}
   */
  getCartDetails() {
    const items = this.getRawCart();
    const details = [];

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;

      const price = (typeof product.salePrice === 'number' && product.salePrice > 0)
        ? product.salePrice
        : product.price;

      details.push({
        productId: product.id,
        quantity: item.quantity,
        product,
        itemPrice: price,
        lineTotal: price * item.quantity
      });
    }

    return details;
  },

  /**
   * Thêm sản phẩm vào giỏ hàng
   * @param {string} productId 
   * @param {*} qtyToAdd 
   * @returns {{success: boolean, message: string}}
   */
  addToCart(productId, qtyToAdd = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) {
      return { success: false, message: 'Sản phẩm không tồn tại.' };
    }

    if (product.stock <= 0) {
      return { success: false, message: 'Sản phẩm này hiện đã hết hàng.' };
    }

    // Validate integer positive
    let addQty = null;
    if (typeof qtyToAdd === 'number' && Number.isInteger(qtyToAdd) && qtyToAdd > 0) {
      addQty = qtyToAdd;
    } else if (typeof qtyToAdd === 'string' && /^\d+$/.test(qtyToAdd.trim())) {
      const p = parseInt(qtyToAdd.trim(), 10);
      if (p > 0) addQty = p;
    }

    if (addQty === null) {
      return { success: false, message: 'Số lượng thêm vào phải là số nguyên dương lớn hơn 0.' };
    }

    const cart = this.getRawCart();
    const existingIndex = cart.findIndex(item => item.productId === productId);
    const currentQty = existingIndex > -1 ? cart[existingIndex].quantity : 0;
    const targetQty = currentQty + addQty;

    let finalMsg = `Đã thêm ${addQty} "${product.name}" vào giỏ hàng.`;

    if (targetQty > product.stock) {
      const availableCanAdd = product.stock - currentQty;
      if (availableCanAdd <= 0) {
        return {
          success: false,
          message: `Bạn đã có tối đa ${product.stock} sản phẩm trong giỏ. Tồn kho không đủ để thêm tiếp.`
        };
      }

      if (existingIndex > -1) {
        cart[existingIndex].quantity = product.stock;
      } else {
        cart.push({ productId, quantity: product.stock });
      }
      finalMsg = `Chỉ còn ${availableCanAdd} sản phẩm trong kho. Đã cập nhật giỏ hàng lên tối đa (${product.stock} sản phẩm).`;
    } else {
      if (existingIndex > -1) {
        cart[existingIndex].quantity = targetQty;
      } else {
        cart.push({ productId, quantity: targetQty });
      }
    }

    const saved = this.saveCart(cart);
    if (!saved) {
      return { success: false, message: 'Lưu giỏ hàng thất bại do lỗi bộ nhớ trình duyệt.' };
    }

    return { success: true, message: finalMsg };
  },

  /**
   * Cập nhật số lượng sản phẩm trong giỏ
   * @param {string} productId 
   * @param {*} newQuantity 
   * @returns {{success: boolean, message: string, finalQty: number}}
   */
  updateQuantity(productId, newQuantity) {
    const product = products.find(p => p.id === productId);
    if (!product) {
      return { success: false, message: 'Sản phẩm không tồn tại.', finalQty: 0 };
    }

    const cart = this.getRawCart();
    const index = cart.findIndex(item => item.productId === productId);

    if (index === -1) {
      return { success: false, message: 'Sản phẩm chưa có trong giỏ hàng.', finalQty: 0 };
    }

    // Validate integer positive
    let parsed = null;
    if (typeof newQuantity === 'number' && Number.isInteger(newQuantity)) {
      parsed = newQuantity;
    } else if (typeof newQuantity === 'string' && /^-?\d+$/.test(newQuantity.trim())) {
      parsed = parseInt(newQuantity.trim(), 10);
    }

    if (parsed === null || parsed <= 0) {
      const removeRes = this.removeFromCart(productId);
      return {
        success: removeRes.success,
        message: removeRes.message,
        finalQty: 0
      };
    }

    let capped = parsed;
    let message = 'Đã cập nhật số lượng.';
    if (parsed > product.stock) {
      capped = product.stock;
      message = `Số lượng đã được giới hạn ở mức tồn kho (${product.stock} sản phẩm).`;
    }

    cart[index].quantity = capped;
    const saved = this.saveCart(cart);

    if (!saved) {
      return {
        success: false,
        message: 'Lưu thay đổi thất bại do lỗi bộ nhớ trình duyệt.',
        finalQty: cart[index].quantity
      };
    }

    return {
      success: true,
      message,
      finalQty: capped
    };
  },

  /**
   * Xóa sản phẩm khỏi giỏ hàng
   * @param {string} productId 
   * @returns {{success: boolean, message: string}}
   */
  removeFromCart(productId) {
    const cart = this.getRawCart();
    const updated = cart.filter(item => item.productId !== productId);
    const saved = this.saveCart(updated);

    if (!saved) {
      return { success: false, message: 'Xóa sản phẩm thất bại do lỗi bộ nhớ trình duyệt.' };
    }
    return { success: true, message: 'Đã xóa sản phẩm khỏi giỏ hàng.' };
  },

  /**
   * Xóa toàn bộ giỏ hàng
   * @returns {boolean} Thành công hay thất bại
   */
  clearCart() {
    return this.saveCart([]);
  },

  /**
   * Tính toán tổng giá trị đơn hàng
   * @returns {{
   *   itemCount: number,
   *   totalQuantity: number,
   *   subtotal: number,
   *   shipping: number,
   *   total: number,
   *   isEmpty: boolean
   * }}
   */
  getCartTotals() {
    const details = this.getCartDetails();
    let totalQuantity = 0;
    let subtotal = 0;
    for (const item of details) {
      totalQuantity += item.quantity;
      subtotal += item.lineTotal;
    }
    const isEmpty = details.length === 0;

    let shipping = 0;
    if (!isEmpty) {
      shipping = subtotal >= 500000 ? 0 : 30000;
    }

    const total = subtotal + shipping;

    return {
      itemCount: details.length,
      totalQuantity,
      subtotal,
      shipping,
      total,
      isEmpty
    };
  }
};
