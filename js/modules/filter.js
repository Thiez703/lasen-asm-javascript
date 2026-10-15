/**
 * Tìm kiếm, lọc theo loại sản phẩm và khoảng giá trên products.html.
 * Đồng bộ bộ lọc với URL, sắp xếp và phân trang kết quả.
 */

import { products } from '../services/dataService.js';
import { createProductCard } from '../render/products.js';

const VALID_CATEGORIES = ['lam-sach', 'duong-am', 'chong-nang', 'dac-tri', 'mat-na'];
const VALID_SORTS = ['newest', 'price-asc', 'price-desc', 'best-seller'];
const PAGE_SIZE = 9;

/**
 * Lọc và sắp xếp sản phẩm mà không thay đổi danh sách gốc.
 *
 * @param {Array} list Danh sách sản phẩm gốc
 * @param {Object} criteria Tiêu chí lọc
 * @returns {Array} Danh sách sản phẩm sau lọc và sắp xếp
 */
export function filterAndSortProducts(list, criteria = {}) {
  let result = [...list];

  const {
    categories = [],
    priceMin = null,
    priceMax = null,
    search = '',
    sort = 'newest'
  } = criteria;

  // 1. Lọc theo từ khóa tìm kiếm (q)
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.brandName && p.brandName.toLowerCase().includes(q)) ||
      (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
      (p.quickInfo && p.quickInfo.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  // 2. Giữ sản phẩm thuộc một trong các loại được chọn
  const catArray = Array.isArray(categories) ? categories : Array.from(categories);
  if (catArray.length > 0) {
    const catSet = new Set(catArray);
    result = result.filter(p => catSet.has(p.category));
  }

  // 3. Giữ sản phẩm có giá bán nằm trong khoảng đã chọn
  if (priceMin !== null && !isNaN(priceMin) && priceMin >= 0) {
    result = result.filter(p => (p.salePrice || p.price) >= priceMin);
  }
  if (priceMax !== null && !isNaN(priceMax) && priceMax >= 0) {
    result = result.filter(p => (p.salePrice || p.price) <= priceMax);
  }

  // 4. Sắp xếp kết quả
  switch (sort) {
    case 'price-asc':
      result.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
      break;
    case 'price-desc':
      result.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
      break;
    case 'best-seller':
      result.sort((a, b) => (b.sold || 0) - (a.sold || 0));
      break;
    case 'newest':
    default:
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
  }

  return result;
}

export function initProductFilters() {
  const productsContainer = document.querySelector('[data-list="products"]');
  const filtersAside = document.querySelector('[data-filters]');
  if (!productsContainer && !filtersAside) return;

  // Đọc và chuẩn hóa bộ lọc trong URL
  let queryState = {};
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);

    // Category
    const catParam = params.get('cat');
    const categories = new Set();
    if (catParam) {
      catParam.split(',').forEach(c => {
        const trimmed = c.trim();
        if (VALID_CATEGORIES.includes(trimmed)) categories.add(trimmed);
      });
    }

    // Price
    const pMin = params.get('priceMin') || params.get('min');
    const pMax = params.get('priceMax') || params.get('max');
    const priceMin = (pMin !== null && !isNaN(Number(pMin)) && Number(pMin) >= 0) ? Number(pMin) : null;
    const priceMax = (pMax !== null && !isNaN(Number(pMax)) && Number(pMax) >= 0) ? Number(pMax) : null;

    // Search & Sort
    const search = params.get('q') || '';
    const sortParam = params.get('sort');
    const sort = VALID_SORTS.includes(sortParam) ? sortParam : 'newest';

    queryState = {
      categories,
      priceMin,
      priceMax,
      search: search.trim(),
      sort
    };
  }
  const state = { ...queryState, currentPage: 1 };

  // Đồng bộ bộ lọc ban đầu lên các trường biểu mẫu
  {
    document.querySelectorAll('input[name="category"]').forEach(cb => {
      cb.checked = state.categories.has(cb.value);
    });

    const minInput = document.querySelector('[data-price-min]');
    if (minInput) minInput.value = state.priceMin !== null ? state.priceMin : '';

    const maxInput = document.querySelector('[data-price-max]');
    if (maxInput) maxInput.value = state.priceMax !== null ? state.priceMax : '';

    const searchInput = document.querySelector('.toolbar [data-search]');
    if (searchInput) searchInput.value = state.search || '';

    const sortSelect = document.querySelector('[data-sort]');
    if (sortSelect) sortSelect.value = state.sort || 'newest';
  }

  // Đếm số sản phẩm thuộc từng loại
  document.querySelectorAll('input[data-filter="category"]').forEach(cb => {
    const parentLabel = cb.closest('.check');
    if (!parentLabel) return;
    const countSpan = parentLabel.querySelector('.check__count');
    if (!countSpan) return;

    countSpan.textContent = products.filter(p => p.category === cb.value).length;
  });

  // Gắn sự kiện đổi loại sản phẩm, tìm kiếm, giá và sắp xếp
  {
    document.querySelectorAll('input[data-filter="category"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const val = cb.value;

        if (cb.checked) {
          state.categories.add(val);
        } else {
          state.categories.delete(val);
        }
        render(true);
      });
    });

    const searchForm = document.querySelector('.toolbar [data-search-form]');
    const searchInput = document.querySelector('.toolbar [data-search]');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        state.search = searchInput.value.trim();
        render(true);
      });
    }
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (searchInput) {
          state.search = searchInput.value.trim();
          render(true);
        }
      });
    }

    const sortSelect = document.querySelector('[data-sort]');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        render(true);
      });
    }

    const minInput = document.querySelector('[data-price-min]');
    const maxInput = document.querySelector('[data-price-max]');
    const applyPriceBtn = document.querySelector('[data-price-apply]');

    if (applyPriceBtn && minInput && maxInput) {
      applyPriceBtn.addEventListener('click', () => {
        const minVal = minInput.value.trim() ? Number(minInput.value) : null;
        const maxVal = maxInput.value.trim() ? Number(maxInput.value) : null;
        const errorSpan = document.querySelector('[data-error-for="priceRange"]');

        if (minVal !== null && minVal < 0) {
          if (errorSpan) errorSpan.textContent = 'Giá thấp nhất không thể là số âm.';
          return;
        }
        if (maxVal !== null && maxVal < 0) {
          if (errorSpan) errorSpan.textContent = 'Giá cao nhất không thể là số âm.';
          return;
        }
        if (minVal !== null && maxVal !== null && minVal > maxVal) {
          if (errorSpan) errorSpan.textContent = 'Giá thấp nhất không thể lớn hơn giá cao nhất.';
          return;
        }

        if (errorSpan) errorSpan.textContent = '';
        state.priceMin = minVal;
        state.priceMax = maxVal;
        render(true);
      });
    }

    document.querySelectorAll('[data-filter-reset]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.categories.clear();
        state.priceMin = null;
        state.priceMax = null;
        state.search = '';
        state.sort = 'newest';

        if (minInput) minInput.value = '';
        if (maxInput) maxInput.value = '';
        if (searchInput) searchInput.value = '';
        const errorSpan = document.querySelector('[data-error-for="priceRange"]');
        if (errorSpan) errorSpan.textContent = '';

        document.querySelectorAll('input[name="category"]').forEach(cb => {
          cb.checked = false;
        });
        if (sortSelect) sortSelect.value = 'newest';
        render(true);
      });
    });
  }

  // Mở/đóng bộ lọc trên mobile, quản lý focus và phím Escape
  {
    const openDrawerBtn = document.querySelector('[data-filters-open]');
    const closeDrawerBtn = document.querySelector('[data-filters-close]');
    const backdrop = document.querySelector('[data-filters-backdrop]');
    const filtersAside = document.querySelector('[data-filters]');

    if (openDrawerBtn && filtersAside) {
      const closeDrawer = () => {
        if (!filtersAside.classList.contains('is-open')) return;
        filtersAside.classList.remove('is-open');
        if (backdrop) backdrop.classList.add('is-hidden');
        openDrawerBtn.setAttribute('aria-expanded', 'false');
        openDrawerBtn.focus();
      };

      openDrawerBtn.addEventListener('click', () => {
        filtersAside.classList.add('is-open');
        if (backdrop) backdrop.classList.remove('is-hidden');
        openDrawerBtn.setAttribute('aria-expanded', 'true');
        if (closeDrawerBtn) closeDrawerBtn.focus();
      });
      if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
      if (backdrop) backdrop.addEventListener('click', closeDrawer);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && filtersAside.classList.contains('is-open')) {
          closeDrawer();
        }
      });
    }
  }

  render();

  function render(resetPage = false) {
    if (resetPage) state.currentPage = 1;

    // Cập nhật URL từ bộ lọc hiện tại
    if (typeof window !== 'undefined' && window.history) {
      const params = new URLSearchParams();
      if (state.categories.size > 0) params.set('cat', Array.from(state.categories).join(','));
      if (state.priceMin !== null) params.set('priceMin', String(state.priceMin));
      if (state.priceMax !== null) params.set('priceMax', String(state.priceMax));
      if (state.search) params.set('q', state.search);
      if (state.sort && state.sort !== 'newest') params.set('sort', state.sort);

      const queryString = params.toString();
      const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    const filteredList = filterAndSortProducts(products, state);

    const totalResults = filteredList.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIdx = (state.currentPage - 1) * PAGE_SIZE;
    const paginatedSlice = filteredList.slice(startIdx, startIdx + PAGE_SIZE);

    if (productsContainer) {
      productsContainer.innerHTML = paginatedSlice.map(createProductCard).join('');
    }

    const countEl = document.querySelector('[data-result-count]');
    if (countEl) countEl.textContent = totalResults;

    const emptyEl = document.querySelector('[data-empty]');
    if (emptyEl) {
      if (totalResults === 0) {
        emptyEl.classList.remove('is-hidden');
        if (productsContainer) productsContainer.style.display = 'none';
      } else {
        emptyEl.classList.add('is-hidden');
        if (productsContainer) productsContainer.style.display = '';
      }
    }

    // Hiển thị và xử lý các nút phân trang
    const paginationEl = document.querySelector('[data-pagination]');
    if (paginationEl) {
      if (totalPages <= 1) {
        paginationEl.style.display = 'none';
      } else {
        const onPageChange = (newPage) => {
          state.currentPage = newPage;
          render(false);
          const mainShop = document.querySelector('.shop');
          if (mainShop) {
            window.scrollTo({ top: mainShop.offsetTop - 60, behavior: 'smooth' });
          }
        };

        paginationEl.style.display = 'flex';

        let html = `
          <button class="pagination__btn" type="button" aria-label="Trang trước" data-page-prev ${state.currentPage === 1 ? 'disabled' : ''}>
            <svg class="icon" aria-hidden="true"><use href="#i-chevron-left"></use></svg>
          </button>
        `;

        for (let i = 1; i <= totalPages; i++) {
          const isActive = i === state.currentPage;
          html += `
            <button class="pagination__btn ${isActive ? 'is-active' : ''}" type="button" ${isActive ? 'aria-current="page"' : ''} data-page="${i}">${i}</button>
          `;
        }

        html += `
          <button class="pagination__btn" type="button" aria-label="Trang sau" data-page-next ${state.currentPage === totalPages ? 'disabled' : ''}>
            <svg class="icon" aria-hidden="true"><use href="#i-chevron-right"></use></svg>
          </button>
        `;

        paginationEl.innerHTML = html;

        paginationEl.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            const page = parseInt(btn.getAttribute('data-page'), 10);
            if (page && page !== state.currentPage) onPageChange(page);
          });
        });

        const prevBtn = paginationEl.querySelector('[data-page-prev]');
        if (prevBtn) {
          prevBtn.addEventListener('click', () => {
            if (state.currentPage > 1) onPageChange(state.currentPage - 1);
          });
        }

        const nextBtn = paginationEl.querySelector('[data-page-next]');
        if (nextBtn) {
          nextBtn.addEventListener('click', () => {
            if (state.currentPage < totalPages) onPageChange(state.currentPage + 1);
          });
        }
      }
    }
  }
}
