import { getStorage, setStorage } from '../utils/storage.js';

const ORDERS_KEY = 'lasen_order_list';
const CANCELLED_ORDERS_KEY = 'lasen_cancelled_orders';

async function loadJSON(filename) {
  const response = await fetch(new URL(`../data/${filename}`, import.meta.url));
  return response.json();
}

function getOrders() {
  return getStorage(ORDERS_KEY, []);
}

export function saveOrder(order) {
  const orders = getOrders();
  orders.unshift(order);
  setStorage(ORDERS_KEY, orders);
}

function getCancelledOrderIds() {
  return getStorage(CANCELLED_ORDERS_KEY, []);
}

export function cancelOrder(orderId) {
  const cancelledIds = getCancelledOrderIds();
  cancelledIds.push(orderId);
  setStorage(CANCELLED_ORDERS_KEY, cancelledIds);
}

export function getOrderStatuses() {
  return loadJSON('order-statuses.json');
}

export async function getUserOrders(userId) {
  const sampleOrders = await loadJSON('sample-orders.json');

  const realOrders = getOrders().filter(order => order.userId === userId);
  const demoOrders = sampleOrders.filter(order => order.userId === userId);
  const orders = realOrders.concat(demoOrders);
  const cancelledIds = getCancelledOrderIds();
  orders.forEach(order => {
    if (cancelledIds.includes(order.id)) {
      order.status = 'Đã huỷ';
    }
  });
  return orders;
}
