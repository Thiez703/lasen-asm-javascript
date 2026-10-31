async function loadData(filename) {
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
}

function showLoadError() {
  const main = document.querySelector('main');
  main.innerHTML = `
    <div class="container section">
      <div class="empty empty--error" role="alert">
        <h1 class="empty__title">Không tải được dữ liệu cửa hàng</h1>
        <p class="empty__text">Kết nối có thể đang bị gián đoạn. Vui lòng kiểm tra mạng rồi tải lại trang.</p>
        <div class="empty__actions">
          <button class="btn btn--primary" type="button" data-reload>Tải lại trang</button>
        </div>
      </div>
    </div>
  `;
  main.querySelector('[data-reload]').addEventListener('click', () => window.location.reload());
}

const [products, categories, reviews, users] = await Promise.all(
  ['products.json', 'categories.json', 'reviews.json', 'users.json'].map(loadData)
).catch(error => {
  showLoadError();
  throw error;
});

export { products, categories, users };

export const getProductById = id => products.find(product => product.id === id);

export const getReviewsByProductId = productId => reviews.filter(review => review.productId === productId);
