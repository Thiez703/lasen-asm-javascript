import { products, getProductById, getReviewsByProductId } from '../services/dataService.js';
import { addToCart } from '../services/cartService.js';
import { isFavorite } from '../services/favoriteService.js';
import { createStars, renderProductList } from './products.js';
import { formatPrice, getPrice, getStorage, setStorage, showToast } from '../utils/helpers.js';

const RECENT_KEY = 'lasen_recent_products';

export function renderProductDetail() {
  if (!document.querySelector('article.detail')) return;

  const productId = new URLSearchParams(window.location.search).get('id');
  const product = getProductById(productId);
  if (!product) {
    showNotFound();
    return;
  }

  document.title = product.name + ' — Lá Sen';
  showProductInfo(product);
  initGallery(product);
  initBuyButtons(product);
  initTabs(product);
  showReviews(product);
  showRelatedProducts(product);
  showRecentProducts(product);
}

function showNotFound() {
  document.querySelector('main').innerHTML = `
    <div class="container" style="padding-block: 60px; text-align: center;">
      <h1 style="font-size: 24px; margin-bottom: 12px;">Không tìm thấy sản phẩm</h1>
      <p style="color: var(--c-muted, #666); margin-bottom: 24px;">Sản phẩm không tồn tại hoặc đường liên kết đã thay đổi.</p>
      <a class="btn btn--primary" href="products.html">Xem tất cả sản phẩm</a>
    </div>
  `;
}

function showProductInfo(product) {
  const price = getPrice(product);

  document.querySelector('.breadcrumb').innerHTML = `
    <li class="breadcrumb__item"><a class="breadcrumb__link" href="index.html">Trang chủ</a></li>
    <li class="breadcrumb__item"><a class="breadcrumb__link" href="products.html">Sản phẩm</a></li>
    <li class="breadcrumb__item"><a class="breadcrumb__link" href="products.html?cat=${product.category}">${product.categoryName}</a></li>
    <li class="breadcrumb__item" aria-current="page">${product.name}</li>
  `;
  document.querySelector('.detail__brand').innerHTML = `${product.brandName} · <a href="products.html?cat=${product.category}">${product.categoryName}</a>`;
  document.querySelector('.detail__name').textContent = product.name;
  document.querySelector('.detail__rating').innerHTML = `
    <span class="rating__stars" aria-hidden="true">${createStars(product.rating)}</span>
    <span class="rating__value">${product.rating}</span>
    <a class="rating__count" href="#panel-danh-gia">${product.ratingCount} đánh giá</a>
    <span class="rating__count">· Đã bán ${product.sold.toLocaleString('vi-VN')}</span>
  `;

  document.querySelector('[data-price]').textContent = formatPrice(price);
  document.querySelector('[data-price-old]').textContent = formatPrice(product.price);
  document.querySelector('.detail__save').textContent = 'Tiết kiệm ' + formatPrice(product.price - price);
  document.querySelector('.detail__lead').textContent = product.description;
  document.querySelector('[data-volume]').textContent = product.capacity;
  document.querySelector('[data-skin]').textContent = product.skinText;
  document.querySelector('[data-stock-count]').textContent = product.stock;

  const heartButton = document.querySelector('[data-wishlist]');
  heartButton.setAttribute('data-id', product.id);
  heartButton.classList.toggle('is-active', isFavorite(product.id));
}

function initGallery(product) {
  const mainImage = document.querySelector('[data-gallery-main]');
  mainImage.src = product.images[0];
  mainImage.alt = product.name;

  const percent = Math.round((product.price - getPrice(product)) / product.price * 100);
  document.querySelector('.gallery__badge').textContent = '-' + percent + '%';

  const thumbList = document.querySelector('.gallery__thumbs');
  thumbList.innerHTML = product.images.map((image, index) => `
    <li>
      <button class="gallery__thumb ${index === 0 ? 'is-active' : ''}" type="button" data-src="${image}">
        <img src="${image}" alt="${product.name} - ảnh ${index + 1}" loading="lazy">
      </button>
    </li>
  `).join('');

  thumbList.addEventListener('click', (event) => {
    const thumb = event.target.closest('.gallery__thumb');
    if (!thumb) return;

    mainImage.src = thumb.getAttribute('data-src');
    thumbList.querySelectorAll('.gallery__thumb').forEach(item => item.classList.remove('is-active'));
    thumb.classList.add('is-active');
  });
}

// Ô chọn số lượng, nút "Thêm vào giỏ" và nút "Mua ngay"
function initBuyButtons(product) {
  const quantityInput = document.querySelector('[data-qty-input]');
  quantityInput.value = 1;
  quantityInput.max = product.stock;

  // Giữ số lượng trong khoảng từ 1 đến số lượng tồn kho
  function setQuantity(quantity) {
    if (quantity < 1) quantity = 1;
    if (quantity > product.stock) quantity = product.stock;
    quantityInput.value = quantity;
  }

  document.querySelector('[data-qty-minus]').addEventListener('click', () => {
    setQuantity(Number(quantityInput.value) - 1);
  });
  document.querySelector('[data-qty-plus]').addEventListener('click', () => {
    setQuantity(Number(quantityInput.value) + 1);
  });
  quantityInput.addEventListener('change', () => {
    setQuantity(parseInt(quantityInput.value) || 1);
  });

  document.querySelector('.detail__add').addEventListener('click', () => {
    addToCart(product.id, Number(quantityInput.value));
  });

  document.querySelector('[data-buy-now]').addEventListener('click', () => {
    window.location.href = `checkout.html?buyNow=${product.id}&quantity=${quantityInput.value}`;
  });
}

function initTabs(product) {
  const buttons = document.querySelectorAll('[data-tab]');
  const panels = document.querySelectorAll('[data-tab-panel]');

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      buttons.forEach(item => item.classList.toggle('is-active', item === button));
      panels.forEach(panel => panel.classList.toggle('is-hidden', panel.getAttribute('data-tab-panel') !== tabName));
    });
  });

  document.querySelector('[data-tab-panel="mo-ta"]').innerHTML = `
    <h2>${product.name}</h2>
    <p>${product.description}</p>
    <h3>Đặc điểm nổi bật</h3>
    <p>Sản phẩm chiết xuất từ thiên nhiên lành tính, an toàn cho làn da người Việt. Không chứa hương liệu nhân tạo hay paraben.</p>
  `;
}

function showReviews(product) {
  const reviews = getReviewsByProductId(product.id);
  const reviewList = document.querySelector('[data-list="reviews"]');
  document.querySelector('.reviews__score').innerHTML = `${product.rating}<span>/5</span>`;

  if (reviews.length === 0) {
    reviewList.innerHTML = '<li style="padding: 16px; text-align: center;">Chưa có đánh giá nào cho sản phẩm này.</li>';
  } else {
    reviewList.innerHTML = reviews.map(review => `
      <li class="review">
        <p class="review__head">
          <span class="review__author">${review.userName}</span>
          <span class="review__date">${review.date}</span>
        </p>
        <p class="rating"><span class="rating__stars">${createStars(review.rating)}</span></p>
        <p class="review__text">${review.comment}</p>
      </li>
    `).join('');
  }

  document.querySelector('[data-review-open]').addEventListener('click', () => {
    const comment = prompt(`Viết đánh giá của bạn cho "${product.name}":`);
    if (comment) {
      showToast('Cảm ơn bạn đã gửi đánh giá! Đánh giá sẽ hiển thị sau khi được duyệt.');
    }
  });

  const moreButton = document.querySelector('[data-reviews-more]');
  moreButton.addEventListener('click', () => {
    moreButton.textContent = 'Đã hiển thị tất cả đánh giá';
    moreButton.disabled = true;
  });
}

function showRelatedProducts(product) {
  const related = products.filter(item => item.category === product.category && item.id !== product.id);
  renderProductList('[data-list="related"]', related.slice(0, 4));
}

// Hiện các sản phẩm đã xem gần đây và lưu sản phẩm đang xem vào lịch sử
function showRecentProducts(product) {
  const recentList = document.querySelector('[data-list="recent"]');
  const emptyMessage = '<p style="grid-column: 1 / -1; padding: 24px; text-align: center;">Chưa có sản phẩm nào khác trong lịch sử xem.</p>';

  let recentIds = getStorage(RECENT_KEY, []).filter(id => id !== product.id);
  const recentProducts = recentIds.slice(0, 4).map(id => getProductById(id));
  if (recentProducts.length > 0) {
    renderProductList('[data-list="recent"]', recentProducts);
  } else {
    recentList.innerHTML = emptyMessage;
  }

  recentIds.unshift(product.id);
  setStorage(RECENT_KEY, recentIds.slice(0, 8));

  document.querySelector('[data-recent-clear]').addEventListener('click', () => {
    localStorage.removeItem(RECENT_KEY);
    recentList.innerHTML = emptyMessage;
    showToast('Đã xoá lịch sử xem sản phẩm.');
  });
}
