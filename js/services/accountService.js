import { storage } from './storage.js';
import { validation } from '../modules/validation.js';

export const PROFILE_KEY = 'lasen_user_profile'; // Giữ tương thích với mã cũ.
export const ACCOUNTS_KEY = 'lasen_accounts';
export const SESSION_KEY = 'lasen_session';

// Tài khoản cố định để thử nghiệm. Chỉ tài khoản này dùng mật khẩu mẫu trong mã nguồn.
export const DEMO_ACCOUNT = Object.freeze({
  id: 1,
  name: 'Nguyễn Văn A',
  email: 'nguyenvana@gmail.com',
  phone: '0901234567',
  password: 'password123',
  createdAt: '2025-03-01T00:00:00.000Z'
});

const PASSWORD_ITERATIONS = 120000;
const STORAGE_ERROR = 'Không thể đọc hoặc lưu tài khoản. Vui lòng cho phép lưu trữ trên trình duyệt rồi thử lại.';
const text = value => typeof value === 'string' ? value.trim() : '';
const normalizeEmail = value => text(value).toLowerCase();

// Đọc nghiêm ngặt để không ghi đè danh sách tài khoản nếu dữ liệu cũ bị lỗi.
function readAccounts() {
  const raw = window.localStorage.getItem(ACCOUNTS_KEY);
  if (raw === null) return [];
  const accounts = JSON.parse(raw);
  if (!Array.isArray(accounts) || accounts.some(account =>
    !account || typeof account !== 'object' ||
    !(account.id === 1 || (typeof account.id === 'string' && /^user-[a-z0-9-]+$/.test(account.id))) ||
    !text(account.name) || !validation.isValidEmail(account.email) ||
    (account.id !== 1 && (!/^[a-f0-9]{64}$/.test(account.passwordHash) ||
      !/^[a-f0-9]{32}$/.test(account.passwordSalt) ||
      !Number.isInteger(account.passwordIterations) || account.passwordIterations < 10000 || account.passwordIterations > 1000000))
  )) throw new Error('Dữ liệu tài khoản không hợp lệ.');
  return accounts;
}

function allAccounts(accounts) {
  const { password, ...demo } = DEMO_ACCOUNT;
  return [{ ...demo, ...accounts.find(account => account.id === 1) }, ...accounts.filter(account => account.id !== 1)];
}

// Chỉ trả thông tin hồ sơ, không đưa thông tin xác thực vào UI hoặc phiên đăng nhập.
function publicProfile(account) {
  return {
    id: account.id,
    name: text(account.name),
    hoTen: text(account.name),
    phone: text(account.phone),
    soDienThoai: text(account.phone),
    email: normalizeEmail(account.email),
    birth: text(account.birth),
    skin: text(account.skin),
    gender: ['nu', 'nam', 'khac'].includes(account.gender) ? account.gender : 'nu',
    nhanBanTin: Boolean(account.nhanBanTin),
    createdAt: text(account.createdAt)
  };
}

function emit(name) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(name));
  }
}

export function getCurrentUser() {
  try {
    const session = JSON.parse(window.localStorage.getItem(SESSION_KEY));
    if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
    const account = allAccounts(readAccounts()).find(item => item.id === session.userId);
    return account ? publicProfile(account) : null;
  } catch {
    return null;
  }
}

export function getAccountProfile() {
  return getCurrentUser() || {};
}

/** Giữ dữ liệu cũ cho tài khoản mẫu; tài khoản mới có vùng lưu riêng. */
export function getAccountStorageKey(baseKey) {
  const user = getCurrentUser();
  return user && user.id !== 1 ? `${baseKey}_${user.id}` : baseKey;
}

function validateProfile(input) {
  const errors = {};
  if (text(input.name).length < 2) errors.name = 'Vui lòng nhập họ và tên có ít nhất 2 ký tự.';
  if (!validation.isValidPhone(input.phone)) errors.phone = 'Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số).';
  if (!validation.isValidEmail(input.email)) errors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
  return errors;
}

function emailTaken(accounts, email, exceptId) {
  return (email === DEMO_ACCOUNT.email && exceptId !== 1) ||
    allAccounts(accounts).some(account => account.id !== exceptId && normalizeEmail(account.email) === email);
}

function cryptoAPI() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Vui lòng chạy trang bằng Live Server (localhost) hoặc HTTPS để sử dụng đăng ký, đăng nhập.');
  }
  return globalThis.crypto;
}

const toHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, salt, iterations) {
  const api = cryptoAPI();
  const saltBytes = Uint8Array.from(salt.match(/.{2}/g), byte => parseInt(byte, 16));
  const key = await api.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await api.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, key, 256);
  return toHex(new Uint8Array(bits));
}

export async function registerAccount(input = {}) {
  const errors = validateProfile(input);
  if (typeof input.password !== 'string' || input.password.length < 8) errors.password = 'Mật khẩu cần ít nhất 8 ký tự.';
  if (input.confirmPassword !== input.password || typeof input.confirmPassword !== 'string') errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
  if (Object.keys(errors).length) return { success: false, errors };

  try {
    const email = normalizeEmail(input.email);
    if (emailTaken(readAccounts(), email)) return { success: false, errors: { email: 'Email này đã được đăng ký.' } };
    const api = cryptoAPI();
    const passwordSalt = toHex(api.getRandomValues(new Uint8Array(16)));
    const passwordHash = await hashPassword(input.password, passwordSalt, PASSWORD_ITERATIONS);
    // Đọc lại sau bước băm bất đồng bộ để giữ tài khoản vừa đăng ký ở tab khác.
    const accounts = readAccounts();
    if (emailTaken(accounts, email)) return { success: false, errors: { email: 'Email này đã được đăng ký.' } };
    const account = {
      id: `user-${api.randomUUID()}`,
      name: text(input.name),
      phone: text(input.phone).replace(/[\s.-]/g, ''),
      email,
      passwordHash,
      passwordSalt,
      passwordIterations: PASSWORD_ITERATIONS,
      createdAt: new Date().toISOString()
    };
    if (!storage.set(ACCOUNTS_KEY, [...accounts, account])) return { success: false, error: STORAGE_ERROR };
    return { success: true, user: publicProfile(account) };
  } catch (error) {
    return { success: false, error: globalThis.crypto?.subtle ? STORAGE_ERROR : error.message };
  }
}

export async function loginAccount(input = {}) {
  const errors = {};
  if (!validation.isValidEmail(input.email)) errors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (typeof input.password !== 'string' || !input.password) errors.password = 'Vui lòng nhập mật khẩu.';
  if (Object.keys(errors).length) return { success: false, errors };

  try {
    const email = normalizeEmail(input.email);
    const accounts = allAccounts(readAccounts());
    const account = email === DEMO_ACCOUNT.email ? accounts[0] : accounts.find(item => normalizeEmail(item.email) === email);
    const valid = account && (account.id === 1
      ? input.password === DEMO_ACCOUNT.password
      : await hashPassword(input.password, account.passwordSalt, account.passwordIterations) === account.passwordHash);
    if (!valid) return { success: false, error: 'Email hoặc mật khẩu chưa đúng.' };
    const current = allAccounts(readAccounts()).find(item => item.id === account.id);
    if (!current) return { success: false, error: 'Email hoặc mật khẩu chưa đúng.' };
    if (!storage.set(SESSION_KEY, { userId: current.id })) return { success: false, error: STORAGE_ERROR };
    emit('auth:changed');
    return { success: true, user: publicProfile(current) };
  } catch (error) {
    return { success: false, error: globalThis.crypto?.subtle ? STORAGE_ERROR : error.message };
  }
}

export function logoutAccount() {
  if (!storage.remove(SESSION_KEY)) return { success: false, error: STORAGE_ERROR };
  emit('auth:changed');
  return { success: true };
}

export function updateAccountProfile(input = {}) {
  const user = getCurrentUser();
  if (!user) return { success: false, error: 'Vui lòng đăng nhập để lưu hồ sơ.' };
  const errors = validateProfile(input);
  if (Object.keys(errors).length) return { success: false, errors };

  try {
    const accounts = readAccounts();
    const email = normalizeEmail(input.email);
    if (emailTaken(accounts, email, user.id)) return { success: false, errors: { email: 'Email này đã được đăng ký.' } };
    const account = allAccounts(accounts).find(item => item.id === user.id);
    const updated = {
      ...account,
      name: text(input.name),
      phone: text(input.phone).replace(/[\s.-]/g, ''),
      email,
      birth: text(input.birth ?? input.ngaySinh ?? account.birth),
      skin: text(input.skin ?? input.loaiDa ?? account.skin),
      gender: input.gender ?? input.gioiTinh ?? account.gender,
      nhanBanTin: input.nhanBanTin ?? account.nhanBanTin
    };
    const next = [...accounts.filter(item => item.id !== user.id), updated];
    if (!storage.set(ACCOUNTS_KEY, next)) return { success: false, error: STORAGE_ERROR };
    emit('profile:updated');
    return { success: true, user: publicProfile(updated) };
  } catch {
    return { success: false, error: STORAGE_ERROR };
  }
}
