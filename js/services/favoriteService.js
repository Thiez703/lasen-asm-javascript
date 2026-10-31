import { getProductById } from './dataService.js';
import { getCurrentUser, getUserKey } from './accountService.js';
import { getStorage, setStorage } from '../utils/storage.js';

const FAVORITES_KEY = 'lasen_favorites';

function getFavoriteIds() {
  if (!getCurrentUser()) {
    return [];
  }
  return getStorage(getUserKey(FAVORITES_KEY), []);
}

export function isFavorite(productId) {
  return getFavoriteIds().includes(productId);
}

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
