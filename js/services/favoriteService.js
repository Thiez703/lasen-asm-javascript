import { getProductById } from './dataService.js';
import { getUserKey } from './accountService.js';
import { getStorage, setStorage } from '../utils/helpers.js';

const FAVORITES_KEY = 'lasen_favorites';

function getFavoriteIds() {
  return getStorage(getUserKey(FAVORITES_KEY), []);
}

export function isFavorite(productId) {
  return getFavoriteIds().includes(productId);
}

// Đang thích thì bỏ thích, chưa thích thì thêm vào. Trả về true nếu sản phẩm đang được thích
export function toggleFavorite(productId) {
  let ids = getFavoriteIds();
  if (ids.includes(productId)) {
    ids = ids.filter(id => id !== productId);
  } else {
    ids.push(productId);
  }
  setStorage(getUserKey(FAVORITES_KEY), ids);
  return ids.includes(productId);
}

export function getFavoriteProducts() {
  return getFavoriteIds().map(id => getProductById(id));
}
