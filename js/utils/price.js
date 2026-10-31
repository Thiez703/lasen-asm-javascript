export function formatPrice(price) {
  return price.toLocaleString('vi-VN') + 'đ';
}

export function getPrice(product) {
  return product.salePrice || product.price;
}
