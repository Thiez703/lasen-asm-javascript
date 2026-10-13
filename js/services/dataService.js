/**
 * Nạp dữ liệu JSON trước khi các module sử dụng mảng và hàm tra cứu đồng bộ.
 */
async function loadJsonData(filename) {
  const url = new URL(`../data/${filename}`, import.meta.url);
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
  let data;

  if (isNode) {
    const fs = process.getBuiltinModule('node:fs');
    data = JSON.parse(fs.readFileSync(url, 'utf8'));
  } else {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Tải ${filename} thất bại (HTTP ${response.status})`);
    }
    data = await response.json();
  }

  if (!Array.isArray(data)) {
    throw new Error(`Dữ liệu ${filename} phải là mảng JSON`);
  }
  return data;
}

const [products, categories, reviews, users] = await Promise.all([
  loadJsonData('products.json'),
  loadJsonData('categories.json'),
  loadJsonData('reviews.json'),
  loadJsonData('users.json')
]);

export { products, categories, users };

export const getProductById = (id) => products.find(product => product.id === id);
export const getReviewsByProductId = (productId) => reviews.filter(review => review.productId === productId);
