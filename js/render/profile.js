import { users } from '../data/users.js';
import { orders } from '../data/orders.js';
import { products } from '../data/products.js';
import { formatPrice } from './products.js';

export function renderProfile() {
    const currentUser = users[0];
    
    const loginLink = document.querySelector('a.header__act[href="login.html"]');
    if (loginLink) {
        loginLink.href = 'profile.html';
        const valSpan = loginLink.querySelector('.header__act-val');
        if (valSpan) valSpan.textContent = currentUser.name;
    }
    
    const footerLoginLink = document.querySelectorAll('a[href="login.html"]');
    footerLoginLink.forEach(link => link.href = 'profile.html');

    if (window.location.pathname.includes('profile.html')) {
        const nameInput = document.querySelector('[data-input="hoTen"]');
        if (nameInput) nameInput.value = currentUser.name;
        const phoneInput = document.querySelector('[data-input="soDienThoai"]');
        if (phoneInput) phoneInput.value = currentUser.phone;
        const emailInput = document.querySelector('[data-input="email"]');
        if (emailInput) emailInput.value = currentUser.email;
        
        const accountNames = document.querySelectorAll('[data-account-name]');
        accountNames.forEach(el => el.textContent = currentUser.name);
        
        const accountEmails = document.querySelectorAll('[data-account-email]');
        accountEmails.forEach(el => el.textContent = currentUser.email);
        
        // Render Addresses
        const addressList = document.querySelector('[data-list="addresses"]');
        if (addressList) {
            addressList.innerHTML = `
            <article class="address address--default" data-address>
                <div class="address__head">
                  <h3 class="address__name">${currentUser.name}</h3>
                  <span class="badge badge--soft">Mặc định</span>
                </div>
                <div class="address__body">
                  <p>SĐT: ${currentUser.phone}</p>
                  <p>${currentUser.address}</p>
                </div>
            </article>
            `;
        }

        // Render Orders
        const orderList = document.querySelector('[data-list="orders"]');
        if (orderList) {
            const userOrders = orders.filter(o => o.userId === currentUser.id);
            orderList.innerHTML = userOrders.map(order => {
                const date = new Date(order.date).toLocaleDateString('vi-VN');
                const firstItem = order.items[0];
                const product = products.find(p => p.id === 'p' + firstItem.productId) || products[0];
                return `
                <article class="order" data-order data-id="${order.id}">
                  <header class="order__head">
                    <div class="order__id">
                      <h3 class="order__code">Đơn #${order.id}</h3>
                      <p class="order__date">Đặt ngày ${date}</p>
                    </div>
                    <span class="order-status">${order.status}</span>
                  </header>
                  <ul class="order__items">
                    <li class="order__item">
                      <a class="order__thumb" href="product-detail.html?id=${product.id}" tabindex="-1">
                        <img src="${product.image}" alt="${product.name}">
                      </a>
                      <span class="order__info">
                        <a class="order__name" href="product-detail.html?id=${product.id}">${product.name}</a>
                        <span class="order__meta">SL: ${firstItem.quantity}</span>
                      </span>
                      <span class="order__price">${formatPrice(firstItem.price)}</span>
                    </li>
                  </ul>
                  <footer class="order__foot">
                    <span class="order__total">Tổng tiền: ${formatPrice(order.total)}</span>
                  </footer>
                </article>
                `;
            }).join('');
        }
    }
}
