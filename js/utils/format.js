/**
 * Các hàm tiện ích định dạng và bảo mật hiển thị
 */

/**
 * Định dạng số tiền sang tiền tệ Việt Nam (VND), ví dụ: 289.000đ
 * @param {number|string} price 
 * @returns {string}
 */
export function formatPrice(price) {
  const num = Number(price);
  if (isNaN(num) || num === null || num === undefined) {
    return '0đ';
  }
  return Math.round(num).toLocaleString('vi-VN') + 'đ';
}

/**
 * Chuyển đổi an toàn chuỗi thành số nguyên dương
 * @param {*} val 
 * @param {number} fallback 
 * @returns {number}
 */
export function parseInteger(val, fallback = 1) {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

/**
 * Thoát các ký tự HTML đặc biệt để chống tấn công XSS
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
