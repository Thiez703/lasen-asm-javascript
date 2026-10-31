const PENDING_TOAST_KEY = 'lasen_pending_toast';

export function showToast(message, type = 'success') {
  const isError = type === 'error';
  const toast = document.createElement('div');
  toast.className = isError ? 'toast toast--error' : 'toast';
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.innerHTML = `
    <svg class="icon toast__icon" aria-hidden="true"><use href="#${isError ? 'i-alert' : 'i-check'}"></use></svg>
    <span class="toast__msg">${message}</span>
  `;

  document.querySelector('[data-toast]').appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function showToastOnNextPage(message) {
  sessionStorage.setItem(PENDING_TOAST_KEY, message);
}

export function showPendingToast() {
  const message = sessionStorage.getItem(PENDING_TOAST_KEY);
  if (message) {
    sessionStorage.removeItem(PENDING_TOAST_KEY);
    showToast(message);
  }
}
