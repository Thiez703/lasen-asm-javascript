import { products } from '../data/products.js';

export function formatPrice(price) {
  return price.toLocaleString('vi-VN') + 'đ';
}

function createProductCard(product) {
  const isSale = product.salePrice && product.salePrice < product.price;
  const nowPrice = isSale ? product.salePrice : product.price;
  const oldPriceMarkup = isSale ? `<s class="card__price-old" data-price-old>${formatPrice(product.price)}</s>` : '';
  const badge = isSale ? `<span class="badge card__badge">-${Math.round((1 - product.salePrice / product.price) * 100)}%</span>` : '';

  return `
        <article class="card" data-product data-id="${product.id}">
          <a class="card__media" href="product-detail.html?id=${product.id}" tabindex="-1">
            <img class="card__img" src="${product.image}" alt="${product.name}">
            ${badge}
            <span class="card__quick">${product.quickInfo || ''}</span>
          </a>
          <div class="card__body">
            <h3 class="card__name"><a href="product-detail.html?id=${product.id}">${product.name}</a></h3>
            <p class="card__meta">${product.brand || 'Lá Sen'} • ${product.capacity || '50ml'}</p>
            <p class="rating" data-rating="${product.rating}">
              <span class="rating__stars" aria-hidden="true">
                ${'<svg class="rating__star"><use href="#i-star"></use></svg>'.repeat(Math.round(product.rating))}
              </span>
              <span class="rating__value">${product.rating}</span>
              <span class="rating__count">(${product.ratingCount})</span>
            </p>
            <p class="card__price ${isSale ? 'card__price--sale' : ''}">
              <span class="card__price-now" data-price>${formatPrice(nowPrice)}</span>
              ${oldPriceMarkup}
            </p>
            <div class="card__actions">
              <button class="btn btn--primary" type="button" data-add-to-cart data-id="${product.id}">Thêm vào giỏ</button>
              <button class="btn btn--outline btn--icon" type="button" aria-label="So sánh" data-compare-add data-id="${product.id}">
                <svg class="icon" aria-hidden="true"><use href="#i-compare"></use></svg>
              </button>
            </div>
          </div>
        </article>
    `;
}

export function renderProducts() {
  const productsList = document.querySelector('[data-list="products"]');
  if (productsList) {
    productsList.innerHTML = products.map(createProductCard).join('');
  }

  const flashList = document.querySelector('[data-list="flash"]');
  if (flashList) flashList.innerHTML = products.slice(0, 4).map(createProductCard).join('');

  const hotList = document.querySelector('[data-list="hot"]');
  if (hotList) hotList.innerHTML = products.filter(p => p.isFeatured).slice(0, 4).map(createProductCard).join('');

  const newList = document.querySelector('[data-list="new"]');
  if (newList) newList.innerHTML = products.filter(p => p.isNew).slice(0, 4).map(createProductCard).join('');

  const skinList = document.querySelector('[data-list="skin"]');
  if (skinList) skinList.innerHTML = products.slice(0, 5).map(createProductCard).join('');

  const suggestList = document.querySelector('[data-list="suggest"]');
  if (suggestList) suggestList.innerHTML = products.slice(0, 4).map(createProductCard).join('');

  const wishlist = document.querySelector('[data-list="wishlist"]');
  if (wishlist) {
    wishlist.innerHTML = products.slice(0, 4).map(createProductCard).join('');
  }

  const relatedList = document.querySelector('[data-list="related"]');
  if (relatedList) {
    relatedList.innerHTML = products.slice(0, 4).map(createProductCard).join('');
  }

  const recentList = document.querySelector('[data-list="recent"]');
  if (recentList) {
    recentList.innerHTML = products.slice(4, 8).map(createProductCard).join('');
  }
}
