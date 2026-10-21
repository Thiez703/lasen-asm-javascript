export function formatPrice(price) {
  return price.toLocaleString('vi-VN') + 'đ';
}

// Giá bán: có giá khuyến mãi thì lấy giá khuyến mãi, không thì lấy giá gốc
export function getPrice(product) {
  return product.salePrice || product.price;
}

export function getStorage(key, defaultValue) {
  const text = localStorage.getItem(key);
  if (text === null) {
    return defaultValue;
  }
  return JSON.parse(text);
}

export function setStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Hiện thông báo nhỏ ở góc màn hình, tự ẩn sau 3 giây
export function showToast(message, type = 'success') {
  const icon = type === 'error' ? '#i-close' : '#i-check';
  const toast = document.createElement('div');
  toast.className = type === 'error' ? 'toast toast--error' : 'toast';
  toast.innerHTML = `
    <svg class="icon toast__icon" aria-hidden="true"><use href="${icon}"></use></svg>
    <span class="toast__msg">${message}</span>
  `;

  document.querySelector('[data-toast]').appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone) {
  return /^0\d{9}$/.test(phone.replaceAll(' ', ''));
}

export function showError(errorFor, message) {
  document.querySelector(`[data-error-for="${errorFor}"]`).textContent = message;
}

export function clearErrors(form) {
  form.querySelectorAll('.field__error').forEach(errorElement => {
    errorElement.textContent = '';
  });
}

export function clearErrorWhenTyping(form) {
  form.addEventListener('input', (event) => {
    const field = event.target.closest('.field');
    if (!field) return;

    const errorElement = field.querySelector('.field__error');
    if (errorElement) {
      errorElement.textContent = '';
    }
  });
}
