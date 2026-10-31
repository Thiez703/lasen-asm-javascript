import { getCurrentUser, updateProfile } from '../../services/accountService.js';
import { updateHeaderAccount } from '../../modules/layout.js';
import { isValidEmail, isValidPhone, showError, clearErrors, clearErrorWhenTyping } from '../../utils/form.js';
import { showToast } from '../../utils/toast.js';

export function showAccountCard(user) {
  const lastWord = user.name.split(' ').pop();
  document.querySelector('[data-account-avatar]').textContent = lastWord.charAt(0).toUpperCase();
  document.querySelector('[data-account-email]').textContent = user.email;

  const since = document.querySelector('[data-account-since]');
  if (user.createdAt) {
    const date = new Date(user.createdAt);
    since.textContent = `Thành viên từ tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
  } else {
    since.textContent = 'Thành viên Lá Sen';
  }
}

export function initProfileForm() {
  const form = document.querySelector('[data-profile-form]');
  const nameInput = document.getElementById('pf-name');
  const phoneInput = document.getElementById('pf-phone');
  const emailInput = document.getElementById('pf-email');
  const birthInput = document.getElementById('pf-birth');
  const skinSelect = document.getElementById('pf-skin');
  const newsletterCheckbox = form.querySelector('[name="nhanBanTin"]');

  function fillForm() {
    const user = getCurrentUser();
    nameInput.value = user.name;
    phoneInput.value = user.phone;
    emailInput.value = user.email;
    birthInput.value = user.birth || '';
    skinSelect.value = user.skin || '';
    form.querySelector(`[name="gioiTinh"][value="${user.gender || 'nu'}"]`).checked = true;
    newsletterCheckbox.checked = user.newsletter !== false;
  }
  fillForm();
  clearErrorWhenTyping(form);

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors(form);

    const name = nameInput.value.trim();
    const phone = phoneInput.value.replaceAll(' ', '');
    const email = emailInput.value.trim().toLowerCase();

    let isValid = true;
    if (name.length < 2) {
      showError('profileHoTen', 'Vui lòng nhập họ và tên (ít nhất 2 ký tự).');
      isValid = false;
    }
    if (!isValidPhone(phone)) {
      showError('profileSoDienThoai', 'Số điện thoại cần 10 chữ số và bắt đầu bằng 0.');
      isValid = false;
    }
    if (!isValidEmail(email)) {
      showError('profileEmail', 'Vui lòng nhập địa chỉ email hợp lệ.');
      isValid = false;
    }
    if (!isValid) return;

    const saved = updateProfile({
      name: name,
      phone: phone,
      email: email,
      birth: birthInput.value,
      skin: skinSelect.value,
      gender: form.querySelector('[name="gioiTinh"]:checked').value,
      newsletter: newsletterCheckbox.checked
    });
    if (!saved) {
      showError('profileEmail', 'Email này đã được tài khoản khác sử dụng.');
      return;
    }

    showAccountCard(getCurrentUser());
    updateHeaderAccount();
    showToast('Đã lưu thông tin hồ sơ!');
  });

  document.querySelector('[data-profile-reset]').addEventListener('click', event => {
    event.preventDefault();
    clearErrors(form);
    fillForm();
  });
}
