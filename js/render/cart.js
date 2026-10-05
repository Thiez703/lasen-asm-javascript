import { products } from '../data/products.js';
import { formatPrice } from './products.js';

export function renderCart() {
    if (!window.location.pathname.includes('cart.html')) return;

    const cartList = document.querySelector('[data-list="cart"] tbody');
    if (!cartList) return;

    // Dummy cart data since no cart.js exists
    const cartItems = [
        { productId: 'p1', quantity: 2 },
        { productId: 'p3', quantity: 1 }
    ];

    cartList.innerHTML = cartItems.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return '';
        const price = product.salePrice || product.price;
        return `
        <tr class="cart-row" role="row" data-cart-item data-id="${product.id}">
          <th class="cart-row__product" scope="row" role="rowheader">
            <a class="cart-row__thumb" href="product-detail.html?id=${product.id}" tabindex="-1">
              <img src="${product.image}" alt="${product.name}">
            </a>
            <div class="cart-row__info">
              <a class="cart-row__name" href="product-detail.html?id=${product.id}">${product.name}</a>
              <span class="cart-row__meta">${product.capacity || '50ml'}</span>
            </div>
          </th>
          <td class="cart-row__price" role="cell">
            <span class="cart-row__price-val">${formatPrice(price)}</span>
          </td>
          <td class="cart-row__qty" role="cell">
            <div class="qty-input">
              <button class="qty-input__btn" type="button" aria-label="Giảm số lượng">-</button>
              <input class="qty-input__val" type="number" value="${item.quantity}" min="1" max="99" aria-label="Số lượng">
              <button class="qty-input__btn" type="button" aria-label="Tăng số lượng">+</button>
            </div>
          </td>
          <td class="cart-row__total" role="cell">
            <span class="cart-row__total-val">${formatPrice(price * item.quantity)}</span>
          </td>
          <td class="cart-row__act" role="cell">
            <button class="btn btn--ghost btn--sm btn--icon" type="button" aria-label="Xóa">Xóa</button>
          </td>
        </tr>
        `;
    }).join('');
    
    // Update total
    const totalEl = document.querySelector('[data-cart-total]');
    if (totalEl) {
        const total = cartItems.reduce((acc, item) => {
            const product = products.find(p => p.id === item.productId);
            return acc + (product ? (product.salePrice || product.price) * item.quantity : 0);
        }, 0);
        totalEl.textContent = formatPrice(total);
    }
}
