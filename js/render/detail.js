/**
 * Render trang chi tiết sản phẩm (product-detail.html)
 */

import { products, getProductById, getReviewsByProductId } from '../services/dataService.js';
import { formatPrice, escapeHTML, parseInteger } from '../utils/format.js';
import { cartService } from '../services/cartService.js';
import { showToast } from '../services/toast.js';
import { storage } from '../services/storage.js';
import { createProductCard } from './products.js';
import { favoriteService } from '../services/favoriteService.js';

const RECENT_KEY = 'lasen_recent_products';

export function renderProductDetail() {
  const detailArticle = document.querySelector('article.detail[data-product]');
  if (!detailArticle) return;

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  // Xử lý Fallback khi sai hoặc thiếu ID
  const product = productId ? getProductById(productId) : null;
  if (!product) {
    const main = document.querySelector('main#main');
    if (main) {
      main.innerHTML = `
    <div class="container" style="padding-block: var(--sp-12, 60px); text-align: center;">
      <svg class="icon" style="width: 64px; height: 64px; color: var(--c-muted, #999); margin-bottom: 20px;" aria-hidden="true">
        <use href="#i-search"></use>
      </svg>
      <h1 style="font-size: 24px; margin-bottom: 12px;">Không tìm thấy sản phẩm</h1>
      <p style="color: var(--c-muted, #666); max-width: 480px; margin: 0 auto 24px;">
        Sản phẩm bạn đang tìm kiếm không tồn tại hoặc đường liên kết đã thay đổi. Vui lòng kiểm tra lại mã sản phẩm.
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <a class="btn btn--primary" href="products.html">Xem tất cả sản phẩm</a>
        <a class="btn btn--outline" href="index.html">Về trang chủ</a>
      </div>
    </div>
  `;
    }
    return;
  }

  // Cập nhật tiêu đề trang
  document.title = `${product.name} — Lá Sen`;

  // 1. Cập nhật Breadcrumb
  {
    const breadcrumb = document.querySelector('.breadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = `
    <li class="breadcrumb__item"><a class="breadcrumb__link" href="index.html">Trang chủ</a></li>
    <li class="breadcrumb__item"><a class="breadcrumb__link" href="products.html">Sản phẩm</a></li>
    <li class="breadcrumb__item"><a class="breadcrumb__link" href="products.html?cat=${escapeHTML(product.category)}">${escapeHTML(product.categoryName)}</a></li>
    <li class="breadcrumb__item" aria-current="page">${escapeHTML(product.name)}</li>
  `;
    }
  }

  // 2. Render thông tin chính sản phẩm
  {
    detailArticle.setAttribute('data-id', product.id);

    // Thương hiệu & danh mục
    const brandEl = detailArticle.querySelector('.detail__brand');
    if (brandEl) {
      brandEl.innerHTML = `${escapeHTML(product.brandName)} · <a href="products.html?cat=${escapeHTML(product.category)}">${escapeHTML(product.categoryName)}</a>`;
    }

    // Tên
    const nameEl = detailArticle.querySelector('.detail__name');
    if (nameEl) nameEl.textContent = product.name;

    // Rating & Đã bán
    const ratingEl = detailArticle.querySelector('.detail__rating');
    if (ratingEl) {
      const starCount = Math.max(1, Math.min(5, Math.round(product.rating || 5)));
      const starsHtml = '<svg class="rating__star"><use href="#i-star"></use></svg>'.repeat(starCount);
      ratingEl.setAttribute('data-rating', product.rating);
      ratingEl.innerHTML = `
      <span class="rating__stars" aria-hidden="true">${starsHtml}</span>
      <span class="rating__value">${product.rating}</span>
      <a class="rating__count" href="#panel-danh-gia">${product.ratingCount || 0} đánh giá</a>
      <span class="rating__count">· Đã bán ${(product.sold || 0).toLocaleString('vi-VN')}</span>
    `;
    }

    // Giá & Khuyến mãi
    const isSale = typeof product.salePrice === 'number' && product.salePrice < product.price;
    const nowPrice = isSale ? product.salePrice : product.price;
    const priceNowEl = detailArticle.querySelector('[data-price]');
    if (priceNowEl) priceNowEl.textContent = formatPrice(nowPrice);

    const priceOldEl = detailArticle.querySelector('[data-price-old]');
    if (priceOldEl) {
      if (isSale) {
        priceOldEl.textContent = formatPrice(product.price);
        priceOldEl.style.display = '';
      } else {
        priceOldEl.style.display = 'none';
      }
    }

    const saveEl = detailArticle.querySelector('.detail__save');
    if (saveEl) {
      if (isSale) {
        const diff = product.price - product.salePrice;
        saveEl.textContent = `Tiết kiệm ${formatPrice(diff)}`;
        saveEl.style.display = '';
      } else {
        saveEl.style.display = 'none';
      }
    }

    // Mô tả dẫn dắt
    const leadEl = detailArticle.querySelector('.detail__lead');
    if (leadEl) leadEl.textContent = product.description;

    // Dung tích & loại da
    const volumeEl = detailArticle.querySelector('[data-volume]');
    if (volumeEl) volumeEl.textContent = product.capacity || '50ml';

    const skinEl = detailArticle.querySelector('[data-skin]');
    if (skinEl) skinEl.textContent = product.skinText || 'Mọi loại da';

    // Tồn kho
    const stockCountEl = detailArticle.querySelector('[data-stock-count]');
    const stockWrapEl = detailArticle.querySelector('[data-stock]');
    if (stockCountEl) stockCountEl.textContent = product.stock;
    if (stockWrapEl) {
      if (product.stock <= 0) {
        stockWrapEl.innerHTML = '<span style="color: var(--c-sale, #c0392b);">Hết hàng — Vui lòng quay lại sau</span>';
      }
    }

    // Vô hiệu hóa các nút mua hàng khi sản phẩm hết hàng.
    detailArticle.querySelectorAll('[data-add-to-cart], [data-buy-now]').forEach(button => {
      button.setAttribute('data-id', product.id);
      if (product.stock <= 0) {
        button.disabled = true;
        button.textContent = 'Tạm hết hàng';
      }
    });

    // Nút yêu thích
    const wishBtn = detailArticle.querySelector('[data-wishlist], [data-favorite-toggle]');
    if (wishBtn) {
      wishBtn.setAttribute('data-id', product.id);
      const isFav = favoriteService.isFavorite(product.id);
      wishBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
      const label = isFav ? 'Bỏ yêu thích' : 'Lưu vào danh sách yêu thích';
      wishBtn.setAttribute('aria-label', label);
      wishBtn.setAttribute('title', label);
      wishBtn.classList.toggle('is-active', isFav);
    }
  }

  // 3. Render thư viện ảnh (Gallery) & a11y
  {
    const gallery = document.querySelector('[data-gallery]');
    if (gallery) {
      const mainImg = gallery.querySelector('[data-gallery-main]');
      const badgeEl = gallery.querySelector('.gallery__badge');
      const thumbsContainer = gallery.querySelector('.gallery__thumbs');

      const imgList = Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : [product.image];

      if (mainImg) {
        mainImg.src = imgList[0];
        mainImg.alt = product.name;
      }

      // Badge sale trên ảnh
      if (badgeEl) {
        if (product.salePrice && product.salePrice < product.price) {
          const pct = Math.round((1 - product.salePrice / product.price) * 100);
          badgeEl.textContent = `-${pct}%`;
          badgeEl.style.display = '';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      // Render các nút thumbnail
      if (thumbsContainer) {
        thumbsContainer.innerHTML = imgList.map((src, idx) => `
      <li>
        <button class="gallery__thumb ${idx === 0 ? 'is-active' : ''}" type="button" 
          aria-label="Xem ảnh ${idx + 1}" aria-selected="${idx === 0}" data-gallery-thumb data-src="${escapeHTML(src)}">
          <img src="${escapeHTML(src)}" alt="${escapeHTML(product.name)} - Ảnh ${idx + 1}" loading="lazy">
        </button>
      </li>
    `).join('');

        const thumbs = thumbsContainer.querySelectorAll('[data-gallery-thumb]');
        thumbs.forEach(thumb => {
          thumb.addEventListener('click', () => {
            const newSrc = thumb.getAttribute('data-src');
            if (mainImg && newSrc) {
              mainImg.src = newSrc;
            }

            thumbs.forEach(t => {
              t.classList.remove('is-active');
              t.setAttribute('aria-selected', 'false');
            });
            thumb.classList.add('is-active');
            thumb.setAttribute('aria-selected', 'true');
          });
        });
      }
    }
  }

  // 4. Khởi tạo bộ chọn số lượng (Quantity)
  {
    const qtyInput = document.querySelector('[data-qty-input]');
    const minusBtn = document.querySelector('[data-qty-minus]');
    const plusBtn = document.querySelector('[data-qty-plus]');
    const addBtn = document.querySelector('.detail__add[data-add-to-cart]');
    const buyNowBtn = document.querySelector('[data-buy-now]');

    if (qtyInput) {
      qtyInput.min = '1';
      qtyInput.max = String(product.stock);
      qtyInput.value = '1';

      const updateQty = (val) => {
        let num = parseInteger(val, 1);
        if (num < 1) num = 1;
        if (num > product.stock) num = product.stock;
        qtyInput.value = num;
      };

      if (minusBtn) {
        minusBtn.addEventListener('click', () => {
          updateQty(parseInt(qtyInput.value, 10) - 1);
        });
      }

      if (plusBtn) {
        plusBtn.addEventListener('click', () => {
          updateQty(parseInt(qtyInput.value, 10) + 1);
        });
      }

      qtyInput.addEventListener('change', () => {
        updateQty(qtyInput.value);
      });

      [addBtn, buyNowBtn].filter(Boolean).forEach(button => {
        button.addEventListener('click', () => {
          updateQty(qtyInput.value);
          const qty = parseInteger(qtyInput.value, 1);

          if (button === buyNowBtn) {
            const params = new URLSearchParams({
              buyNow: product.id,
              quantity: String(qty),
              token: `buy_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
            });
            window.location.href = `checkout.html?${params}`;
            return;
          }

          const res = cartService.addToCart(product.id, qty);
          if (!res.success) {
            showToast(res.message, 'error');
            return;
          }

          showToast(res.message);
        });
      });
    }
  }

  // 5. Khởi tạo Tabs chi tiết & a11y
  {
    const tabsContainer = document.querySelector('[data-tabs]');
    if (tabsContainer) {
      const tabBtns = tabsContainer.querySelectorAll('[data-tab]');
      const tabPanels = tabsContainer.querySelectorAll('[data-tab-panel]');

      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tabId = btn.getAttribute('data-tab');

          tabBtns.forEach(b => {
            b.classList.remove('is-active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');

          tabPanels.forEach(panel => {
            const panelId = panel.getAttribute('data-tab-panel');
            if (panelId === tabId) {
              panel.classList.remove('is-hidden');
            } else {
              panel.classList.add('is-hidden');
            }
          });
        });
      });

      // Đổ nội dung cho panel mô tả
      const moTaPanel = document.querySelector('[data-tab-panel="mo-ta"]');
      if (moTaPanel) {
        moTaPanel.innerHTML = `
      <h2>${escapeHTML(product.name)}</h2>
      <p>${escapeHTML(product.description)}</p>
      <h3>Đặc điểm nổi bật</h3>
      <p>Sản phẩm chiết xuất từ thiên nhiên lành tính, an toàn tuyệt đối cho làn da người Việt. Quy trình sản xuất đạt tiêu chuẩn khắt khe, không chứa hương liệu nhân tạo hay paraben độc hại.</p>
    `;
      }
    }
  }

  // 6. Render Đánh giá (Reviews)
  {
    const reviewsList = document.querySelector('[data-list="reviews"]');
    const reviewScore = document.querySelector('.reviews__score');
    const writeReviewBtn = document.querySelector('[data-review-open]');

    const reviews = getReviewsByProductId(product.id);

    if (reviewScore) {
      reviewScore.innerHTML = `${product.rating}<span>/5</span>`;
    }

    if (reviewsList) {
      if (reviews.length === 0) {
        reviewsList.innerHTML = `
        <li style="padding: 16px; color: var(--c-muted, #777); text-align: center;">
          Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên trải nghiệm và chia sẻ!
        </li>
      `;
      } else {
        reviewsList.innerHTML = reviews.map(r => {
          const starCount = Math.max(1, Math.min(5, Math.round(r.rating || 5)));
          const starsHtml = '<svg class="rating__star"><use href="#i-star"></use></svg>'.repeat(starCount);
          return `
          <li class="review">
            <p class="review__head">
              <span class="review__author">${escapeHTML(r.userName)}</span>
              <span class="review__date">${escapeHTML(r.date)}</span>
            </p>
            <p class="rating">
              <span class="rating__stars" aria-label="${r.rating} trên 5 sao">${starsHtml}</span>
            </p>
            <p class="review__text">${escapeHTML(r.comment)}</p>
          </li>
        `;
        }).join('');
      }
    }

    if (writeReviewBtn) {
      writeReviewBtn.addEventListener('click', () => {
        const comment = window.prompt(`Viết đánh giá của bạn cho "${product.name}":`);
        if (comment && comment.trim()) {
          showToast('Cảm ơn bạn đã gửi đánh giá! Đánh giá sẽ được hiển thị sau khi duyệt.');
        }
      });
    }

    const moreReviewsBtn = document.querySelector('[data-reviews-more]');
    if (moreReviewsBtn) {
      moreReviewsBtn.addEventListener('click', () => {
        showToast('Đã hiển thị toàn bộ đánh giá của sản phẩm.');
        moreReviewsBtn.textContent = 'Đã hiển thị tất cả đánh giá';
        moreReviewsBtn.disabled = true;
      });
    }
  }

  // 7. Render sản phẩm tương tự, loại trừ sản phẩm hiện tại
  {
    const relatedContainer = document.querySelector('[data-list="related"]');
    if (relatedContainer) {
      // Lọc sản phẩm cùng danh mục, KHÔNG CHỨA chính product
      const relatedList = products
        .filter(p => p.id !== product.id && (p.category === product.category || p.brand === product.brand))
        .slice(0, 4);

      // Nếu không đủ 4, bổ sung các sản phẩm khác nhưng vẫn loại trừ chính nó
      if (relatedList.length < 4) {
        const more = products.filter(p => p.id !== product.id && !relatedList.some(r => r.id === p.id));
        relatedList.push(...more.slice(0, 4 - relatedList.length));
      }

      relatedContainer.innerHTML = relatedList.map(createProductCard).join('');
    }
  }

  // 8. Lưu và hiển thị sản phẩm đã xem gần đây
  {
    const recentContainer = document.querySelector('[data-list="recent"]');
    const clearBtn = document.querySelector('[data-recent-clear]');

    // Lấy lịch sử xem cũ
    let recentIds = storage.get(RECENT_KEY, []);
    if (!Array.isArray(recentIds)) recentIds = [];

    // Render sản phẩm đã xem trước đó (không chứa product)
    if (recentContainer) {
      const previousViewed = recentIds
        .filter(id => id !== product.id)
        .map(id => getProductById(id))
        .filter(Boolean)
        .slice(0, 4);

      if (previousViewed.length > 0) {
        recentContainer.innerHTML = previousViewed.map(createProductCard).join('');
      } else {
        // Nếu chưa có lịch sử trước, lấy tạm 4 sản phẩm khác để layout không bị trống
        const fallbackList = products.filter(p => p.id !== product.id).slice(0, 4);
        recentContainer.innerHTML = fallbackList.map(createProductCard).join('');
      }
    }

    // Lưu sản phẩm hiện tại vào đầu danh sách lịch sử
    recentIds = [product.id, ...recentIds.filter(id => id !== product.id)].slice(0, 8);
    storage.set(RECENT_KEY, recentIds);

    // Nút xoá lịch sử xem
    if (clearBtn && recentContainer) {
      clearBtn.addEventListener('click', () => {
        storage.remove(RECENT_KEY);
        recentContainer.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--c-muted, #777);">
          Đã xoá lịch sử xem gần đây.
        </div>
      `;
        showToast('Đã xoá lịch sử xem sản phẩm.');
      });
    }
  }
}
