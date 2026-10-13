/**
 * Module xử lý Tìm kiếm, Lọc đa tiêu chí và Sắp xếp cho trang products.html
 * Cung cấp pure filter function và phân trang client-side hoàn chỉnh
 */

import { products } from '../services/dataService.js';
import { createProductCard } from '../render/products.js';

const VALID_CATEGORIES = ['lam-sach', 'duong-am', 'chong-nang', 'dac-tri', 'mat-na'];
const VALID_BRANDS = ['la-sen', 'sen-viet', 'pure-lotus', 'thao-moc-xanh'];
const VALID_SKINS = ['da-dau', 'da-kho', 'da-hon-hop', 'da-nhay-cam', 'moi-loai-da'];
const VALID_SORTS = ['newest', 'price-asc', 'price-desc', 'best-seller'];
const PAGE_SIZE = 9;

/**
 * Pure function lọc và sắp xếp danh sách sản phẩm (Production Logic)
 * 
 * @param {Array} list Danh sách sản phẩm gốc
 * @param {Object} criteria Tiêu chí lọc
 * @returns {Array} Danh sách sản phẩm sau lọc và sắp xếp
 */
export function filterAndSortProducts(list, criteria = {}) {
  let result = [...list];

  const {
    categories = [],
    brands = [],
    skins = [],
    priceMin = null,
    priceMax = null,
    search = '',
    saleOnly = false,
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

  // 2. Lọc theo Danh mục (OR trong nhóm)
  const catArray = Array.isArray(categories) ? categories : Array.from(categories);
  if (catArray.length > 0) {
    const catSet = new Set(catArray);
    result = result.filter(p => catSet.has(p.category));
  }

  // 3. Lọc theo Loại da (OR trong nhóm)
  const skinArray = Array.isArray(skins) ? skins : Array.from(skins);
  if (skinArray.length > 0) {
    const skinSet = new Set(skinArray);
    result = result.filter(p => {
      if (!Array.isArray(p.skin)) return false;
      return p.skin.some(s => skinSet.has(s));
    });
  }

  // 4. Lọc theo Thương hiệu (OR trong nhóm)
  const brandArray = Array.isArray(brands) ? brands : Array.from(brands);
  if (brandArray.length > 0) {
    const brandSet = new Set(brandArray);
    result = result.filter(p => brandSet.has(p.brand));
  }

  // 5. Lọc sản phẩm có khuyến mãi (saleOnly)
  if (saleOnly) {
    result = result.filter(p => typeof p.salePrice === 'number' && p.salePrice < p.price);
  }

  // 6. Lọc theo Khoảng giá (AND)
  if (priceMin !== null && !isNaN(priceMin) && priceMin >= 0) {
    result = result.filter(p => (p.salePrice || p.price) >= priceMin);
  }
  if (priceMax !== null && !isNaN(priceMax) && priceMax >= 0) {
    result = result.filter(p => (p.salePrice || p.price) <= priceMax);
  }

  // 7. Sắp xếp (Sort)
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

/**
 * Đọc và chuẩn hóa các query params từ URL
 * @returns {Object}
 */
function parseQueryParams() {
  if (typeof window === 'undefined') return {};
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

  // Brand
  const brandParam = params.get('brand');
  const brands = new Set();
  if (brandParam) {
    brandParam.split(',').forEach(b => {
      const trimmed = b.trim();
      if (VALID_BRANDS.includes(trimmed)) brands.add(trimmed);
    });
  }

  // Skin
  const skinParam = params.get('skin');
  const skins = new Set();
  if (skinParam) {
    skinParam.split(',').forEach(s => {
      const trimmed = s.trim();
      if (VALID_SKINS.includes(trimmed)) skins.add(trimmed);
    });
  }

  // Price
  const pMin = params.get('priceMin') || params.get('min');
  const pMax = params.get('priceMax') || params.get('max');
  const priceMin = (pMin !== null && !isNaN(Number(pMin)) && Number(pMin) >= 0) ? Number(pMin) : null;
  const priceMax = (pMax !== null && !isNaN(Number(pMax)) && Number(pMax) >= 0) ? Number(pMax) : null;

  // Sale
  const saleParam = params.get('sale');
  const saleOnly = saleParam === 'true' || saleParam === '1';

  // Search & Sort
  const search = params.get('q') || '';
  const sortParam = params.get('sort');
  const sort = VALID_SORTS.includes(sortParam) ? sortParam : 'newest';

  return {
    categories,
    brands,
    skins,
    priceMin,
    priceMax,
    saleOnly,
    search: search.trim(),
    sort
  };
}

/**
 * Cập nhật URL hiện tại phản ánh đúng bộ lọc mà không tải lại trang
 */
function updateURL(state) {
  if (typeof window === 'undefined' || !window.history) return;

  const params = new URLSearchParams();
  if (state.categories.size > 0) params.set('cat', Array.from(state.categories).join(','));
  if (state.brands.size > 0) params.set('brand', Array.from(state.brands).join(','));
  if (state.skins.size > 0) params.set('skin', Array.from(state.skins).join(','));
  if (state.priceMin !== null) params.set('priceMin', String(state.priceMin));
  if (state.priceMax !== null) params.set('priceMax', String(state.priceMax));
  if (state.saleOnly) params.set('sale', 'true');
  if (state.search) params.set('q', state.search);
  if (state.sort && state.sort !== 'newest') params.set('sort', state.sort);

  const queryString = params.toString();
  const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

export function initProductFilters() {
  const productsContainer = document.querySelector('[data-list="products"]');
  const filtersAside = document.querySelector('[data-filters]');
  if (!productsContainer && !filtersAside) return;

  const state = {
    ...parseQueryParams(),
    currentPage: 1
  };

  syncInputsWithState(state);
  updateFilterBadges();
  setupFilterEvents(state, render);
  setupFilterDrawer();

  render();

  function render(resetPage = false) {
    if (resetPage) state.currentPage = 1;

    updateURL(state);

    const filteredList = filterAndSortProducts(products, {
      categories: Array.from(state.categories),
      brands: Array.from(state.brands),
      skins: Array.from(state.skins),
      priceMin: state.priceMin,
      priceMax: state.priceMax,
      saleOnly: state.saleOnly,
      search: state.search,
      sort: state.sort
    });

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

    renderPagination(state, totalPages, (newPage) => {
      state.currentPage = newPage;
      render(false);
      const mainShop = document.querySelector('.shop');
      if (mainShop) {
        window.scrollTo({ top: mainShop.offsetTop - 60, behavior: 'smooth' });
      }
    });
  }
}

/**
 * Hiển thị và xử lý các nút phân trang client-side
 */
function renderPagination(state, totalPages, onPageChange) {
  const paginationEl = document.querySelector('[data-pagination]');
  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

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

/**
 * Đồng bộ giá trị state lên các trường biểu mẫu
 */
function syncInputsWithState(state) {
  document.querySelectorAll('input[name="category"]').forEach(cb => {
    cb.checked = state.categories.has(cb.value);
  });
  document.querySelectorAll('input[name="skin"]').forEach(cb => {
    cb.checked = state.skins.has(cb.value);
  });
  document.querySelectorAll('input[name="brand"]').forEach(cb => {
    cb.checked = state.brands.has(cb.value);
  });
  document.querySelectorAll('input[name="sale"], input[data-filter="sale"]').forEach(cb => {
    cb.checked = Boolean(state.saleOnly);
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

/**
 * Đếm số lượng sản phẩm thực tế theo từng tiêu chí filter
 */
function updateFilterBadges() {
  document.querySelectorAll('input[data-filter]').forEach(cb => {
    const filterType = cb.getAttribute('data-filter');
    const val = cb.value;
    const parentLabel = cb.closest('.check');
    if (!parentLabel) return;
    const countSpan = parentLabel.querySelector('.check__count');
    if (!countSpan) return;

    let count = 0;
    if (filterType === 'category') {
      count = products.filter(p => p.category === val).length;
    } else if (filterType === 'skin') {
      count = products.filter(p => Array.isArray(p.skin) && p.skin.includes(val)).length;
    } else if (filterType === 'brand') {
      count = products.filter(p => p.brand === val).length;
    } else if (filterType === 'sale') {
      count = products.filter(p => typeof p.salePrice === 'number' && p.salePrice < p.price).length;
    }

    countSpan.textContent = count;
  });
}

/**
 * Gắn các sự kiện tương tác filter
 */
function setupFilterEvents(state, render) {
  document.querySelectorAll('input[data-filter]').forEach(cb => {
    cb.addEventListener('change', () => {
      const type = cb.getAttribute('data-filter');
      const val = cb.value;

      if (type === 'sale') {
        state.saleOnly = cb.checked;
        render(true);
        return;
      }

      const set = type === 'category' ? state.categories : (type === 'skin' ? state.skins : state.brands);

      if (cb.checked) {
        set.add(val);
      } else {
        set.delete(val);
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
      state.skins.clear();
      state.brands.clear();
      state.priceMin = null;
      state.priceMax = null;
      state.saleOnly = false;
      state.search = '';
      state.sort = 'newest';

      if (minInput) minInput.value = '';
      if (maxInput) maxInput.value = '';
      if (searchInput) searchInput.value = '';
      const errorSpan = document.querySelector('[data-error-for="priceRange"]');
      if (errorSpan) errorSpan.textContent = '';

      syncInputsWithState(state);
      render(true);
    });
  });
}

/**
 * Xử lý Mobile Filter Drawer với aria-expanded, focus management và Escape
 */
function setupFilterDrawer() {
  const openDrawerBtn = document.querySelector('[data-filters-open]');
  const closeDrawerBtn = document.querySelector('[data-filters-close]');
  const backdrop = document.querySelector('[data-filters-backdrop]');
  const filtersAside = document.querySelector('[data-filters]');

  if (!openDrawerBtn || !filtersAside) return;

  const openDrawer = () => {
    filtersAside.classList.add('is-open');
    if (backdrop) backdrop.classList.remove('is-hidden');
    openDrawerBtn.setAttribute('aria-expanded', 'true');
    if (closeDrawerBtn) closeDrawerBtn.focus();
  };

  const closeDrawer = () => {
    if (!filtersAside.classList.contains('is-open')) return;
    filtersAside.classList.remove('is-open');
    if (backdrop) backdrop.classList.add('is-hidden');
    openDrawerBtn.setAttribute('aria-expanded', 'false');
    openDrawerBtn.focus();
  };

  openDrawerBtn.addEventListener('click', openDrawer);
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filtersAside.classList.contains('is-open')) {
      closeDrawer();
    }
  });
}
