import { getProductById } from '../../services/dataService.js';
import { getOrderStatuses, getUserOrders, cancelOrder } from '../../services/orderService.js';
import { addToCart } from '../../services/cartService.js';
import { formatPrice } from '../../utils/price.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm } from '../../utils/dialog.js';

const ORDER_STATUS = {
  'Chờ xác nhận': { key: 'cho-xac-nhan', badge: 'badge--soft' },
  'Đang vận chuyển': { key: 'dang-giao', badge: 'badge--info' },
  'Đã giao hàng': { key: 'da-giao', badge: 'badge--success' },
  'Đã huỷ': { key: 'da-huy', badge: 'badge--danger' }
};

export async function renderOrders(user) {
  const statuses = await getOrderStatuses();
  const orders = await getUserOrders(user.id);
  document.querySelector('[data-orders-count]').textContent = orders.length;

  const filterBox = document.querySelector('[data-order-filters]');
  const orderList = document.querySelector('[data-list="orders"]');

  filterBox.innerHTML = statuses
    .map(
      status => `
    <button class="chip ${status.key === 'tat-ca' ? 'is-active' : ''}" type="button" data-order-filter="${status.key}">${status.label}</button>
  `
    )
    .join('');

  function showOrders(statusKey) {
    const filtered = orders.filter(order => statusKey === 'tat-ca' || ORDER_STATUS[order.status].key === statusKey);
    document.querySelector('[data-orders-empty]').classList.toggle('is-hidden', filtered.length > 0);
    orderList.innerHTML = filtered.map(order => createOrderCard(order)).join('');
  }

  filterBox.addEventListener('click', event => {
    const chip = event.target.closest('[data-order-filter]');
    if (!chip) return;

    filterBox.querySelectorAll('.chip').forEach(item => item.classList.toggle('is-active', item === chip));
    showOrders(chip.getAttribute('data-order-filter'));
  });

  orderList.addEventListener('click', event => {
    const button = event.target.closest('[data-order-rebuy]');
    if (!button) return;

    const order = orders.find(item => item.id === button.getAttribute('data-id'));
    order.items.forEach(item => addToCart(item.productId, item.quantity));
    setTimeout(() => {
      window.location.href = 'cart.html';
    }, 800);
  });

  orderList.addEventListener('click', async event => {
    const button = event.target.closest('[data-order-cancel]');
    if (!button) return;

    const order = orders.find(item => item.id === button.getAttribute('data-id'));
    const confirmed = await showConfirm({
      icon: 'i-box',
      title: 'Huỷ đơn hàng?',
      message: `Đơn hàng #${order.id} sẽ bị huỷ và không thể khôi phục.`,
      confirmText: 'Huỷ đơn',
      cancelText: 'Giữ đơn',
      danger: true
    });
    if (!confirmed) return;

    order.status = 'Đã huỷ';
    cancelOrder(order.id);
    showOrders(filterBox.querySelector('.is-active').getAttribute('data-order-filter'));
    showToast(`Đã huỷ đơn hàng #${order.id}.`);
  });

  showOrders('tat-ca');
}

function createOrderCard(order) {
  const status = ORDER_STATUS[order.status];
  const date = new Date(order.date).toLocaleDateString('vi-VN');
  const cancelButtonHTML =
    status.key === 'cho-xac-nhan'
      ? `<button class="btn btn--ghost btn--sm" type="button" data-order-cancel data-id="${order.id}">Huỷ đơn</button>`
      : '';

  const itemsHTML = order.items
    .map(item => {
      const product = getProductById(item.productId);
      return `
      <li class="order__item">
        <a class="order__thumb" href="product-detail.html?id=${product.id}" tabindex="-1">
          <img src="${product.image}" alt="${product.name}" loading="lazy">
        </a>
        <span class="order__info">
          <a class="order__name" href="product-detail.html?id=${product.id}">${product.name}</a>
          <span class="order__meta">Số lượng: ${item.quantity}</span>
        </span>
        <span class="order__price">${formatPrice(item.price)}</span>
      </li>
    `;
    })
    .join('');

  return `
    <article class="order ${status.key === 'da-huy' ? 'order--cancelled' : ''}">
      <header class="order__head">
        <div class="order__id">
          <h3 class="order__code">
            Đơn #${order.id}
            ${order.isDemo ? '<span class="badge badge--soft" style="font-size: 11px; margin-left: 6px;">Đơn mẫu</span>' : ''}
          </h3>
          <p class="order__date">Đặt ngày ${date} • ${order.paymentMethod}</p>
        </div>
        <span class="badge ${status.badge}" style="font-weight: 600;">${order.status}</span>
      </header>
      <ul class="order__items">${itemsHTML}</ul>
      <footer class="order__foot" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <span style="font-size: 13px;">Địa chỉ: ${order.shippingAddress}</span>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span class="order__total" style="font-size: 15px; font-weight: 700;">Tổng tiền: ${formatPrice(order.total)}</span>
          ${cancelButtonHTML}
          <button class="btn btn--outline btn--sm" type="button" data-order-rebuy data-id="${order.id}">Đặt lại đơn này</button>
        </div>
      </footer>
    </article>
  `;
}
