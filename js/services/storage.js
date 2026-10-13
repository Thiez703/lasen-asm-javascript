/**
 * Service lưu trữ localStorage an toàn với try/catch dự phòng
 */

export const storage = {
  /**
   * Lấy giá trị từ localStorage theo key, tự động parse JSON
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {*}
   */
  get(key, defaultValue = null) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return defaultValue;
      }
      const raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) {
        return defaultValue;
      }
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`Lỗi khi đọc storage key "${key}":`, err);
      return defaultValue;
    }
  },

  /**
   * Lưu giá trị vào localStorage dưới dạng chuỗi JSON
   * @param {string} key 
   * @param {*} value 
   * @returns {boolean} Thành công hay thất bại
   */
  set(key, value) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
      return true;
    } catch (err) {
      console.error(`Lỗi khi ghi storage key "${key}":`, err);
      return false;
    }
  },

  /**
   * Xoá mục khỏi localStorage
   * @param {string} key 
   * @returns {boolean}
   */
  remove(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      window.localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.warn(`Lỗi khi xoá storage key "${key}":`, err);
      return false;
    }
  }
};
