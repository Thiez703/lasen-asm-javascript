/**
 * Favorite Service — Quản lý danh sách sản phẩm yêu thích trong localStorage
 * Đảm bảo dữ liệu chuẩn hóa, xử lý an toàn lỗi storage, JSON bẩn, ID trùng hoặc không tồn tại.
 */

import { storage } from './storage.js';
import { getAccountStorageKey } from './accountService.js';
import { products, getProductById } from './dataService.js';

const FAVORITES_KEY = 'lasen_favorites';

/**
 * Chuẩn hóa mảng ID yêu thích từ localStorage:
 * 1. Từ chối dữ liệu không phải mảng (chuỗi JSON bẩn, null, số, object)
 * 2. Bỏ qua các phần tử null, undefined, không phải string hoặc chuỗi rỗng
 * 3. Loại bỏ ID không tồn tại trong danh mục sản phẩm (missing products)
 * 4. Loại bỏ các ID trùng lặp (duplicate IDs), giữ thứ tự xuất hiện đầu tiên
 * 
 * @param {*} rawIds 
 * @param {Array} validProducts 
 * @returns {Array<string>} Mảng ID sản phẩm hợp lệ
 */
function normalizeFavorites(rawIds, validProducts = products) {
  if (!Array.isArray(rawIds)) return [];

  const validIdSet = new Set(
    Array.isArray(validProducts)
      ? validProducts.map(p => (p && typeof p.id === 'string' ? p.id : '')).filter(Boolean)
      : []
  );

  const seen = new Set();
  const result = [];

  for (const item of rawIds) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (validIdSet.has(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }

  return result;
}

export const favoriteService = {
  /**
   * Lấy danh sách ID sản phẩm yêu thích đã được chuẩn hóa
   * @returns {Array<string>}
   */
  getFavoriteIds() {
    const raw = storage.get(getAccountStorageKey(FAVORITES_KEY), []);
    return normalizeFavorites(raw, products);
  },

  /**
   * Kiểm tra một sản phẩm có nằm trong danh sách yêu thích hay không
   * @param {string} productId 
   * @returns {boolean}
   */
  isFavorite(productId) {
    if (!productId || typeof productId !== 'string') return false;
    const ids = this.getFavoriteIds();
    return ids.includes(productId);
  },

  /**
   * Lưu danh sách ID yêu thích vào storage sau khi chuẩn hóa.
   * Chỉ phát sự kiện favorites:updated khi ghi storage thành công!
   * @param {Array<string>} ids 
   * @returns {boolean} Thành công hay thất bại
   */
  saveFavorites(ids) {
    const normalized = normalizeFavorites(ids, products);
    const success = storage.set(getAccountStorageKey(FAVORITES_KEY), normalized);

    if (success && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('favorites:updated', {
          detail: { favorites: normalized }
        }));
      } catch (err) {
        console.warn('Lỗi khi dispatch sự kiện favorites:updated:', err);
      }
    }

    return success;
  },

  /**
   * Bật/tắt trạng thái yêu thích của sản phẩm:
   * Nếu đã yêu thích -> bỏ yêu thích
   * Nếu chưa yêu thích -> thêm vào yêu thích
   * An toàn: không báo thành công khi ghi storage thất bại.
   * 
   * @param {string} productId 
   * @returns {{success: boolean, isFavorite: boolean, message: string}}
   */
  toggleFavorite(productId) {
    if (!productId || typeof productId !== 'string') {
      return {
        success: false,
        isFavorite: false,
        message: 'Mã sản phẩm không hợp lệ.'
      };
    }

    const product = getProductById(productId);
    if (!product) {
      return {
        success: false,
        isFavorite: false,
        message: 'Sản phẩm không tồn tại trong hệ thống.'
      };
    }

    const currentIds = this.getFavoriteIds();
    const exists = currentIds.includes(productId);
    let nextIds;
    let nextState;

    if (exists) {
      nextIds = currentIds.filter(id => id !== productId);
      nextState = false;
    } else {
      nextIds = [...currentIds, productId];
      nextState = true;
    }

    const success = this.saveFavorites(nextIds);
    if (!success) {
      return {
        success: false,
        isFavorite: exists,
        message: 'Không thể cập nhật danh sách yêu thích do lỗi lưu trữ.'
      };
    }

    return {
      success: true,
      isFavorite: nextState,
      message: nextState
        ? `Đã thêm "${product.name}" vào danh sách yêu thích!`
        : `Đã bỏ "${product.name}" khỏi danh sách yêu thích.`
    };
  },

  /**
   * Lấy danh sách các đối tượng sản phẩm yêu thích thực tế (bỏ qua ID lỗi)
   * @returns {Array<Object>}
   */
  getFavoriteProducts() {
    const ids = this.getFavoriteIds();
    return ids.map(id => getProductById(id)).filter(Boolean);
  }
};
