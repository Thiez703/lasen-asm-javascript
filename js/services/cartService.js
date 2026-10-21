import { getProductById } from './dataService.js';
import { getStorage, setStorage, showToast, formatPrice, getPrice } from '../utils/helpers.js';

const CART_KEY = 'lasen_cart';
const ORDERS_KEY = 'lasen_order_list';
const SHIPPING_FEE = 30000;
const FREE_SHIPPING_FROM = 500000;

export function getCart() {
  return getStorage(CART_KEY, []);
}

export function saveCart(cart) {
  setStorage(CART_KEY, cart);
  updateHeaderCart();
}

export function addToCart(productId, quantity) {
  const product = getProductById(productId);
  const cart = getCart();
  const cartItem = cart.find(item => item.productId === productId);
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  if (quantityInCart + quantity > product.stock) {
    showToast(`Kho chỉ còn ${product.stock} sản phẩm, giỏ hàng đã có ${quantityInCart}.`, 'error');
    return;
  }

  if (cartItem) {
    cartItem.quantity += quantity;
  } else {
    cart.push({ productId: productId, quantity: quantity });
  }
  saveCart(cart);
  showToast(`Đã thêm ${quantity} "${product.name}" vào giỏ hàng.`);
}

export function updateQuantity(productId, quantity) {
  const product = getProductById(productId);
  if (quantity > product.stock) {
    showToast(`Kho chỉ còn ${product.stock} sản phẩm.`, 'error');
    quantity = product.stock;
  }
  if (quantity < 1) {
    quantity = 1;
  }

  const cart = getCart();
  const cartItem = cart.find(item => item.productId === productId);
  cartItem.quantity = quantity;
  saveCart(cart);
}

export function removeFromCart(productId) {
  const newCart = getCart().filter(item => item.productId !== productId);
  saveCart(newCart);
}

export function clearCart() {
  saveCart([]);
}

// Ghép thông tin sản phẩm, đơn giá và thành tiền vào từng dòng của giỏ hàng
export function getCartItems(cart = getCart()) {
  return cart.map(item => {
    const product = getProductById(item.productId);
    const price = getPrice(product);
    return {
      product: product,
      quantity: item.quantity,
      price: price,
      lineTotal: price * item.quantity
    };
  });
}

export function getCartTotals(items) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  let shipping = SHIPPING_FEE;
  if (subtotal === 0 || subtotal >= FREE_SHIPPING_FROM) {
    shipping = 0;
  }

  return {
    totalQuantity: totalQuantity,
    subtotal: subtotal,
    shipping: shipping,
    total: subtotal + shipping
  };
}

export function updateHeaderCart() {
  const totals = getCartTotals(getCartItems());
  document.querySelector('[data-cart-count]').textContent = totals.totalQuantity;
  document.querySelector('.header [data-cart-total]').textContent = formatPrice(totals.total);
}

export function getOrders() {
  return getStorage(ORDERS_KEY, []);
}

export function saveOrder(order) {
  const orders = getOrders();
  orders.unshift(order);
  setStorage(ORDERS_KEY, orders);
}
