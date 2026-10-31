import { getCurrentUser, login, register, getPageAfterLogin } from '../services/accountService.js';
import { isValidEmail, isValidPhone, clearErrors, clearErrorWhenTyping } from '../utils/form.js';
import { showToastOnNextPage } from '../utils/toast.js';

export function renderAuth() {
  const form = document.querySelector('[data-auth-form]');
  if (!form) return;

  if (getCurrentUser()) {
    window.location.replace('profile.html');
    return;
  }

  form.querySelectorAll('[data-password-toggle]').forEach(button => {
    const input = document.getElementById(button.getAttribute('data-password-toggle'));
    button.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        button.textContent = 'Ẩn';
        button.setAttribute('aria-pressed', 'true');
      } else {
        input.type = 'password';
        button.textContent = 'Hiện';
        button.setAttribute('aria-pressed', 'false');
      }
    });
  });

  clearErrorWhenTyping(form);

  if (form.getAttribute('data-auth-form') === 'login') {
    initLoginForm(form);
  } else {
    initRegisterForm(form);
  }
}

function showFieldError(name, message) {
  const input = document.getElementById('auth-' + name);
  input.closest('.field').classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
  document.getElementById('auth-error-' + name).textContent = message;
}

function hideFieldError(name) {
  const input = document.getElementById('auth-' + name);
  input.closest('.field').classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');
  document.getElementById('auth-error-' + name).textContent = '';
}

function initLoginForm(form) {
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const messageBox = document.querySelector('[data-auth-message]');

  document.querySelector('[data-fill-demo]').addEventListener('click', () => {
    emailInput.value = document.querySelector('[data-demo-email]').textContent;
    passwordInput.value = document.querySelector('[data-demo-password]').textContent;
  });

  form.addEventListener('input', () => {
    messageBox.hidden = true;
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors(form);
    messageBox.hidden = true;

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    let isValid = true;
    if (!isValidEmail(email)) {
      showFieldError('email', 'Vui lòng nhập địa chỉ email hợp lệ.');
      isValid = false;
    }
    if (password === '') {
      showFieldError('password', 'Vui lòng nhập mật khẩu.');
      isValid = false;
    }
    if (!isValid) {
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }

    if (login(email, password)) {
      showToastOnNextPage('Đăng nhập thành công!');
      window.location.replace(getPageAfterLogin());
    } else {
      messageBox.textContent = 'Email hoặc mật khẩu chưa đúng.';
      messageBox.hidden = false;
    }
  });
}

function initRegisterForm(form) {
  document.getElementById('auth-password').addEventListener('input', () => {
    hideFieldError('confirmPassword');
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors(form);

    const name = document.getElementById('auth-name').value.trim();
    const phone = document.getElementById('auth-phone').value.replaceAll(' ', '');
    const email = document.getElementById('auth-email').value.trim().toLowerCase();
    const password = document.getElementById('auth-password').value;
    const confirmPassword = document.getElementById('auth-confirmPassword').value;

    let isValid = true;
    if (name.length < 2) {
      showFieldError('name', 'Vui lòng nhập họ và tên (ít nhất 2 ký tự).');
      isValid = false;
    }
    if (!isValidPhone(phone)) {
      showFieldError('phone', 'Số điện thoại cần 10 chữ số và bắt đầu bằng 0.');
      isValid = false;
    }
    if (!isValidEmail(email)) {
      showFieldError('email', 'Vui lòng nhập địa chỉ email hợp lệ.');
      isValid = false;
    }
    if (password.trim().length < 8) {
      showFieldError('password', 'Mật khẩu cần ít nhất 8 ký tự.');
      isValid = false;
    }
    if (confirmPassword !== password) {
      showFieldError('confirmPassword', 'Mật khẩu xác nhận chưa khớp.');
      isValid = false;
    }
    if (!isValid) {
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }

    const success = register({ name: name, phone: phone, email: email, password: password });
    if (!success) {
      showFieldError('email', 'Email này đã được đăng ký.');
      document.getElementById('auth-email').focus();
      return;
    }

    login(email, password);
    showToastOnNextPage('Đăng ký thành công! Chào mừng bạn đến với Lá Sen.');
    window.location.replace(getPageAfterLogin());
  });
}
