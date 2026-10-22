import { users } from './dataService.js';
import { getStorage, setStorage } from '../utils/helpers.js';

const USERS_KEY = 'lasen_users';
const CURRENT_USER_KEY = 'lasen_current_user';
const ADDRESSES_KEY = 'lasen_addresses';

// 1. Đọc danh sách tài khoản
export function getAccounts() {
  return getStorage(USERS_KEY, users);
}

// 2. Tài khoản đang đăng nhập, đăng nhập, đăng xuất và đăng ký
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

// 3. Cập nhật thông tin hồ sơ
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

// 4. Tạo khóa lưu trữ riêng cho từng tài khoản
// Ví dụ: lasen_favorites_1
export function getUserKey(key) {
  const user = getCurrentUser();
  if (!user) {
    return key;
  }
  return key + '_' + user.id;
}

// 5. Đọc và lưu sổ địa chỉ
export function getAddresses() {
  const user = getCurrentUser();
  let firstAddresses = [];
  if (user.address) {
    firstAddresses = [{
      id: 'addr-1',
      name: user.name,
      phone: user.phone,
      address: user.address,
      note: '',
      isDefault: true
    }];
  }
  return getStorage(getUserKey(ADDRESSES_KEY), firstAddresses);
}

export function saveAddresses(addresses) {
  const hasDefault = addresses.some(address => address.isDefault);
  if (addresses.length > 0 && !hasDefault) {
    addresses[0].isDefault = true;
  }
  setStorage(getUserKey(ADDRESSES_KEY), addresses);
}
