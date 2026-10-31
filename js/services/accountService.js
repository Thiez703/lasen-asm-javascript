import { users } from './dataService.js';
import { getStorage, setStorage } from '../utils/storage.js';
import { showConfirm } from '../utils/dialog.js';

const USERS_KEY = 'lasen_users';
const CURRENT_USER_KEY = 'lasen_current_user';
const RETURN_PAGE_KEY = 'lasen_return_page';

export function getAccounts() {
  return getStorage(USERS_KEY, users);
}

export function getCurrentUser() {
  const userId = getStorage(CURRENT_USER_KEY, null);
  return getAccounts().find(account => account.id === userId);
}

export function login(email, password) {
  const user = getAccounts().find(account => account.email === email && account.password === password);
  if (!user) {
    return false;
  }
  setStorage(CURRENT_USER_KEY, user.id);
  return true;
}

export function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function register(newUser) {
  const accounts = getAccounts();
  const emailExists = accounts.some(account => account.email === newUser.email);
  if (emailExists) {
    return false;
  }

  newUser.id = Date.now();
  newUser.createdAt = new Date().toISOString();
  accounts.push(newUser);
  setStorage(USERS_KEY, accounts);
  return true;
}

export function updateProfile(newInfo) {
  const accounts = getAccounts();
  const userId = getStorage(CURRENT_USER_KEY, null);
  const emailExists = accounts.some(account => account.email === newInfo.email && account.id !== userId);
  if (emailExists) {
    return false;
  }

  const user = accounts.find(account => account.id === userId);
  Object.assign(user, newInfo);
  setStorage(USERS_KEY, accounts);
  return true;
}

export function getUserKey(key) {
  const user = getCurrentUser();
  if (!user) {
    return key;
  }
  return key + '_' + user.id;
}

export function requireLogin() {
  if (getCurrentUser()) {
    return true;
  }
  showConfirm({
    icon: 'i-user',
    title: 'Bạn chưa đăng nhập',
    message: 'Đăng nhập để thêm vào giỏ hàng, lưu sản phẩm yêu thích hoặc mua hàng.',
    confirmText: 'Đăng nhập',
    cancelText: 'Để sau'
  }).then(confirmed => {
    if (confirmed) {
      rememberCurrentPage();
      window.location.href = 'login.html';
    }
  });
  return false;
}

export function rememberCurrentPage() {
  sessionStorage.setItem(RETURN_PAGE_KEY, window.location.href);
}

export function getPageAfterLogin() {
  const page = sessionStorage.getItem(RETURN_PAGE_KEY) || 'profile.html';
  sessionStorage.removeItem(RETURN_PAGE_KEY);
  return page;
}
