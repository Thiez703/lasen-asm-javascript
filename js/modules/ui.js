/**
 * Module xử lý tương tác giao diện chung cho tất cả các trang
 */

import { cartService } from '../services/cartService.js';
import { formatPrice, escapeHTML } from '../utils/format.js';
import { showToast } from '../services/toast.js';
import { products } from '../services/dataService.js';
import { validation } from './validation.js';
import { createProductCard } from '../render/products.js';

export function initUI() {
  // Cập nhật header lúc khởi tạo và mỗi lần giỏ hàng thay đổi
  const updateHeaderCart = () => {
    const totals = cartService.getCartTotals();

    const countEls = document.querySelectorAll('[data-cart-count]');
    countEls.forEach(el => {
      el.textContent = totals.totalQuantity;
    });

    const totalEls = document.querySelectorAll('.header [data-cart-total], .cart-btn [data-cart-total]');
    totalEls.forEach(el => {
      el.textContent = formatPrice(totals.total);
    });
  };
  updateHeaderCart();
  window.addEventListener('cart:updated', updateHeaderCart);

  // Menu danh mục trên mobile
  {
    const toggleBtn = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-nav]');

    if (toggleBtn && nav) {
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
  }

  // Nút cuộn lên đầu trang
  {
    const backTopBtn = document.querySelector('[data-back-to-top]');

    if (backTopBtn) {
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
  }

  // Tìm kiếm và gợi ý trên header
  {
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

    if (searchForm && searchInput) {
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
  }

  // Gợi ý theo loại sản phẩm trên trang chủ
  {
    const categoryFilterWrap = document.querySelector('[data-category-filter]');
    const categoryList = document.querySelector('[data-list="category-recommendations"]');

    if (categoryFilterWrap && categoryList) {
      const chips = categoryFilterWrap.querySelectorAll('[data-category]');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          const category = chip.getAttribute('data-category');

          chips.forEach(c => {
            c.classList.remove('is-active');
            c.setAttribute('aria-pressed', 'false');
          });
          chip.classList.add('is-active');
          chip.setAttribute('aria-pressed', 'true');

          // Lọc danh sách theo loại sản phẩm ngay tại trang chủ
          const matched = products.filter(p => p.category === category).slice(0, 5);
          categoryList.innerHTML = matched.map(createProductCard).join('');
        });
      });
    }
  }

  // Đăng ký thư chăm da ở footer
  {
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
}
