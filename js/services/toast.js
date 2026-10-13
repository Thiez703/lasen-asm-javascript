/**
 * Service hiển thị thông báo nhanh (Toast Notification)
 */

import { escapeHTML } from '../utils/format.js';

export function showToast(message, type = 'info', duration = 3000) {
  if (typeof document === 'undefined') return;

  let stack = document.querySelector('.toast-stack[data-toast]');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('data-toast', '');
    stack.setAttribute('aria-live', 'polite');
    stack.setAttribute('aria-atomic', 'true');
    document.body.appendChild(stack);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast--error' : ''}`;
  
  const iconId = type === 'error' ? '#i-close' : '#i-check';
  toast.innerHTML = `
    <svg class="icon toast__icon" aria-hidden="true">
      <use href="${iconId}"></use>
    </svg>
    <span class="toast__msg">${escapeHTML(message)}</span>
  `;

  stack.appendChild(toast);

  // Tự động gỡ sau duration ms
  const timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  });
}
