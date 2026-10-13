/**
 * Module xử lý tương tác giao diện chung cho tất cả các trang
 */

import { cartService } from '../services/cartService.js';
import { formatPrice, escapeHTML } from '../utils/format.js';
import { showToast } from '../services/toast.js';
import { products } from '../services/dataService.js';
import { validation } from './validation.js';
import { createProductCard } from '../render/products.js';
import { loadCoupons, findCoupon, getCoupons } from '../services/couponService.js';

export function initUI() {
  updateHeaderCart();
  window.addEventListener('cart:updated', updateHeaderCart);

  initMobileNav();
  initBackToTop();
  initHeaderSearch();
  initVoucherCopy();
  renderHomeVouchers();
  initHomeSkinChips();
  initNewsletter();
}

/**
 * Cập nhật số lượng và tổng tiền giỏ hàng trên Header
 */
function updateHeaderCart() {
  const totals = cartService.getCartTotals();

  const countEls = document.querySelectorAll('[data-cart-count]');
  countEls.forEach(el => {
    el.textContent = totals.totalQuantity;
  });

  const totalEls = document.querySelectorAll('.header [data-cart-total], .cart-btn [data-cart-total]');
  totalEls.forEach(el => {
    el.textContent = formatPrice(totals.total);
  });
}

/**
 * Điều khiển bật tắt Menu danh mục trên Mobile kèm a11y & phím Escape
 */
function initMobileNav() {
  const toggleBtn = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');

  if (!toggleBtn || !nav) return;

  const closeNav = () => {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.focus();
  };

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = nav.classList.toggle('is-open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggleBtn.contains(e.target)) {
      closeNav();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      closeNav();
    }
  });
}

/**
 * Điều khiển nút Cuộn lên đầu trang (Back to top)
 */
function initBackToTop() {
  const backTopBtn = document.querySelector('[data-back-to-top]');
  if (!backTopBtn) return;

  const checkScroll = () => {
    if (window.scrollY > 300) {
      backTopBtn.style.opacity = '1';
      backTopBtn.style.pointerEvents = 'auto';
      backTopBtn.style.transform = 'translateY(0)';
    } else {
      backTopBtn.style.opacity = '0';
      backTopBtn.style.pointerEvents = 'none';
      backTopBtn.style.transform = 'translateY(10px)';
    }
  };

  backTopBtn.style.transition = 'all 0.25s ease';
  checkScroll();
  window.addEventListener('scroll', checkScroll, { passive: true });

  backTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/**
 * Nạp dữ liệu coupon từ js/data/coupons.json và render ra giao diện trang chủ
 */
export async function renderHomeVouchers(couponsLoader = loadCoupons) {
  const container = document.querySelector('[data-list="vouchers"]');
  if (!container) return;

  let coupons = null;
  try {
    coupons = await couponsLoader();
  } catch (err) {
    console.warn('Tải dữ liệu voucher thất bại hoặc đang ngoại tuyến:', err);
    const cached = getCoupons();
    if (Array.isArray(cached) && cached.length > 0) {
      coupons = cached;
    }
  }

  // Trạng thái rỗng/lỗi không che mất dữ liệu hợp lệ đang có sẵn trong container
  if (!Array.isArray(coupons) || coupons.length === 0) return;

  container.innerHTML = coupons.map(c => `
    <li class="voucher">
      <span class="voucher__value">${escapeHTML(c.badge || 'KM')}</span>
      <span class="voucher__body">
        <span class="voucher__title">${escapeHTML(c.title)}</span>
        <span class="voucher__cond">${escapeHTML(c.conditionText || c.description)}</span>
        <button class="voucher__code" type="button" data-copy-code="${escapeHTML(c.code)}">
          ${escapeHTML(c.code)}
          <svg class="icon" aria-hidden="true">
            <use href="#i-copy"></use>
          </svg>
        </button>
      </span>
    </li>
  `).join('');
}

/**
 * Sao chép mã ưu đãi (Voucher copy) trên trang chủ
 */
function initVoucherCopy() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy-code]');
    if (!btn) return;
    e.preventDefault();

    const code = btn.getAttribute('data-copy-code') || btn.textContent.trim();
    if (!code) return;

    const copyToClipboard = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(code);
      }
      const temp = document.createElement('textarea');
      temp.value = code;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      return Promise.resolve();
    };

    const couponObj = findCoupon(code);
    const hint = couponObj ? ` (${couponObj.title})` : '';

    copyToClipboard()
      .then(() => {
        showToast(`Đã sao chép mã "${code}"${hint}! Dán vào giỏ hàng hoặc thanh toán để nhận ưu đãi.`);
      })
      .catch(() => {
        showToast(`Mã ưu đãi: ${code}${hint}`);
      });
  });
}

/**
 * Lọc theo loại da bằng các nút Chip trên trang chủ
 */
function initHomeSkinChips() {
  const skinFilterWrap = document.querySelector('[data-skin-filter]');
  const skinList = document.querySelector('[data-list="skin"]');
  if (!skinFilterWrap || !skinList) return;

  const chips = skinFilterWrap.querySelectorAll('[data-skin]');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const skinVal = chip.getAttribute('data-skin');

      chips.forEach(c => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('is-active');
      chip.setAttribute('aria-pressed', 'true');

      // Lọc danh sách sản phẩm theo da ngay tại trang chủ
      const matched = products.filter(p => Array.isArray(p.skin) && p.skin.includes(skinVal)).slice(0, 5);
      skinList.innerHTML = matched.map(createProductCard).join('');
    });
  });
}

/**
 * Xử lý tìm kiếm trên Header: Gợi ý nhanh an toàn và nộp biểu mẫu
 */
function initHeaderSearch() {
  const searchForm = document.querySelector('header [data-search-form]');
  const searchInput = document.querySelector('header [data-search-input]');
  const suggestBox = document.querySelector('header [data-search-suggest]');
  const searchToggle = document.querySelector('[data-search-toggle]');

  if (searchToggle && searchForm) {
    searchToggle.addEventListener('click', () => {
      searchForm.classList.toggle('is-active');
      if (searchForm.classList.contains('is-active') && searchInput) {
        searchInput.focus();
      }
    });
  }

  if (!searchForm || !searchInput) return;

  if (suggestBox) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      if (query.length < 2) {
        suggestBox.innerHTML = '';
        suggestBox.style.display = 'none';
        return;
      }

      const matches = products.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.brandName && p.brandName.toLowerCase().includes(query)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(query))
      ).slice(0, 4);

      if (matches.length === 0) {
        suggestBox.innerHTML = `
          <div style="padding: 12px; font-size: 13px; color: var(--c-muted, #777);">
            Không tìm thấy sản phẩm phù hợp
          </div>
        `;
        suggestBox.style.display = 'block';
        return;
      }

      suggestBox.innerHTML = matches.map(p => {
        const price = p.salePrice || p.price;
        return `
          <a class="suggest-item" href="product-detail.html?id=${escapeHTML(p.id)}" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; text-decoration: none; color: inherit; border-bottom: 1px solid var(--c-border, #eee);">
            <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px;">
            <div style="flex: 1; overflow: hidden;">
              <div style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(p.name)}</div>
              <div style="font-size: 12px; color: var(--c-sale, #c0392b);">${formatPrice(price)}</div>
            </div>
          </a>
        `;
      }).join('');
      suggestBox.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
      if (!searchForm.contains(e.target)) {
        suggestBox.style.display = 'none';
      }
    });
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    window.location.href = `products.html?q=${encodeURIComponent(query)}`;
  });
}

/**
 * Xử lý biểu mẫu đăng ký nhận thư ở footer
 */
function initNewsletter() {
  // Newsletter Footer
  const newsletterForm = document.querySelector('[data-newsletter-form]');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector('[data-newsletter-email]');
      if (!input) return;

      const email = input.value.trim();
      if (!validation.isValidEmail(email)) {
        validation.showError(input, 'Vui lòng nhập địa chỉ email hợp lệ.');
        return;
      }

      validation.clearError(input);
      input.value = '';
      showToast('Cảm ơn bạn! Lá Sen đã lưu email nhận thư định kỳ.');
    });
  }
}
