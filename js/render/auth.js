import { getCurrentUser, login, register } from '../services/accountService.js';
import { isValidEmail, isValidPhone, clearErrors, clearErrorWhenTyping } from '../utils/helpers.js';

export function renderAuth() {
  const form = document.querySelector('[data-auth-form]');
  if (!form) return;

  if (getCurrentUser()) {
    window.location.href = 'profile.html';
    return;
  }

  form.querySelectorAll('[data-password-toggle]').forEach(button => {
    const input = document.getElementById(button.getAttribute('data-password-toggle'));
    button.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        button.textContent = 'Ẩn';
      } else {
        input.type = 'password';
        button.textContent = 'Hiện';
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
  document.getElementById('auth-error-' + name).textContent = message;
}

function initLoginForm(form) {
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const messageBox = document.querySelector('[data-auth-message]');

  if (window.location.search.includes('registered=1')) {
    document.querySelector('[data-registration-success]').hidden = false;
  }

  document.querySelector('[data-fill-demo]').addEventListener('click', () => {
    emailInput.value = document.querySelector('[data-demo-email]').textContent;
    passwordInput.value = document.querySelector('[data-demo-password]').textContent;
  });

  form.addEventListener('input', () => {
    messageBox.hidden = true;
  });

  form.addEventListener('submit', (event) => {
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
    if (!isValid) return;

    if (login(email, password)) {
      window.location.href = 'profile.html';
    } else {
      messageBox.textContent = 'Email hoặc mật khẩu chưa đúng.';
      messageBox.hidden = false;
    }
  });
}

function initRegisterForm(form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors(form);

    const name = document.getElementById('auth-name').value.trim();
    const phone = document.getElementById('auth-phone').value.trim();
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
    if (password.length < 8) {
      showFieldError('password', 'Mật khẩu cần ít nhất 8 ký tự.');
      isValid = false;
    }
    if (confirmPassword !== password) {
      showFieldError('confirmPassword', 'Mật khẩu xác nhận chưa khớp.');
      isValid = false;
    }
    if (!isValid) return;

    const success = register({ name: name, phone: phone, email: email, password: password });
    if (!success) {
      showFieldError('email', 'Email này đã được đăng ký.');
      return;
    }
    window.location.href = 'login.html?registered=1';
  });
}
