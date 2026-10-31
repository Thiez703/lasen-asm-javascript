import { products } from '../services/dataService.js';
import { renderProductList } from '../components/productCard.js';
import { getPrice } from '../utils/price.js';
import { showError } from '../utils/form.js';

const PAGE_SIZE = 9;

export function renderProducts() {
  if (!document.querySelector('[data-list="products"]')) return;

  const params = new URLSearchParams(window.location.search);
  const filters = {
    categories: params.get('cat') ? params.get('cat').split(',') : [],
    keyword: params.get('q') || '',
    minPrice: 0,
    maxPrice: Infinity,
    sort: 'newest',
    page: 1
  };

  const checkboxes = document.querySelectorAll('[data-filter="category"]');
  const searchInput = document.querySelector('[data-search]');
  const sortSelect = document.querySelector('[data-sort]');
  const minInput = document.querySelector('[data-price-min]');
  const maxInput = document.querySelector('[data-price-max]');

  function showProducts() {
    const list = filterProducts(filters);
    const totalPages = Math.ceil(list.length / PAGE_SIZE);
    const start = (filters.page - 1) * PAGE_SIZE;

    renderProductList('[data-list="products"]', list.slice(start, start + PAGE_SIZE));
    document.querySelector('[data-result-count]').textContent = list.length;
    document.querySelector('[data-empty]').classList.toggle('is-hidden', list.length > 0);
    renderPagination(filters.page, totalPages);
  }

  searchInput.value = filters.keyword;
  checkboxes.forEach(checkbox => {
    checkbox.checked = filters.categories.includes(checkbox.value);
    const count = products.filter(product => product.category === checkbox.value).length;
    checkbox.closest('.check').querySelector('.check__count').textContent = count;
  });

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        filters.categories.push(checkbox.value);
      } else {
        filters.categories = filters.categories.filter(category => category !== checkbox.value);
      }
      filters.page = 1;
      showProducts();
    });
  });

  searchInput.addEventListener('input', () => {
    filters.keyword = searchInput.value.trim();
    filters.page = 1;
    showProducts();
  });

  document.querySelector('.toolbar [data-search-form]').addEventListener('submit', event => {
    event.preventDefault();
  });

  sortSelect.addEventListener('change', () => {
    filters.sort = sortSelect.value;
    filters.page = 1;
    showProducts();
  });

  document.querySelector('[data-price-apply]').addEventListener('click', () => {
    const minPrice = minInput.value === '' ? 0 : Number(minInput.value);
    const maxPrice = maxInput.value === '' ? Infinity : Number(maxInput.value);

    if (minPrice < 0 || maxPrice < 0) {
      showError('priceRange', 'Giá không được là số âm.');
      return;
    }
    if (minPrice > maxPrice) {
      showError('priceRange', 'Giá thấp nhất không thể lớn hơn giá cao nhất.');
      return;
    }

    showError('priceRange', '');
    filters.minPrice = minPrice;
    filters.maxPrice = maxPrice;
    filters.page = 1;
    showProducts();
  });

  document.querySelectorAll('[data-filter-reset]').forEach(button => {
    button.addEventListener('click', () => {
      filters.categories = [];
      filters.keyword = '';
      filters.minPrice = 0;
      filters.maxPrice = Infinity;
      filters.sort = 'newest';
      filters.page = 1;

      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      searchInput.value = '';
      minInput.value = '';
      maxInput.value = '';
      sortSelect.value = 'newest';
      showError('priceRange', '');
      showProducts();
    });
  });

  document.querySelector('[data-pagination]').addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button) return;

    filters.page = Number(button.getAttribute('data-page'));
    showProducts();
    window.scrollTo({ top: document.querySelector('.shop').offsetTop - 60, behavior: 'smooth' });
  });

  const filtersBox = document.querySelector('[data-filters]');
  const backdrop = document.querySelector('[data-filters-backdrop]');

  function openFilters() {
    filtersBox.classList.add('is-open');
    backdrop.classList.remove('is-hidden');
  }

  function closeFilters() {
    filtersBox.classList.remove('is-open');
    backdrop.classList.add('is-hidden');
  }

  document.querySelector('[data-filters-open]').addEventListener('click', openFilters);
  document.querySelector('[data-filters-close]').addEventListener('click', closeFilters);
  backdrop.addEventListener('click', closeFilters);

  showProducts();
}

function filterProducts(filters) {
  const keyword = filters.keyword.toLowerCase();

  const list = products.filter(product => {
    const price = getPrice(product);
    const matchKeyword =
      product.name.toLowerCase().includes(keyword) ||
      product.brandName.toLowerCase().includes(keyword) ||
      product.categoryName.toLowerCase().includes(keyword) ||
      product.quickInfo.toLowerCase().includes(keyword) ||
      product.description.toLowerCase().includes(keyword);
    const matchCategory = filters.categories.length === 0 || filters.categories.includes(product.category);
    const matchPrice = price >= filters.minPrice && price <= filters.maxPrice;
    return matchKeyword && matchCategory && matchPrice;
  });

  if (filters.sort === 'price-asc') {
    list.sort((a, b) => getPrice(a) - getPrice(b));
  } else if (filters.sort === 'price-desc') {
    list.sort((a, b) => getPrice(b) - getPrice(a));
  } else if (filters.sort === 'best-seller') {
    list.sort((a, b) => b.sold - a.sold);
  } else {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return list;
}

function renderPagination(currentPage, totalPages) {
  const pagination = document.querySelector('[data-pagination]');
  pagination.classList.toggle('is-hidden', totalPages <= 1);

  let html = `
    <button class="pagination__btn" type="button" aria-label="Trang trước" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
      <svg class="icon" aria-hidden="true"><use href="#i-chevron-left"></use></svg>
    </button>
  `;
  for (let page = 1; page <= totalPages; page++) {
    let activeClass;

    if (page === currentPage) {
      activeClass = 'is-active';
    } else {
      activeClass = '';
    }
    html += `<button class="pagination__btn ${activeClass}" type="button" data-page="${page}">${page}</button>`;
  }
  html += `
    <button class="pagination__btn" type="button" aria-label="Trang sau" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
      <svg class="icon" aria-hidden="true"><use href="#i-chevron-right"></use></svg>
    </button>
  `;
  pagination.innerHTML = html;
}
