/**
 * Render trang Tài khoản cá nhân (profile.html)
 * Hiển thị hồ sơ của tài khoản đang đăng nhập và xử lý tương tác các tab
 */

import { getProductById } from '../services/dataService.js';
import { getAccountProfile, getCurrentUser, getAccountStorageKey, updateAccountProfile, logoutAccount, PROFILE_KEY } from '../services/accountService.js';
import { loadSampleOrders, getSampleOrders } from '../services/orderService.js';
import { formatPrice, escapeHTML } from '../utils/format.js';
import { storage } from '../services/storage.js';
import { showToast } from '../services/toast.js';
import { cartService } from '../services/cartService.js';
import { validateAndSanitizeOrder, ORDERS_KEY } from '../services/checkoutService.js';
import { createProductCard } from './products.js';
import { favoriteService } from '../services/favoriteService.js';
import { validation } from '../modules/validation.js';

export { PROFILE_KEY };

const getAddressesKey = () => getAccountStorageKey('lasen_addresses');

function requireProfileAccount() {
  const user = getCurrentUser();
  if (!user) {
    window.location.replace('login.html?redirect=profile.html');
  }
  return user;
}

/**
 * Chuẩn hóa trạng thái đơn hàng sang canonical key và nhãn tiếng Việt chuẩn
 * Xử lý an toàn conservative cho mọi trường hợp dữ liệu
 * @param {string} rawStatus
 * @returns {{ key: string, label: string, badgeClass: string }}
 */
export function normalizeOrderStatus(rawStatus) {
  if (!rawStatus || typeof rawStatus !== 'string') {
    return { key: 'cho-xac-nhan', label: 'Chờ xác nhận', badgeClass: 'badge--soft' };
  }
  const clean = rawStatus.trim().toLowerCase();

  if (clean === 'tat-ca' || clean === 'tất cả') {
    return { key: 'tat-ca', label: 'Tất cả', badgeClass: 'badge--soft' };
  }
  if (clean === 'cho-xac-nhan' || clean === 'chờ xác nhận' || clean === 'pending') {
    return { key: 'cho-xac-nhan', label: 'Chờ xác nhận', badgeClass: 'badge--soft' };
  }
  if (clean === 'dang-giao' || clean === 'đang giao' || clean === 'đang vận chuyển' || clean === 'shipping') {
    return { key: 'dang-giao', label: 'Đang giao', badgeClass: 'badge--info' };
  }
  if (clean === 'da-giao' || clean === 'đã giao' || clean === 'đã giao hàng' || clean === 'delivered' || clean === 'completed') {
    return { key: 'da-giao', label: 'Đã giao', badgeClass: 'badge--success' };
  }
  if (clean === 'da-huy' || clean === 'đã huỷ' || clean === 'đã hủy' || clean === 'cancelled' || clean === 'canceled') {
    return { key: 'da-huy', label: 'Đã huỷ', badgeClass: 'badge--danger' };
  }

  // Fallback an toàn cho trạng thái không nằm trong danh mục chuẩn
  return { key: 'khac', label: rawStatus.trim(), badgeClass: 'badge--soft' };
}

/**
 * Nạp metadata các trạng thái đơn từ file JSON thực tế (Single Source of Truth)
 * @param {string} url
 * @returns {Promise<Array<{key: string, label: string}>>}
 */
export async function loadOrderStatuses(url = 'js/data/order-statuses.json') {
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (isNode) {
    try {
      if (process.getBuiltinModule) {
        const fs = process.getBuiltinModule('node:fs');
        const path = process.getBuiltinModule('node:path');
        const jsonPath = path.resolve(process.cwd(), 'js', 'data', 'order-statuses.json');
        if (fs.existsSync(jsonPath)) {
          const nodeData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (Array.isArray(nodeData) && nodeData.length > 0) {
            return nodeData;
          }
        }
      }
    } catch (err) {}
    return [];
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Tải order-statuses.json thất bại (HTTP ${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data;
    }
  } catch (err) {
    console.warn('Lỗi khi nạp order-statuses.json:', err);
  }
  return [];
}

const DEFAULT_ADDRESSES = [
  {
    id: 'addr-1',
    name: 'Nguyễn Thị Lan',
    phone: '0912 345 678',
    address: '45/3 Nguyễn Văn Cừ, phường An Hoà, quận Ninh Kiều, TP. Cần Thơ',
    note: 'Nhà riêng — hẻm nhỏ, nhờ shipper gọi trước khi tới.',
    isDefault: true
  }
];

/**
 * Cờ module theo dõi trạng thái đọc/seed dữ liệu từ storage
 */
let isLastReadFailed = false;
let isSeedPersisted = true;
let addressOwnerId = null;

/**
 * Chuẩn hoá danh sách địa chỉ, lọc item lỗi, xử lý trùng lặp id ổn định và đảm bảo semantics default
 * Không truncate danh sách nếu dữ liệu có sẵn đã vượt quá 5
 */
function sanitizeAddressList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seenIds = new Set();
  const result = [];
  let hasDefault = false;

  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const phone = typeof raw.phone === 'string' ? raw.phone.trim() : '';
    const address = typeof raw.address === 'string' ? raw.address.trim() : '';
    const note = typeof raw.note === 'string' ? raw.note.trim() : '';
    const isDefault = Boolean(raw.isDefault);
    if (!name || !phone || !address) continue;

    const id = (typeof raw.id === 'string' && raw.id.trim().length > 0)
      ? raw.id.trim()
      : `addr-${Date.now()}`;
    const clean = { id, name, phone, address, note, isDefault };

    // Xử lý duplicate ID ổn định (deterministic & stable)
    if (seenIds.has(clean.id)) {
      let counter = 1;
      let candidate = `${clean.id}-${counter}`;
      while (seenIds.has(candidate)) {
        counter++;
        candidate = `${clean.id}-${counter}`;
      }
      clean.id = candidate;
    }
    seenIds.add(clean.id);

    if (clean.isDefault) {
      if (!hasDefault) {
        hasDefault = true;
      } else {
        clean.isDefault = false;
      }
    }

    result.push(clean);
  }

  if (result.length > 0 && !hasDefault) {
    result[0].isDefault = true;
  }

  return result;
}

/**
 * Lấy danh sách địa chỉ từ localStorage
 * Bọc an toàn cả getter window.localStorage lẫn getItem
 * Phân biệt rõ missing vs read fail để không seed/overwrite dữ liệu không đọc được
 */
function getAddresses() {
  addressOwnerId = getCurrentUser()?.id ?? null;
  // Đọc raw an toàn, kể cả khi getter localStorage hoặc getItem ném lỗi.
  let readRes;
  try {
    if (typeof window === 'undefined') {
      readRes = { ok: false, value: null, reason: 'NO_WINDOW' };
    } else {
      const ls = window.localStorage;
      if (!ls) {
        readRes = { ok: false, value: null, reason: 'NO_STORAGE' };
      } else {
        readRes = { ok: true, value: ls.getItem(getAddressesKey()) };
      }
    }
  } catch (err) {
    readRes = { ok: false, value: null, reason: 'READ_FAIL', error: err };
  }

  // 1. Trường hợp đọc thất bại (SecurityError / Blocked / Throw): không seed, không overwrite
  if (!readRes.ok) {
    isLastReadFailed = true;
    isSeedPersisted = false;
    console.warn('Lỗi khi đọc storage addresses:', readRes.error || readRes.reason);
    return [];
  }

  isLastReadFailed = false;

  // 2. Trường hợp missing thực sự: key chưa từng tồn tại
  if (readRes.value === null) {
    const seeded = String(getCurrentUser()?.id) === '1'
      ? DEFAULT_ADDRESSES.map(a => ({ ...a }))
      : [];
    const writeOk = storage.set(getAddressesKey(), seeded);
    if (!writeOk) {
      isSeedPersisted = false;
      console.warn('Seed địa chỉ mặc định không thể ghi vào storage.');
    } else {
      isSeedPersisted = true;
    }
    return seeded;
  }

  // 3. Key đã tồn tại (chuỗi rỗng "[]", chuỗi JSON mảng, hoặc chuỗi malformed)
  isSeedPersisted = true;
  let parsed = null;
  try {
    parsed = JSON.parse(readRes.value);
  } catch (err) {
    console.warn('Dữ liệu JSON addresses trong storage bị malformed:', err);
    parsed = null;
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return sanitizeAddressList(parsed);
}

/**
 * Lưu danh sách địa chỉ vào localStorage
 */
function saveAddresses(addresses) {
  const sanitized = sanitizeAddressList(addresses);
  if (String(getCurrentUser()?.id ?? '') !== String(addressOwnerId ?? '')) {
    return { success: false, addresses: sanitized };
  }
  const success = storage.set(getAddressesKey(), sanitized);
  return { success, addresses: sanitized };
}

/**
 * Thêm mới hoặc cập nhật địa chỉ
 * Chặn ghi đè khi read failed
 */
function saveOrUpdateAddress(addressData, currentList) {
  if (isLastReadFailed) {
    return { success: false, error: 'READ_FAILED' };
  }

  const list = [...(currentList || getAddresses())];

  if (isLastReadFailed) {
    return { success: false, error: 'READ_FAILED' };
  }

  const isEditing = Boolean(addressData.id);

  if (isEditing) {
    const index = list.findIndex(item => item.id === addressData.id);
    if (index === -1) {
      return { success: false, error: 'NOT_FOUND' };
    }

    const updated = {
      ...list[index],
      name: addressData.name,
      phone: addressData.phone,
      address: addressData.address,
      note: addressData.note || '',
      isDefault: Boolean(addressData.isDefault)
    };

    if (updated.isDefault) {
      list.forEach((it, i) => {
        if (i !== index) it.isDefault = false;
      });
    } else {
      if (list.length === 1) {
        updated.isDefault = true;
      } else {
        const hasOtherDefault = list.some((it, i) => i !== index && it.isDefault);
        if (!hasOtherDefault) {
          const otherIndex = list.findIndex((_, i) => i !== index);
          if (otherIndex !== -1) list[otherIndex].isDefault = true;
        }
      }
    }
    list[index] = updated;
  } else {
    if (list.length >= 5) {
      return { success: false, error: 'LIMIT_REACHED' };
    }

    const newId = `addr-${Date.now()}`;
    const willBeDefault = list.length === 0 || Boolean(addressData.isDefault);

    if (willBeDefault) {
      list.forEach(it => { it.isDefault = false; });
    }

    const newItem = {
      id: newId,
      name: addressData.name,
      phone: addressData.phone,
      address: addressData.address,
      note: addressData.note || '',
      isDefault: willBeDefault
    };
    list.push(newItem);
  }

  const saveRes = saveAddresses(list);
  if (!saveRes.success) {
    return { success: false, error: 'STORAGE_FAILED' };
  }

  return { success: true, addresses: saveRes.addresses, isEditing };
}

/**
 * Xoá một địa chỉ theo id
 * Chặn ghi đè khi read failed
 */
function deleteAddressById(id, currentList) {
  if (isLastReadFailed) {
    return { success: false, error: 'READ_FAILED' };
  }

  const list = [...(currentList || getAddresses())];

  if (isLastReadFailed) {
    return { success: false, error: 'READ_FAILED' };
  }

  const targetIndex = list.findIndex(item => item.id === id);
  if (targetIndex === -1) {
    return { success: false, error: 'NOT_FOUND' };
  }

  const wasDefault = list[targetIndex].isDefault;
  list.splice(targetIndex, 1);

  if (wasDefault && list.length > 0) {
    list[0].isDefault = true;
  }

  const saveRes = saveAddresses(list);
  if (!saveRes.success) {
    return { success: false, error: 'STORAGE_FAILED' };
  }

  return { success: true, addresses: saveRes.addresses };
}

/**
 * Render danh sách thẻ địa chỉ vào DOM
 */
function renderAddressList(addresses) {
  const listContainer = document.querySelector('[data-list="addresses"]');
  const emptyState = document.querySelector('[data-addresses-empty]');
  const countBadge = document.querySelector('[data-addresses-count]');

  if (countBadge) {
    countBadge.textContent = String(addresses.length);
  }

  if (!listContainer) return;

  if (addresses.length === 0) {
    listContainer.innerHTML = '';
    listContainer.classList.add('is-hidden');
    if (emptyState) {
      emptyState.classList.remove('is-hidden');
    }
    return;
  }

  listContainer.classList.remove('is-hidden');
  if (emptyState) {
    emptyState.classList.add('is-hidden');
  }

  listContainer.innerHTML = addresses.map(addr => `
    <article class="address ${addr.isDefault ? 'address--default' : ''}" data-address data-id="${escapeHTML(addr.id)}">
      <div class="address__head">
        <h3 class="address__name">${escapeHTML(addr.name)}</h3>
        ${addr.isDefault ? '<span class="badge badge--soft">Mặc định</span>' : ''}
      </div>
      <p class="address__line">
        <svg class="icon" aria-hidden="true"><use href="#i-phone"></use></svg>
        ${escapeHTML(addr.phone)}
      </p>
      <p class="address__line">
        <svg class="icon" aria-hidden="true"><use href="#i-pin"></use></svg>
        ${escapeHTML(addr.address)}
      </p>
      ${addr.note ? `<p class="address__note">${escapeHTML(addr.note)}</p>` : ''}
      <div class="address__actions">
        <button class="btn btn--ghost btn--sm" type="button" data-address-edit data-id="${escapeHTML(addr.id)}">
          <svg class="icon" aria-hidden="true"><use href="#i-pencil"></use></svg>
          Sửa
        </button>
        <button class="btn btn--ghost btn--sm address__remove" type="button" data-address-delete data-id="${escapeHTML(addr.id)}" aria-label="Xoá địa chỉ">
          <svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>
          Xoá
        </button>
      </div>
    </article>
  `).join('');
}

export function renderProfile() {
  if (!document.querySelector('[data-account-tabs]')) return;

  const account = requireProfileAccount();
  if (!account) return;

  // Khôi phục từ back/forward cache hoặc thay phiên ở tab khác cũng phải kiểm tra lại.
  const checkAccount = () => {
    const current = requireProfileAccount();
    if (!current) return false;
    if (String(current.id) !== String(account.id)) {
      window.location.reload();
      return false;
    }
    return true;
  };
  window.addEventListener('pageshow', checkAccount);
  window.addEventListener('storage', checkAccount);
  window.addEventListener('auth:changed', checkAccount);

  const effectiveUser = getAccountProfile();

  // 1. Điền vào form từ cùng nguồn dữ liệu với header và thẻ tài khoản.
  const hoTenInput = document.querySelector('[data-input="hoTen"]');
  if (hoTenInput) hoTenInput.value = effectiveUser.name;

  const sdtInput = document.querySelector('[data-input="soDienThoai"]');
  if (sdtInput) sdtInput.value = effectiveUser.phone;

  const emailInput = document.querySelector('[data-input="email"]');
  if (emailInput) emailInput.value = effectiveUser.email || '';

  const birthInput = document.querySelector('[data-input="ngaySinh"]');
  if (birthInput) birthInput.value = effectiveUser.birth || effectiveUser.ngaySinh || '';

  const skinSelect = document.querySelector('[data-input="loaiDa"]');
  if (skinSelect) skinSelect.value = effectiveUser.skin || effectiveUser.loaiDa || '';

  const genderVal = effectiveUser.gender || effectiveUser.gioiTinh || 'nu';
  const genderRadio = document.querySelector(`input[name="gioiTinh"][value="${genderVal}"]`);
  if (genderRadio) genderRadio.checked = true;

  const newsletterCb = document.querySelector('[data-input="nhanBanTin"]');
  if (newsletterCb && effectiveUser.nhanBanTin !== undefined) {
    newsletterCb.checked = Boolean(effectiveUser.nhanBanTin);
  }

  // 2. Render danh sách sản phẩm yêu thích thực tế
  renderWishlist();

  // Đồng bộ danh sách yêu thích mỗi khi có cập nhật
  if (typeof window !== 'undefined') {
    window.addEventListener('favorites:updated', () => {
      renderWishlist();
    });
  }

  // 3. Render danh sách đơn hàng và gắn bộ lọc trạng thái
  renderUserOrders(effectiveUser);

  // 4. Khởi tạo chuyển Tabs (Hồ sơ, Đơn hàng, Sổ địa chỉ, Yêu thích)
  {
    const tabList = document.querySelector('[data-account-tabs]');
    if (tabList) {
      const tabBtns = tabList.querySelectorAll('[data-account-tab]');
      const panels = document.querySelectorAll('[data-account-panel]');

      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tabId = btn.getAttribute('data-account-tab');

          tabBtns.forEach(b => {
            b.classList.remove('is-active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');

          panels.forEach(panel => {
            const panelId = panel.getAttribute('data-account-panel');
            if (panelId === tabId) {
              panel.style.display = 'block';
              panel.classList.remove('is-hidden');
            } else {
              panel.style.display = 'none';
              panel.classList.add('is-hidden');
            }
          });
        });
      });
    }
  }

  // 5. Xử lý nộp và hoàn tác form hồ sơ kèm validation & persistence
  const profileForm = document.querySelector('[data-profile-form]');
  if (profileForm) {
    [hoTenInput, sdtInput, emailInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => validation.clearError(inp));
      }
    });

    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!checkAccount()) return;
      validation.clearAllErrors(profileForm);

      const nameVal = hoTenInput ? hoTenInput.value.trim() : '';
      const phoneVal = sdtInput ? sdtInput.value.trim() : '';
      const emailVal = emailInput ? emailInput.value.trim() : '';
      const birthVal = (birthInput ? birthInput.value : '').trim();
      const skinVal = (skinSelect ? skinSelect.value : '').trim();
      const curGender = document.querySelector('input[name="gioiTinh"]:checked')?.value || 'nu';
      const curNews = newsletterCb ? newsletterCb.checked : true;

      let hasError = false;
      let firstErrorField = null;

      if (!validation.isRequired(nameVal) || nameVal.length < 2) {
        validation.showError(hoTenInput, 'Vui lòng nhập họ và tên đầy đủ (tối thiểu 2 ký tự).');
        if (!firstErrorField) firstErrorField = hoTenInput;
        hasError = true;
      }

      if (!validation.isValidPhone(phoneVal)) {
        validation.showError(sdtInput, 'Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số).');
        if (!firstErrorField) firstErrorField = sdtInput;
        hasError = true;
      }

      if (!validation.isValidEmail(emailVal)) {
        validation.showError(emailInput, 'Vui lòng nhập địa chỉ email hợp lệ.');
        if (!firstErrorField) firstErrorField = emailInput;
        hasError = true;
      }

      if (hasError) {
        if (firstErrorField) firstErrorField.focus();
        showToast('Vui lòng kiểm tra lại thông tin hồ sơ còn thiếu hoặc sai định dạng.', 'error');
        return;
      }

      const updated = {
        name: nameVal,
        hoTen: nameVal,
        phone: phoneVal,
        soDienThoai: phoneVal,
        email: emailVal,
        birth: birthVal,
        ngaySinh: birthVal,
        skin: skinVal,
        loaiDa: skinVal,
        gender: curGender,
        gioiTinh: curGender,
        nhanBanTin: curNews
      };

      const result = updateAccountProfile(updated);
      if (!result.success) {
        const fields = { name: hoTenInput, phone: sdtInput, email: emailInput };
        let firstInvalid = null;
        Object.entries(result.errors || {}).forEach(([key, message]) => {
          if (fields[key]) {
            validation.showError(fields[key], message);
            if (!firstInvalid) firstInvalid = fields[key];
          }
        });
        firstInvalid?.focus();
        showToast(result.error || (firstInvalid
          ? 'Vui lòng kiểm tra lại thông tin hồ sơ.'
          : 'Không thể lưu thông tin hồ sơ do lỗi bộ nhớ trình duyệt.'), 'error');
        return;
      }

      showToast('Đã lưu thông tin hồ sơ thành công!');
    });

    const resetBtn = profileForm.querySelector('[data-profile-reset]');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!checkAccount()) return;
        validation.clearAllErrors(profileForm);
        const curr = getAccountProfile();
        if (hoTenInput) hoTenInput.value = curr.name;
        if (sdtInput) sdtInput.value = curr.phone;
        if (emailInput) emailInput.value = curr.email || '';
        if (birthInput) birthInput.value = curr.birth || curr.ngaySinh || '';
        if (skinSelect) skinSelect.value = curr.skin || curr.loaiDa || '';
        const gr = document.querySelector(`input[name="gioiTinh"][value="${curr.gender || curr.gioiTinh || 'nu'}"]`);
        if (gr) gr.checked = true;
        if (newsletterCb) newsletterCb.checked = curr.nhanBanTin !== false;
        showToast('Đã hoàn tác thông tin hồ sơ về trạng thái đã lưu.');
      });
    }
  }

  // 6. Khởi tạo sổ địa chỉ (Thêm, Sửa, Xoá)
  try {
    const addressPanel = document.querySelector('[data-account-panel="dia-chi"]');
    if (addressPanel) {
      let addresses = getAddresses();

      if (isLastReadFailed) {
        showToast('Không thể truy cập dữ liệu sổ địa chỉ do lỗi bộ nhớ trình duyệt.', 'error');
      } else if (!isSeedPersisted) {
        showToast('Không thể lưu dữ liệu địa chỉ mẫu ban đầu do lỗi bộ nhớ trình duyệt.', 'error');
      }

      renderAddressList(addresses);

      const formBox = addressPanel.querySelector('[data-address-form-box]');
      const formTitle = addressPanel.querySelector('[data-address-form-title]');
      const form = addressPanel.querySelector('[data-address-form]');
      const idInput = form?.querySelector('[data-address-input="id"]');
      const nameInput = form?.querySelector('[data-address-input="name"]');
      const phoneInput = form?.querySelector('[data-address-input="phone"]');
      const addressInput = form?.querySelector('[data-address-input="address"]');
      const noteInput = form?.querySelector('[data-address-input="note"]');
      const defaultInput = form?.querySelector('[data-address-input="isDefault"]');
      const cancelBtn = form?.querySelector('[data-address-cancel]');
      const listContainer = addressPanel.querySelector('[data-list="addresses"]');

      function openForm(editItem = null) {
        if (!formBox) return;

        if (isLastReadFailed) {
          showToast('Không thể mở biểu mẫu do không đọc được bộ nhớ trình duyệt.', 'error');
          return;
        }

        if (!editItem && addresses.length >= 5) {
          showToast('Bạn chỉ có thể lưu tối đa 5 địa chỉ.', 'error');
          return;
        }

        if (form) {
          validation.clearAllErrors(form);
        }

        if (editItem) {
          if (formTitle) formTitle.textContent = 'Chỉnh sửa địa chỉ';
          if (idInput) idInput.value = editItem.id;
          if (nameInput) nameInput.value = editItem.name;
          if (phoneInput) phoneInput.value = editItem.phone;
          if (addressInput) addressInput.value = editItem.address;
          if (noteInput) noteInput.value = editItem.note || '';
          if (defaultInput) {
            defaultInput.checked = Boolean(editItem.isDefault);
            defaultInput.disabled = (addresses.length <= 1);
          }
        } else {
          if (formTitle) formTitle.textContent = 'Thêm địa chỉ mới';
          if (idInput) idInput.value = '';
          if (nameInput) nameInput.value = '';
          if (phoneInput) phoneInput.value = '';
          if (addressInput) addressInput.value = '';
          if (noteInput) noteInput.value = '';
          if (defaultInput) {
            defaultInput.checked = (addresses.length === 0);
            defaultInput.disabled = (addresses.length === 0);
          }
        }

        formBox.classList.remove('is-hidden');
        nameInput?.focus();
      }

      function closeForm() {
        if (!formBox) return;
        formBox.classList.add('is-hidden');
        if (form) {
          validation.clearAllErrors(form);
          if (typeof form.reset === 'function') {
            form.reset();
          }
        }
      }

      // Gắn sự kiện nút Thêm địa chỉ (ở tiêu đề panel hoặc empty state)
      const addBtns = addressPanel.querySelectorAll('[data-address-add], [data-address-add-empty]');
      addBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          openForm(null);
        });
      });

      // Gắn sự kiện nút Huỷ form
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          closeForm();
        });
      }

      // Xoá thông báo lỗi khi người dùng gõ
      if (form) {
        [nameInput, phoneInput, addressInput].forEach(inp => {
          if (inp) {
            inp.addEventListener('input', () => {
              validation.clearError(inp);
            });
          }
        });
      }

      // Submit form Thêm / Sửa địa chỉ
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          validation.clearAllErrors(form);

          if (isLastReadFailed) {
            showToast('Không thể lưu địa chỉ do không đọc được bộ nhớ lưu trữ.', 'error');
            return;
          }

          const nameVal = nameInput ? nameInput.value.trim() : '';
          const phoneVal = phoneInput ? phoneInput.value.trim() : '';
          const addressVal = addressInput ? addressInput.value.trim() : '';
          const noteVal = noteInput ? noteInput.value.trim() : '';
          const isDefaultVal = defaultInput ? defaultInput.checked : false;
          const currentId = idInput ? idInput.value.trim() : '';

          let hasError = false;
          let firstErrorField = null;

          if (!validation.isRequired(nameVal) || nameVal.length < 2) {
            validation.showError(nameInput, 'Vui lòng nhập họ và tên người nhận (tối thiểu 2 ký tự).');
            if (!firstErrorField) firstErrorField = nameInput;
            hasError = true;
          }

          if (!validation.isValidPhone(phoneVal)) {
            validation.showError(phoneInput, 'Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số).');
            if (!firstErrorField) firstErrorField = phoneInput;
            hasError = true;
          }

          if (!validation.isRequired(addressVal) || addressVal.length < 5) {
            validation.showError(addressInput, 'Vui lòng nhập địa chỉ nhận hàng chi tiết (tối thiểu 5 ký tự).');
            if (!firstErrorField) firstErrorField = addressInput;
            hasError = true;
          }

          if (hasError) {
            if (firstErrorField) firstErrorField.focus();
            return;
          }

          const res = saveOrUpdateAddress({
            id: currentId,
            name: nameVal,
            phone: phoneVal,
            address: addressVal,
            note: noteVal,
            isDefault: isDefaultVal
          }, addresses);

          if (!res.success) {
            if (res.error === 'READ_FAILED') {
              showToast('Không thể lưu do lỗi đọc bộ nhớ lưu trữ ban đầu.', 'error');
            } else if (res.error === 'LIMIT_REACHED') {
              showToast('Bạn chỉ có thể lưu tối đa 5 địa chỉ.', 'error');
            } else {
              showToast('Không thể lưu địa chỉ do bộ nhớ trình duyệt gặp lỗi.', 'error');
            }
            return;
          }

          addresses = res.addresses;
          renderAddressList(addresses);
          closeForm();
          showToast(res.isEditing ? 'Đã cập nhật địa chỉ thành công!' : 'Đã thêm địa chỉ mới thành công!');
        });
      }

      // Event delegation cho Sửa và Xoá
      if (listContainer) {
        listContainer.addEventListener('click', (e) => {
          const editBtn = e.target.closest('[data-address-edit]');
          if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const target = addresses.find(a => a.id === id);
            if (target) {
              openForm(target);
            }
            return;
          }

          const deleteBtn = e.target.closest('[data-address-delete]');
          if (deleteBtn) {
            if (isLastReadFailed) {
              showToast('Không thể xoá địa chỉ do không đọc được bộ nhớ lưu trữ.', 'error');
              return;
            }

            const id = deleteBtn.getAttribute('data-id');
            const target = addresses.find(a => a.id === id);
            if (!target) return;

            const confirmMsg = `Bạn có chắc chắn muốn xoá địa chỉ của "${target.name}" không?`;
            if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
              if (!window.confirm(confirmMsg)) return;
            }

            const res = deleteAddressById(id, addresses);
            if (!res.success) {
              if (res.error === 'READ_FAILED') {
                showToast('Không thể xoá do lỗi đọc bộ nhớ lưu trữ.', 'error');
              } else {
                showToast('Không thể xoá địa chỉ do bộ nhớ trình duyệt gặp lỗi.', 'error');
              }
              return;
            }

            addresses = res.addresses;
            renderAddressList(addresses);

            if (idInput && idInput.value === id) {
              closeForm();
            }

            showToast('Đã xoá địa chỉ thành công!');
          }
        });
      }
    }
  } catch (err) {
    console.warn('Lỗi khi khởi tạo sổ địa chỉ:', err);
  }

  // 7. Kết thúc phiên đăng nhập hiện tại.
  const logoutBtn = document.querySelector('[data-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const result = logoutAccount();
      if (!result.success) {
        showToast(result.error || 'Không thể đăng xuất do lỗi bộ nhớ trình duyệt.', 'error');
        return;
      }
      window.location.replace('login.html');
    });
  }
}

/**
 * Render danh sách đơn hàng đã đặt và gắn bộ lọc trạng thái (tat-ca, cho-xac-nhan, dang-giao, da-giao, da-huy)
 * Nạp metadata từ js/data/order-statuses.json và sample orders từ js/data/sample-orders.json (Single Source of Truth)
 */
async function renderUserOrders(user) {
  const orderList = document.querySelector('[data-list="orders"]');
  const emptyBlock = document.querySelector('[data-orders-empty]');
  const countBadge = document.querySelector('[data-orders-count]');
  const chipsContainer = document.querySelector('[data-order-filters], .panel__filters');

  let activeFilter = 'tat-ca';

  // 1. Nạp metadata trạng thái từ JSON và render các nút lọc động (R3)
  const statuses = await loadOrderStatuses();
  if (String(getCurrentUser()?.id) !== String(user.id)) return;
  if (chipsContainer) {
    if (Array.isArray(statuses) && statuses.length > 0) {
      chipsContainer.innerHTML = statuses.map(s => `
        <button class="chip ${s.key === activeFilter ? 'is-active' : ''}" type="button" data-order-filter="${escapeHTML(s.key)}" aria-pressed="${s.key === activeFilter ? 'true' : 'false'}">
          ${escapeHTML(s.label)}
        </button>
      `).join('');
    } else {
      chipsContainer.innerHTML = '<span class="field__error" style="display:block; padding: 4px 0;">Không thể tải danh sách bộ lọc trạng thái.</span>';
    }
  }

  // 2. Xác định danh sách đơn hàng hiển thị (R4)
  // Ưu tiên hiển thị đơn thực tế của người dùng, chỉ hiển thị đơn mẫu khi chưa có đơn
  const rawLocal = storage.get(ORDERS_KEY, []);
  const userOrders = Array.isArray(rawLocal)
    ? rawLocal.map(validateAndSanitizeOrder).filter(order => order && String(order.userId) === String(user.id))
    : [];

  let displayOrders = [];
  let isDemoMode = false;

  if (userOrders.length > 0) {
    displayOrders = userOrders;
    isDemoMode = false;
  } else if (String(user.id) === '1') {
    const samples = await loadSampleOrders();
    if (String(getCurrentUser()?.id) !== String(user.id)) return;
    displayOrders = (Array.isArray(samples) ? samples : getSampleOrders())
      .filter(o => String(o.userId) === String(user.id))
      .map(validateAndSanitizeOrder)
      .filter(Boolean);
    isDemoMode = true;
  }

  if (countBadge) {
    countBadge.textContent = String(displayOrders.length);
  }

  if (!orderList) return;

  const renderFiltered = (statusKey) => {
    // Cập nhật trạng thái active của các chip filter
    const filterChips = document.querySelectorAll('[data-order-filter]');
    filterChips.forEach(chip => {
      const chipKey = chip.getAttribute('data-order-filter');
      if (chipKey === statusKey) {
        chip.classList.add('is-active');
        chip.setAttribute('aria-pressed', 'true');
      } else {
        chip.classList.remove('is-active');
        chip.setAttribute('aria-pressed', 'false');
      }
    });

    const filtered = (statusKey === 'tat-ca')
      ? displayOrders
      : displayOrders.filter(o => normalizeOrderStatus(o.status).key === statusKey);

    if (filtered.length === 0) {
      orderList.innerHTML = '';
      orderList.classList.add('is-hidden');
      if (emptyBlock) emptyBlock.classList.remove('is-hidden');
      return;
    }

    orderList.classList.remove('is-hidden');
    if (emptyBlock) emptyBlock.classList.add('is-hidden');

    const demoNoticeMarkup = isDemoMode ? `
      <div style="grid-column: 1 / -1; margin-bottom: 16px; padding: 12px 16px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; font-size: 13px; color: #7f5f00;">
        <strong>Chế độ xem minh họa:</strong> Bạn chưa phát sinh đơn hàng thực tế nào. Dưới đây là các <strong>đơn hàng mẫu (Demo)</strong> thể hiện các trạng thái xử lý của Lá Sen.
      </div>
    ` : '';

    const ordersMarkup = filtered.map(order => {
      const dateFormatted = new Date(order.date).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      const items = Array.isArray(order.items) ? order.items : [];
      const totalAmount = order.totals ? order.totals.total : order.total;
      const statusMeta = normalizeOrderStatus(order.status);
      const isDemoItem = Boolean(order.isDemo || isDemoMode);

      return `
        <article class="order ${statusMeta.key === 'da-huy' ? 'order--cancelled' : ''}" data-order data-id="${escapeHTML(order.id)}" data-status="${escapeHTML(statusMeta.key)}">
          <header class="order__head">
            <div class="order__id">
              <h3 class="order__code">
                Đơn #${escapeHTML(order.id)}
                ${isDemoItem ? '<span class="badge badge--soft" style="font-size: 11px; margin-left: 6px; background: #fff3cd; color: #856404;">Đơn mẫu</span>' : ''}
              </h3>
              <p class="order__date">Đặt ngày ${escapeHTML(dateFormatted)} • ${escapeHTML(order.paymentMethod || 'COD')}</p>
            </div>
            <span class="badge ${escapeHTML(statusMeta.badgeClass)}" style="font-weight: 600;">${escapeHTML(statusMeta.label)}</span>
          </header>

          <ul class="order__items">
            ${items.map(it => {
              const product = getProductById(it.productId) || {
                id: it.productId,
                name: it.name || 'Sản phẩm Lá Sen',
                image: it.image || 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80'
              };
              return `
                <li class="order__item">
                  <a class="order__thumb" href="product-detail.html?id=${escapeHTML(product.id)}" tabindex="-1">
                    <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy">
                  </a>
                  <span class="order__info">
                    <a class="order__name" href="product-detail.html?id=${escapeHTML(product.id)}">${escapeHTML(product.name)}</a>
                    <span class="order__meta">Số lượng: ${it.quantity}</span>
                  </span>
                  <span class="order__price">${formatPrice(it.price)}</span>
                </li>
              `;
            }).join('')}
          </ul>

          <footer class="order__foot" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <span style="font-size: 13px; color: var(--c-muted, #666);">Địa chỉ: ${escapeHTML(order.shippingAddress)}</span>
            <div style="display: flex; align-items: center; gap: 16px;">
              <span class="order__total" style="font-size: 15px; font-weight: 700;">Tổng tiền: ${formatPrice(totalAmount)}</span>
              <button class="btn btn--outline btn--sm" type="button" data-order-rebuy data-id="${escapeHTML(order.id)}">Đặt lại đơn này</button>
            </div>
          </footer>
        </article>
      `;
    }).join('');

    orderList.innerHTML = demoNoticeMarkup + ordersMarkup;
  };

  // Gắn sự kiện click lọc trạng thái đơn
  if (chipsContainer) {
    chipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-order-filter]');
      if (!chip) return;
      activeFilter = chip.getAttribute('data-order-filter');
      renderFiltered(activeFilter);
    });
  }

  // Render lần đầu
  renderFiltered('tat-ca');

  // Nút đặt lại đơn này: thêm các sản phẩm vào giỏ
  orderList.addEventListener('click', (e) => {
    const rebuyBtn = e.target.closest('[data-order-rebuy]');
    if (!rebuyBtn) return;

    const orderId = rebuyBtn.getAttribute('data-id');
    const order = displayOrders.find(o => o.id === orderId);
    if (!order || !Array.isArray(order.items)) return;

    let addedCount = 0;
    for (const item of order.items) {
      const res = cartService.addToCart(item.productId, item.quantity || 1);
      if (res.success) addedCount++;
    }

    if (addedCount > 0) {
      showToast(`Đã thêm ${addedCount} sản phẩm từ đơn #${orderId} vào giỏ hàng!`);
      setTimeout(() => {
        window.location.href = 'cart.html';
      }, 800);
    } else {
      showToast('Không thể thêm sản phẩm do hết hàng hoặc lỗi dữ liệu.', 'error');
    }
  });
}

/**
 * Render danh sách sản phẩm yêu thích thực tế trong tab Yêu thích
 */
function renderWishlist() {
  const wishlistContainer = document.querySelector('[data-list="wishlist"]');
  const emptyState = document.querySelector('[data-wishlist-empty]');
  const countBadge = document.querySelector('[data-wishlist-count]');

  const favoriteProducts = favoriteService.getFavoriteProducts();
  const count = favoriteProducts.length;

  if (countBadge) {
    countBadge.textContent = String(count);
  }

  if (!wishlistContainer) return;

  if (count === 0) {
    wishlistContainer.innerHTML = '';
    wishlistContainer.classList.add('is-hidden');
    if (emptyState) {
      emptyState.classList.remove('is-hidden');
    }
  } else {
    wishlistContainer.classList.remove('is-hidden');
    wishlistContainer.innerHTML = favoriteProducts.map(createProductCard).join('');
    if (emptyState) {
      emptyState.classList.add('is-hidden');
    }
  }
}
