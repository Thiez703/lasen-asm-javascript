import { getProductById } from '../services/dataService.js';
import { toggleFavorite, getFavoriteProducts } from '../services/favoriteService.js';
import { requireLogin } from '../services/accountService.js';
import { renderProductList } from './productCard.js';
import { showToast } from '../utils/toast.js';

export function initFavoriteButtons() {
  document.addEventListener('click', event => {
    const heartButton = event.target.closest('[data-favorite-toggle], [data-wishlist]');
    if (heartButton && requireLogin()) {
      onHeartClick(heartButton.getAttribute('data-id'));
    }
  });
}

function onHeartClick(productId) {
  const product = getProductById(productId);
  const liked = toggleFavorite(productId);

  if (liked) {
    showToast(`Đã thêm "${product.name}" vào danh sách yêu thích!`);
  } else {
    showToast(`Đã bỏ "${product.name}" khỏi danh sách yêu thích.`);
  }

  document.querySelectorAll('[data-favorite-toggle], [data-wishlist]').forEach(button => {
    if (button.getAttribute('data-id') === productId) {
      button.classList.toggle('is-active', liked);
    }
  });

  renderWishlist();
}

export function renderWishlist() {
  if (!document.querySelector('[data-list="wishlist"]')) return;

  const favorites = getFavoriteProducts();
  renderProductList('[data-list="wishlist"]', favorites);
  document.querySelector('[data-wishlist-count]').textContent = favorites.length;
  document.querySelector('[data-wishlist-empty]').classList.toggle('is-hidden', favorites.length > 0);
}
