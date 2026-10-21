import { products } from '../services/dataService.js';
import { getCurrentUser } from '../services/accountService.js';
import { updateHeaderCart } from '../services/cartService.js';
import { formatPrice, getPrice, isValidEmail, showError, clearErrors, showToast } from '../utils/helpers.js';

export function initUI() {
  updateHeaderAccount();
  updateHeaderCart();
  initMobileMenu();
  initHeaderSearch();
  initBackToTop();
  initNewsletter();
  initBanner();
  initCountdown();
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

  document.querySelector('[data-search-toggle]').addEventListener('click', () => {
    form.classList.toggle('is-active');
    input.focus();
  });

  input.addEventListener('input', () => {
    const keyword = input.value.trim().toLowerCase();

    if (keyword.length < 2) {
      suggestBox.innerHTML = '';
      return;
    }

    const matches = products.filter(product =>
      product.name.toLowerCase().includes(keyword) ||
      product.brandName.toLowerCase().includes(keyword) ||
      product.categoryName.toLowerCase().includes(keyword)
    ).slice(0, 4);
    if (matches.length === 0) {
      suggestBox.innerHTML = '<div style="padding: 12px; font-size: 13px; color: var(--c-muted, #777);">Không tìm thấy sản phẩm phù hợp</div>';
      return;
    }

    suggestBox.innerHTML = matches.map(product => `
      <a href="product-detail.html?id=${product.id}" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; color: inherit; text-decoration: none; border-bottom: 1px solid var(--c-border, #eee);">
        <img src="${product.image}" alt="${product.name}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px;">
        <div style="flex: 1; overflow: hidden;">
          <div style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name}</div>
          <div style="font-size: 12px; color: var(--c-sale, #c0392b);">${formatPrice(getPrice(product))}</div>
        </div>
      </a>
    `).join('');
  });

  document.addEventListener('click', (event) => {
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

// Form đăng ký nhận thư ở chân trang
function initNewsletter() {
  const form = document.querySelector('[data-newsletter-form]');
  const input = form.querySelector('[data-newsletter-email]');

  form.addEventListener('submit', (event) => {
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

function initBanner() {
  const banner = document.querySelector('[data-banner]');
  if (!banner) return;

  const slides = banner.querySelectorAll('[data-banner-slide]');
  const dots = banner.querySelectorAll('[data-banner-dot]');
  let currentIndex = 0;

  function showSlide(index) {
    currentIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === currentIndex));
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === currentIndex));
  }

  banner.querySelector('[data-banner-prev]').addEventListener('click', () => showSlide(currentIndex - 1));
  banner.querySelector('[data-banner-next]').addEventListener('click', () => showSlide(currentIndex + 1));
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => showSlide(i));
  });

  setInterval(() => showSlide(currentIndex + 1), 5000);
}

function initCountdown() {
  const countdown = document.querySelector('[data-countdown]');
  if (!countdown) return;

  const FIVE_HOURS = 5 * 60 * 60;
  let secondsLeft = FIVE_HOURS;

  function updateClock() {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    countdown.querySelector('[data-countdown-hours]').textContent = String(hours).padStart(2, '0');
    countdown.querySelector('[data-countdown-minutes]').textContent = String(minutes).padStart(2, '0');
    countdown.querySelector('[data-countdown-seconds]').textContent = String(seconds).padStart(2, '0');

    secondsLeft--;
    if (secondsLeft < 0) {
      secondsLeft = FIVE_HOURS;
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
}
