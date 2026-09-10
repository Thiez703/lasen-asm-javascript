/**
 * Format number to Vietnamese currency (VND).
 * @param {number|string} amount - The amount to format.
 * @returns {string} Formatted currency string (e.g., "150.000đ").
 */
export function formatPrice(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) {
    return '0đ';
  }
  return num.toLocaleString('vi-VN') + 'đ';
}

export function calcDiscount(price, salePrice) {
  const p = Number(price);
  const sp = Number(salePrice);
  if (Number.isNaN(p) || Number.isNaN(sp) || p === 0) {
    return 0;
  }
  return Math.round(((p - sp) / p) * 100);
}

export function slugify(text) {
  if (!text) return '';

  return text
    .toString()
    .toLowerCase() // 1. Chuyển toàn bộ thành chữ thường
    .normalize('NFD') // 2. Chuẩn hóa chuỗi Unicode (tách các ký tự có dấu thành ký tự cơ bản + dấu)
    .replace(/[\u0300-\u036f]/g, '') // 3. Loại bỏ các dấu (diacritics) vừa được tách ra ở trên
    .replace(/đ/g, 'd').replace(/Đ/g, 'D') // 4. Xử lý riêng biệt chữ 'đ' và 'Đ' của tiếng Việt
    .replace(/[^a-z0-9 -]/g, '') // 5. Loại bỏ các ký tự đặc biệt (chỉ giữ lại chữ cái, số, khoảng trắng và dấu gạch ngang)
    .replace(/\s+/g, '-') // 6. Thay thế khoảng trắng bằng dấu gạch ngang
    .replace(/-+/g, '-') // 7. Gộp nhiều dấu gạch ngang liên tiếp thành một dấu gạch ngang duy nhất
    .replace(/^-+|-+$/g, ''); // 8. Loại bỏ dấu gạch ngang nếu nó nằm ở đầu hoặc cuối chuỗi
}