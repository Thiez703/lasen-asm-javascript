import { products, getProductById } from '../services/dataService.js';
import { addToCart } from '../services/cartService.js';
import { isFavorite, toggleFavorite, getFavoriteProducts } from '../services/favoriteService.js';
import { formatPrice, getPrice, showToast } from '../utils/helpers.js';

const PAGE_SIZE = 9;

export function createStars(rating) {
  return '<svg class="rating__star"><use href="#i-star"></use></svg>'.repeat(Math.round(rating));
}

export function createProductCard(product) {
  const price = getPrice(product);
  const isSale = price < product.price;
  const badgeHTML = product.badge ? `<span class="badge card__badge">${product.badge}</span>` : '';
  const oldPriceHTML = isSale ? `<s class="card__price-old">${formatPrice(product.price)}</s>` : '';
  const heartClass = isFavorite(product.id) ? 'is-active' : '';

  return `
    <article class="card">
      <a class="card__media" href="product-detail.html?id=${product.id}" tabindex="-1">
        <img class="card__img" src="${product.image}" alt="${product.name}" loading="lazy">
        ${badgeHTML}
        <span class="card__quick">${product.quickInfo}</span>
      </a>
      <div class="card__body">
        <h3 class="card__name"><a href="product-detail.html?id=${product.id}">${product.name}</a></h3>
        <p class="card__meta">${product.brandName} • ${product.capacity}</p>
        <p class="rating">
          <span class="rating__stars" aria-hidden="true">${createStars(product.rating)}</span>
          <span class="rating__value">${product.rating}</span>
          <span class="rating__count">(${product.ratingCount})</span>
        </p>
        <p class="card__price ${isSale ? 'card__price--sale' : ''}">
          <span class="card__price-now">${formatPrice(price)}</span>
          ${oldPriceHTML}
        </p>
        <div class="card__actions">
          <button class="btn btn--primary" type="button" data-add-to-cart data-id="${product.id}">Thêm vào giỏ</button>
          <button class="btn btn--outline btn--icon ${heartClass}" type="button" aria-label="Yêu thích" data-favorite-toggle data-id="${product.id}">
            <svg class="icon" aria-hidden="true"><use href="#i-heart"></use></svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

export function renderProductList(selector, list) {
  const container = document.querySelector(selector);
  if (container) {
    container.innerHTML = list.map(product => createProductCard(product)).join('');
  }
}

// Bắt sự kiện bấm nút "Thêm vào giỏ", nút trái tim trên cả trang và hiện các danh sách sản phẩm
export function renderProducts() {
  document.addEventListener('click', (event) => {
    const cartButton = event.target.closest('.card [data-add-to-cart]');
    if (cartButton) {
      addToCart(cartButton.getAttribute('data-id'), 1);
    }

    const heartButton = event.target.closest('[data-favorite-toggle], [data-wishlist]');
    if (heartButton) {
      onHeartClick(heartButton.getAttribute('data-id'));
    }
  });

  renderHomeLists();
  renderProductsPage();
}

function onHeartClick(productId) {
  const product = getProductById(productId);
  const liked = toggleFavorite(productId);

  if (liked) {
    showToast(`Đã thêm "${product.name}" vào danh sách yêu thích!`);
  } else {
    showToast(`Đã bỏ "${product.name}" khỏi danh sách yêu thích.`);
  }

  document.querySelectorAll('[data-favorite-toggle], [data-wishlist]').forEach(button => {
    if (button.getAttribute('data-id') === productId) {
      button.classList.toggle('is-active', liked);
    }
  });

  renderWishlist();
}

// Hiện tab Yêu thích ở trang hồ sơ
export function renderWishlist() {
  if (!document.querySelector('[data-list="wishlist"]')) return;

  const favorites = getFavoriteProducts();
  renderProductList('[data-list="wishlist"]', favorites);
  document.querySelector('[data-wishlist-count]').textContent = favorites.length;
  document.querySelector('[data-wishlist-empty]').classList.toggle('is-hidden', favorites.length > 0);
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

// Hiện 5 sản phẩm của loại đã chọn trong mục gợi ý ở trang chủ
function showCategory(category) {
  const list = products.filter(product => product.category === category).slice(0, 5);
  renderProductList('[data-list="category-recommendations"]', list);
}

// Lọc rồi sắp xếp sản phẩm theo bộ lọc
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
    const activeClass = page === currentPage ? 'is-active' : '';
    html += `<button class="pagination__btn ${activeClass}" type="button" data-page="${page}">${page}</button>`;
  }
  html += `
    <button class="pagination__btn" type="button" aria-label="Trang sau" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
      <svg class="icon" aria-hidden="true"><use href="#i-chevron-right"></use></svg>
    </button>
  `;
  pagination.innerHTML = html;
}

function renderProductsPage() {
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
  const priceError = document.querySelector('[data-error-for="priceRange"]');

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

  document.querySelector('.toolbar [data-search-form]').addEventListener('submit', (event) => {
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
      priceError.textContent = 'Giá không được là số âm.';
      return;
    }
    if (minPrice > maxPrice) {
      priceError.textContent = 'Giá thấp nhất không thể lớn hơn giá cao nhất.';
      return;
    }

    priceError.textContent = '';
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
      priceError.textContent = '';
      showProducts();
    });
  });

  document.querySelector('[data-pagination]').addEventListener('click', (event) => {
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
