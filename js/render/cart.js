import { products } from '../services/dataService.js';
import { getCart, getCartItems, getCartTotals, updateQuantity, removeFromCart, clearCart } from '../services/cartService.js';
import { renderProductList } from './products.js';
import { formatPrice, showToast } from '../utils/helpers.js';

export function renderCart() {
  const cartBox = document.querySelector('[data-cart]');
  if (!cartBox) return;

  showCart();
  renderProductList('[data-list="suggest"]', products.slice(0, 4));

  cartBox.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const productId = button.getAttribute('data-id');
    const cartItem = getCart().find(item => item.productId === productId);

    if (button.hasAttribute('data-qty-dec')) {
      if (cartItem.quantity > 1) {
        updateQuantity(productId, cartItem.quantity - 1);
      } else if (confirm('Bạn có muốn xóa sản phẩm này khỏi giỏ hàng?')) {
        removeFromCart(productId);
        showToast('Đã xóa sản phẩm khỏi giỏ hàng.');
      }
    }

    if (button.hasAttribute('data-qty-inc')) {
      updateQuantity(productId, cartItem.quantity + 1);
    }

    if (button.hasAttribute('data-cart-remove')) {
      removeFromCart(productId);
      showToast('Đã xóa sản phẩm khỏi giỏ hàng.');
    }

    if (button.hasAttribute('data-cart-clear') && confirm('Bạn có chắc muốn xóa toàn bộ giỏ hàng?')) {
      clearCart();
      showToast('Đã xóa toàn bộ giỏ hàng.');
    }

    showCart();
  });

  cartBox.addEventListener('change', (event) => {
    const input = event.target;
    if (!input.hasAttribute('data-qty-val')) return;

    updateQuantity(input.getAttribute('data-id'), parseInt(input.value) || 1);
    showCart();
  });
}

function showCart() {
  const items = getCartItems();
  const totals = getCartTotals(items);

  document.querySelector('[data-cart]').classList.toggle('is-hidden', items.length === 0);
  document.querySelector('[data-cart-empty]').classList.toggle('is-hidden', items.length > 0);

  document.querySelector('[data-list="cart"] tbody').innerHTML = items.map(item => `
    <tr class="cart-row" role="row">
      <th class="cart-row__product" scope="row" role="rowheader">
        <a class="cart-row__thumb" href="product-detail.html?id=${item.product.id}" tabindex="-1">
          <img src="${item.product.image}" alt="${item.product.name}" loading="lazy">
        </a>
        <div class="cart-row__info">
          <a class="cart-row__name" href="product-detail.html?id=${item.product.id}">${item.product.name}</a>
          <span class="cart-row__meta">${item.product.capacity} • Còn ${item.product.stock} sản phẩm</span>
        </div>
      </th>
      <td class="cart-row__price" role="cell">
        <span class="cart-row__price-val">${formatPrice(item.price)}</span>
      </td>
      <td class="cart-row__qty" role="cell">
        <div class="qty-input">
          <button class="qty-input__btn" type="button" aria-label="Giảm số lượng" data-qty-dec data-id="${item.product.id}">-</button>
          <input class="qty-input__val" type="number" value="${item.quantity}" min="1" max="${item.product.stock}" aria-label="Số lượng" data-qty-val data-id="${item.product.id}">
          <button class="qty-input__btn" type="button" aria-label="Tăng số lượng" data-qty-inc data-id="${item.product.id}">+</button>
        </div>
      </td>
      <td class="cart-row__total" role="cell">
        <span class="cart-row__total-val">${formatPrice(item.lineTotal)}</span>
      </td>
      <td class="cart-row__act" role="cell">
        <button class="btn btn--ghost btn--sm btn--icon" type="button" aria-label="Xóa" data-cart-remove data-id="${item.product.id}">Xóa</button>
      </td>
    </tr>
  `).join('');

  document.querySelector('[data-cart-count-items]').textContent = totals.totalQuantity;
  document.querySelector('[data-cart-subtotal]').textContent = formatPrice(totals.subtotal);
  document.querySelector('[data-cart-shipping]').textContent = totals.shipping === 0 ? 'Miễn phí' : formatPrice(totals.shipping);
  document.querySelector('.cart__aside [data-cart-total]').textContent = formatPrice(totals.total);
}
