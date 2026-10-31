import { products } from '../services/dataService.js';
import { getCurrentUser } from '../services/accountService.js';
import { updateHeaderCart } from '../services/cartService.js';
import { formatPrice, getPrice } from '../utils/price.js';
import { isValidEmail, showError, clearErrors } from '../utils/form.js';
import { showToast, showPendingToast } from '../utils/toast.js';

export function initLayout() {
  updateHeaderAccount();
  updateHeaderCart();
  showPendingToast();
  reloadWhenBackFromCache();
  initMobileMenu();
  initHeaderSearch();
  initBackToTop();
  initNewsletter();
}

export function updateHeaderAccount() {
  const user = getCurrentUser();
  document.querySelectorAll('[data-account-name]').forEach(element => {
    element.textContent = user ? user.name : 'Đăng nhập';
  });
  document.querySelectorAll('[data-account-link]').forEach(link => {
    link.href = user ? 'profile.html' : 'login.html';
  });
}

function reloadWhenBackFromCache() {
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      window.location.reload();
    }
  });
}

function initMobileMenu() {
  const button = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  button.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', isOpen);
  });
}

function initHeaderSearch() {
  const form = document.querySelector('header [data-search-form]');
  const input = document.querySelector('header [data-search-input]');
  const suggestBox = document.querySelector('header [data-search-suggest]');

  input.addEventListener('input', () => {
    const keyword = input.value.trim().toLowerCase();

    if (keyword.length < 2) {
      suggestBox.innerHTML = '';
      return;
    }

    const matches = products
      .filter(
        product =>
          product.name.toLowerCase().includes(keyword) ||
          product.brandName.toLowerCase().includes(keyword) ||
          product.categoryName.toLowerCase().includes(keyword)
      )
      .slice(0, 4);
    if (matches.length === 0) {
      suggestBox.innerHTML = `
        <p class="search__empty">
          <svg class="icon" aria-hidden="true"><use href="#i-search"></use></svg>
          Không tìm thấy sản phẩm phù hợp
        </p>
      `;
      return;
    }

    const titleHTML =
      '<div style="padding: 4px 12px 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--c-ink-muted, #777);">Kết quả gợi ý</div>';
    const viewAllHTML = `<a href="products.html?q=${encodeURIComponent(input.value.trim())}" style="display: block; padding: 10px 12px 4px; font-size: 13px; font-weight: 600; text-align: center; color: var(--c-primary, #D6246B); text-decoration: none;">Xem tất cả kết quả <span aria-hidden="true">→</span></a>`;

    suggestBox.innerHTML =
      titleHTML +
      matches
        .map(
          product => `
      <a href="product-detail.html?id=${product.id}" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; color: inherit; text-decoration: none; border-bottom: 1px solid var(--c-border, #eee);">
        <img src="${product.image}" alt="${product.name}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px;">
        <div style="flex: 1; overflow: hidden;">
          <div style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name}</div>
          <div style="font-size: 12px; color: var(--c-sale, #c0392b);">${formatPrice(getPrice(product))}</div>
        </div>
      </a>
    `
        )
        .join('') +
      viewAllHTML;
  });

  document.addEventListener('click', event => {
    if (!form.contains(event.target)) {
      suggestBox.innerHTML = '';
    }
  });
}

function initBackToTop() {
  const button = document.querySelector('[data-back-to-top]');

  window.addEventListener('scroll', () => {
    button.classList.toggle('is-visible', window.scrollY > 300);
  });

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initNewsletter() {
  const form = document.querySelector('[data-newsletter-form]');
  const input = form.querySelector('[data-newsletter-email]');

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors(form);

    if (!isValidEmail(input.value.trim())) {
      showError('newsletterEmail', 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    form.reset();
    showToast('Cảm ơn bạn! Lá Sen đã lưu email nhận thư định kỳ.');
  });
}
