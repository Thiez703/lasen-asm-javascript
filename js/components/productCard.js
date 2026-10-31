import { addToCart } from '../services/cartService.js';
import { isFavorite } from '../services/favoriteService.js';
import { requireLogin } from '../services/accountService.js';
import { formatPrice, getPrice } from '../utils/price.js';

export function createStars(rating) {
  return '<svg class="rating__star"><use href="#i-star"></use></svg>'.repeat(Math.round(rating));
}

export function createProductCard(product) {
  const price = getPrice(product);
  const isSale = price < product.price;
  const badgeHTML = product.badge ? `<span class="badge card__badge">${product.badge}</span>` : '';
  const oldPriceHTML = isSale ? `<s class="card__price-old">${formatPrice(product.price)}</s>` : '';
  const heartClass = isFavorite(product.id) ? 'is-active' : '';

  return `
    <article class="card">
      <a class="card__media" href="product-detail.html?id=${product.id}" tabindex="-1">
        <img class="card__img" src="${product.image}" alt="${product.name}" loading="lazy">
        ${badgeHTML}
        <span class="card__quick">${product.quickInfo}</span>
      </a>
      <div class="card__body">
        <h3 class="card__name"><a href="product-detail.html?id=${product.id}">${product.name}</a></h3>
        <p class="card__meta">${product.brandName} • ${product.capacity}</p>
        <p class="rating">
          <span class="rating__stars" aria-hidden="true">${createStars(product.rating)}</span>
          <span class="rating__value">${product.rating}</span>
          <span class="rating__count">(${product.ratingCount})</span>
        </p>
        <p class="card__price ${isSale ? 'card__price--sale' : ''}">
          <span class="card__price-now">${formatPrice(price)}</span>
          ${oldPriceHTML}
        </p>
        <div class="card__actions">
          <button class="btn btn--primary" type="button" data-add-to-cart data-id="${product.id}">Thêm vào giỏ</button>
          <button class="btn btn--outline btn--icon ${heartClass}" type="button" aria-label="Yêu thích" data-favorite-toggle data-id="${product.id}">
            <svg class="icon" aria-hidden="true"><use href="#i-heart"></use></svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

export function renderProductList(selector, list) {
  const container = document.querySelector(selector);
  if (container) {
    container.innerHTML = list.map(product => createProductCard(product)).join('');
  }
}

export function initAddToCartButtons() {
  document.addEventListener('click', event => {
    const cartButton = event.target.closest('.card [data-add-to-cart]');
    if (cartButton && requireLogin()) {
      addToCart(cartButton.getAttribute('data-id'), 1);
    }
  });
}
