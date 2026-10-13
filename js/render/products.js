/**
 * Render thẻ sản phẩm và các danh sách trên trang chủ / trang shop
 */

import { products } from '../services/dataService.js';
import { formatPrice, escapeHTML } from '../utils/format.js';
import { cartService } from '../services/cartService.js';
import { favoriteService } from '../services/favoriteService.js';
import { showToast } from '../services/toast.js';

/**
 * Cập nhật giao diện tất cả các nút yêu thích của một sản phẩm trên trang
 * @param {string} productId 
 * @param {boolean} isFav 
 */
function updateFavoriteButtons(productId, isFav) {
  if (typeof document === 'undefined') return;
  const buttons = document.querySelectorAll(
    `[data-favorite-toggle][data-id="${productId}"], [data-wishlist][data-id="${productId}"]`
  );
  buttons.forEach(btn => {
    btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    const label = isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.classList.toggle('is-active', isFav);
  });
}

/**
 * Gắn sự kiện click toàn cục cho nút Yêu thích trên thẻ sản phẩm và chi tiết
 */
let isFavListenerAttached = false;
function setupFavoriteListener() {
  if (isFavListenerAttached) return;
  if (typeof document === 'undefined') return;
  isFavListenerAttached = true;

  document.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-favorite-toggle], [data-wishlist]');
    if (!favBtn) return;
    e.preventDefault();

    const productId = favBtn.getAttribute('data-id');
    if (!productId) return;

    const result = favoriteService.toggleFavorite(productId);
    if (result.success) {
      showToast(result.message);
      updateFavoriteButtons(productId, result.isFavorite);
    } else {
      showToast(result.message, 'error');
    }
  });
}

/**
 * Sinh mã HTML an toàn cho thẻ sản phẩm (Card)
 * @param {Object} product 
 * @returns {string}
 */
export function createProductCard(product) {
  const isSale = typeof product.salePrice === 'number' && product.salePrice < product.price;
  const nowPrice = isSale ? product.salePrice : product.price;
  const oldPriceMarkup = isSale 
    ? `<s class="card__price-old" data-price-old>${formatPrice(product.price)}</s>` 
    : '';

  let badgeMarkup = '';
  if (product.badge) {
    badgeMarkup = `<span class="badge card__badge">${escapeHTML(product.badge)}</span>`;
  } else if (isSale) {
    const percent = Math.round((1 - product.salePrice / product.price) * 100);
    badgeMarkup = `<span class="badge card__badge">-${percent}%</span>`;
  }

  const starCount = Math.max(1, Math.min(5, Math.round(product.rating || 5)));
  const starIcons = '<svg class="rating__star"><use href="#i-star"></use></svg>'.repeat(starCount);

  const isFav = favoriteService.isFavorite(product.id);
  const favLabel = isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích';
  const favPressed = isFav ? 'true' : 'false';
  const favClass = isFav ? ' is-active' : '';

  return `
    <article class="card" data-product data-id="${escapeHTML(product.id)}">
      <a class="card__media" href="product-detail.html?id=${escapeHTML(product.id)}" tabindex="-1">
        <img class="card__img" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy">
        ${badgeMarkup}
        <span class="card__quick">${escapeHTML(product.quickInfo || '')}</span>
      </a>
      <div class="card__body">
        <h3 class="card__name"><a href="product-detail.html?id=${escapeHTML(product.id)}">${escapeHTML(product.name)}</a></h3>
        <p class="card__meta">${escapeHTML(product.brandName || 'Lá Sen')} • ${escapeHTML(product.capacity || '50ml')}</p>
        <p class="rating" data-rating="${product.rating}">
          <span class="rating__stars" aria-hidden="true">${starIcons}</span>
          <span class="rating__value">${product.rating}</span>
          <span class="rating__count">(${product.ratingCount || 0})</span>
        </p>
        <p class="card__price ${isSale ? 'card__price--sale' : ''}">
          <span class="card__price-now" data-price>${formatPrice(nowPrice)}</span>
          ${oldPriceMarkup}
        </p>
        <div class="card__actions">
          <button class="btn btn--primary" type="button" data-add-to-cart data-id="${escapeHTML(product.id)}">Thêm vào giỏ</button>
          <button class="btn btn--outline btn--icon${favClass}" type="button" aria-label="${favLabel}" title="${favLabel}" aria-pressed="${favPressed}" data-favorite-toggle data-id="${escapeHTML(product.id)}">
            <svg class="icon" aria-hidden="true"><use href="#i-heart"></use></svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Gắn sự kiện click toàn cục cho nút Thêm vào giỏ
 */
let isCartListenerAttached = false;
function setupAddToCartListener() {
  if (isCartListenerAttached) return;
  isCartListenerAttached = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add-to-cart]');
    if (!btn) return;

    // Không xử lý nếu là nút trong trang product-detail (trang detail tự quản lý ô số lượng)
    if (btn.closest('.detail__actions')) return;

    const productId = btn.getAttribute('data-id');
    if (!productId) return;

    const result = cartService.addToCart(productId, 1);
    if (result.success) {
      showToast(result.message);
    } else {
      showToast(result.message, 'error');
    }
  });
}

/**
 * Render tất cả danh sách sản phẩm theo từng vị trí trên DOM
 */
export function renderProducts() {
  setupAddToCartListener();
  setupFavoriteListener();

  // Trang chủ và các trang khác
  const flashList = document.querySelector('[data-list="flash"]');
  if (flashList) {
    // 4 sản phẩm có salePrice rẻ nhất / sale sâu nhất
    const flashProducts = [...products]
      .filter(p => p.salePrice && p.salePrice < p.price)
      .slice(0, 4);
    flashList.innerHTML = flashProducts.map(createProductCard).join('');
  }

  const hotList = document.querySelector('[data-list="hot"]');
  if (hotList) {
    const hotProducts = products.filter(p => p.isFeatured).slice(0, 4);
    hotList.innerHTML = hotProducts.map(createProductCard).join('');
  }

  const newList = document.querySelector('[data-list="new"]');
  if (newList) {
    const newProducts = products.filter(p => p.isNew).slice(0, 4);
    newList.innerHTML = newProducts.map(createProductCard).join('');
  }

  const skinList = document.querySelector('[data-list="skin"]');
  if (skinList) {
    skinList.innerHTML = products.slice(0, 5).map(createProductCard).join('');
  }
}
