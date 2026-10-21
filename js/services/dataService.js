
const [products, categories, reviews, users] = await Promise.all(
  ['products.json', 'categories.json', 'reviews.json', 'users.json'].map(async (filename) => {
    const url = new URL(`../data/${filename}`, import.meta.url);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Tải ${filename} thất bại (HTTP ${response.status})`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(`Dữ liệu ${filename} phải là mảng JSON`);
    }

    return data;
  })
);

export { products, categories, users };

export const getProductById = (id) =>
  products.find(product => product.id === id);

export const getReviewsByProductId = (productId) =>
  reviews.filter(review => review.productId === productId);
