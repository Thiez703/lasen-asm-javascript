// Chuyển số (hoặc string số) sang tiền tệ Việt Nam (ví dụ: 150000 -> "150.000 đ")
export function formatPrice(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) {
    return '0đ';
  }
  return num.toLocaleString('vi-VN') + 'đ';
}