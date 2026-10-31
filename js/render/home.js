import { products } from '../services/dataService.js';
import { renderProductList } from '../components/productCard.js';

export function renderHome() {
  initBanner();
  initCountdown();
  renderHomeLists();
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

  setInterval(() => showSlide(currentIndex + 1), 3000);
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

function renderHomeLists() {
  if (!document.querySelector('[data-list="flash"]')) return;

  renderProductList('[data-list="flash"]', products.filter(product => product.salePrice < product.price).slice(0, 4));
  renderProductList('[data-list="hot"]', products.filter(product => product.isFeatured).slice(0, 4));
  renderProductList('[data-list="new"]', products.filter(product => product.isNew).slice(0, 4));

  const chips = document.querySelectorAll('[data-category-filter] [data-category]');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(item => item.classList.remove('is-active'));
      chip.classList.add('is-active');
      showCategory(chip.getAttribute('data-category'));
    });
  });
  showCategory('lam-sach');
}

function showCategory(category) {
  const list = products.filter(product => product.category === category).slice(0, 5);
  renderProductList('[data-list="category-recommendations"]', list);
}
