export function getStorage(key, defaultValue) {
  const text = localStorage.getItem(key);
  if (text === null) {
    return defaultValue;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return defaultValue;
  }
}

export function setStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const OLD_KEYS = [
  'lasen_accounts',
  'lasen_session',
  'lasen_user_profile',
  'lasen_orders',
  'lasen_last_completed_order',
  'lasen_pending_cart_cleanup',
  'lasen_applied_coupon',
  'lasen_cart',
  'lasen_favorites',
  'lasen_addresses'
];

export function removeOldStorage() {
  OLD_KEYS.forEach(key => localStorage.removeItem(key));
}
