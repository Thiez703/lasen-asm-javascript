/**
 * Render trang Giỏ hàng (cart.html)
 */

import { cartService } from '../services/cartService.js';
import { formatPrice, escapeHTML, parseInteger } from '../utils/format.js';
import { showToast } from '../services/toast.js';
import { products } from '../services/dataService.js';
import { createProductCard } from './products.js';

export async function renderCart() {
  const cartWrap = document.querySelector('[data-cart]');
  const emptyWrap = document.querySelector('[data-cart-empty]');
  if (!cartWrap && !emptyWrap) return;

  // Gắn các sự kiện tương tác trong bảng giỏ hàng.
  if (cartWrap) {
    cartWrap.addEventListener('click', (e) => {
      // 1. Nút giảm số lượng
      const decBtn = e.target.closest('[data-qty-dec]');
      if (decBtn) {
        const id = decBtn.getAttribute('data-id');
        const input = cartWrap.querySelector(`[data-qty-val][data-id="${id}"]`);
        if (input) {
          const currentVal = parseInteger(input.value, 1);
          if (currentVal <= 1) {
            if (window.confirm('Bạn có muốn xóa sản phẩm này khỏi giỏ hàng?')) {
              const res = cartService.removeFromCart(id);
              if (res.success) {
                showToast('Đã xóa sản phẩm khỏi giỏ hàng.');
              } else {
                showToast(res.message, 'error');
                updateCartUI();
              }
            }
          } else {
            const res = cartService.updateQuantity(id, currentVal - 1);
            if (res.success) {
              if (res.finalQty) input.value = res.finalQty;
            } else {
              showToast(res.message, 'error');
              updateCartUI();
            }
          }
        }
        return;
      }

      // 2. Nút tăng số lượng
      const incBtn = e.target.closest('[data-qty-inc]');
      if (incBtn) {
        const id = incBtn.getAttribute('data-id');
        const input = cartWrap.querySelector(`[data-qty-val][data-id="${id}"]`);
        if (input) {
          const currentVal = parseInteger(input.value, 1);
          const res = cartService.updateQuantity(id, currentVal + 1);
          if (res.success) {
            if (res.finalQty) input.value = res.finalQty;
          } else {
            showToast(res.message, 'error');
            updateCartUI();
          }
        }
        return;
      }

      // 3. Nút xóa dòng
      const removeBtn = e.target.closest('[data-cart-remove]');
      if (removeBtn) {
        const id = removeBtn.getAttribute('data-id');
        const res = cartService.removeFromCart(id);
        if (res.success) {
          showToast('Đã xóa sản phẩm khỏi giỏ hàng.');
        } else {
          showToast(res.message, 'error');
          updateCartUI();
        }
        return;
      }

      // 4. Nút xoá toàn bộ giỏ hàng (Confirm)
      const clearBtn = e.target.closest('[data-cart-clear]');
      if (clearBtn) {
        if (window.confirm('Bạn có chắc chắn muốn xoá toàn bộ giỏ hàng không?')) {
          const ok = cartService.clearCart();
          if (ok) {
            showToast('Đã xoá toàn bộ giỏ hàng.');
          } else {
            showToast('Xóa toàn bộ giỏ hàng thất bại do lỗi lưu trữ.', 'error');
            updateCartUI();
          }
        }
        return;
      }
    });

    // Xử lý khi người dùng trực tiếp nhập số lượng vào ô input
    cartWrap.addEventListener('change', (e) => {
      const input = e.target.closest('[data-qty-val]');
      if (!input) return;

      const id = input.getAttribute('data-id');
      const val = parseInteger(input.value, 1);
      if (val <= 0) {
        if (window.confirm('Bạn có muốn xóa sản phẩm này khỏi giỏ hàng?')) {
          const res = cartService.removeFromCart(id);
          if (res.success) {
            showToast('Đã xóa sản phẩm khỏi giỏ hàng.');
          } else {
            showToast(res.message, 'error');
            updateCartUI();
          }
        } else {
          updateCartUI();
        }
      } else {
        const res = cartService.updateQuantity(id, val);
        if (res.success) {
          if (res.finalQty) input.value = res.finalQty;
        } else {
          showToast(res.message, 'error');
          updateCartUI();
        }
      }
    });
  }

  // Hiển thị các sản phẩm gợi ý mua thêm.
  const suggestContainer = document.querySelector('[data-list="suggest"]');
  if (suggestContainer) {
    const suggested = products.slice(0, 4);
    suggestContainer.innerHTML = suggested.map(createProductCard).join('');
  }

  // Lắng nghe cập nhật từ cartService để tự động re-render
  window.addEventListener('cart:updated', () => {
    updateCartUI();
  });

  // Render lần đầu
  updateCartUI();
}

/**
 * Cập nhật giao diện toàn bộ giỏ hàng
 */
function updateCartUI() {
  const cartWrap = document.querySelector('[data-cart]');
  const emptyWrap = document.querySelector('[data-cart-empty]');
  const cartTableBody = document.querySelector('[data-list="cart"] tbody');

  const items = cartService.getCartDetails();
  const totals = cartService.getCartTotals();

  if (items.length === 0) {
    if (cartWrap) cartWrap.style.display = 'none';
    if (emptyWrap) emptyWrap.classList.remove('is-hidden');
    return;
  }

  if (cartWrap) cartWrap.style.display = '';
  if (emptyWrap) emptyWrap.classList.add('is-hidden');

  // Render danh sách sản phẩm trong bảng
  if (cartTableBody) {
    cartTableBody.innerHTML = items.map(item => {
      const p = item.product;
      return `
        <tr class="cart-row" role="row" data-cart-item data-id="${escapeHTML(p.id)}">
          <th class="cart-row__product" scope="row" role="rowheader">
            <a class="cart-row__thumb" href="product-detail.html?id=${escapeHTML(p.id)}" tabindex="-1">
              <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy">
            </a>
            <div class="cart-row__info">
              <a class="cart-row__name" href="product-detail.html?id=${escapeHTML(p.id)}">${escapeHTML(p.name)}</a>
              <span class="cart-row__meta">${escapeHTML(p.capacity || '50ml')} • Còn ${p.stock} sản phẩm</span>
            </div>
          </th>
          <td class="cart-row__price" role="cell">
            <span class="cart-row__price-val">${formatPrice(item.itemPrice)}</span>
          </td>
          <td class="cart-row__qty" role="cell">
            <div class="qty-input">
              <button class="qty-input__btn" type="button" aria-label="Giảm số lượng" data-qty-dec data-id="${escapeHTML(p.id)}">-</button>
              <input class="qty-input__val" type="number" value="${item.quantity}" min="1" max="${p.stock}" aria-label="Số lượng" data-qty-val data-id="${escapeHTML(p.id)}">
              <button class="qty-input__btn" type="button" aria-label="Tăng số lượng" data-qty-inc data-id="${escapeHTML(p.id)}">+</button>
            </div>
          </td>
          <td class="cart-row__total" role="cell">
            <span class="cart-row__total-val">${formatPrice(item.lineTotal)}</span>
          </td>
          <td class="cart-row__act" role="cell">
            <button class="btn btn--ghost btn--sm btn--icon" type="button" aria-label="Xóa" data-cart-remove data-id="${escapeHTML(p.id)}">Xóa</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Cập nhật số liệu khối tổng kết đơn hàng bên phải.
  const countItemsEl = document.querySelector('[data-cart-count-items]');
  if (countItemsEl) countItemsEl.textContent = totals.totalQuantity;

  const subtotalEl = document.querySelector('[data-cart-subtotal]');
  if (subtotalEl) subtotalEl.textContent = formatPrice(totals.subtotal);

  const shippingEl = document.querySelector('[data-cart-shipping]');
  if (shippingEl) {
    shippingEl.textContent = totals.shipping === 0 ? 'Miễn phí' : formatPrice(totals.shipping);
  }

  const totalEl = document.querySelector('.cart__aside [data-cart-total]');
  if (totalEl) totalEl.textContent = formatPrice(totals.total);
}
