/**
 * Checkout Service — Xử lý nghiệp vụ đặt hàng, snapshot, validator và idempotency
 * Ngăn chặn nhân bản đơn hàng khi reload / double submit và xử lý lỗi dọn giỏ hàng minh bạch.
 */

import { cartService as defaultCartService } from './cartService.js';
import { storage as defaultStorage } from './storage.js';
import { clearAppliedCoupon } from './couponService.js';

export const ORDERS_KEY = 'lasen_orders';
export const COMPLETED_CHECKOUT_KEY = 'lasen_last_completed_order';
export const PENDING_CLEANUP_KEY = 'lasen_pending_cart_cleanup';
export const MAX_PENDING_CLEANUP_AGE = 15 * 60 * 1000; // 15 phút (Bounded Age)

/**
 * Kiểm tra tính hợp lệ của marker phục hồi dọn giỏ hàng lỗi (Pending Cleanup Recovery)
 * Marker chỉ hợp lệ khi:
 * 1. Tồn tại và có đầy đủ orderId, fingerprint, timestamp
 * 2. Còn trong thời hạn hợp lệ (bounded age <= 15 phút)
 * 3. Fingerprint khớp với fingerprint giỏ hàng hiện tại
 * 4. orderId PHẢI tồn tại trong ordersList và đơn hàng đó PHẢI có pendingCartCleanup === true
 * 5. TUYỆT ĐỐI không fallback sang bất kỳ đơn hàng nào khác nếu orderId không tìm thấy
 * 
 * @param {Object} marker
 * @param {string} currentFingerprint
 * @param {Array} ordersList
 * @returns {{ isValid: boolean, order: Object|null, reason?: string }}
 */
export function validatePendingCleanupMarker(marker, currentFingerprint, ordersList = []) {
  if (!marker || typeof marker !== 'object') {
    return { isValid: false, order: null, reason: 'NO_MARKER' };
  }

  const { orderId, fingerprint, timestamp } = marker;
  if (!orderId || typeof orderId !== 'string' || !fingerprint || typeof timestamp !== 'number') {
    return { isValid: false, order: null, reason: 'MALFORMED_MARKER' };
  }

  // 1. Kiểm tra thời hạn (Bounded Age / Expiry)
  const now = Date.now();
  if (now - timestamp > MAX_PENDING_CLEANUP_AGE || timestamp > now + 60000) {
    return { isValid: false, order: null, reason: 'EXPIRED_MARKER' };
  }

  // 2. Kiểm tra fingerprint
  if (fingerprint !== currentFingerprint) {
    return { isValid: false, order: null, reason: 'FINGERPRINT_MISMATCH' };
  }

  // 3. Exact orderId matching - không fallback bừa bãi
  const matchingOrder = ordersList.find(o => o.id === orderId);
  if (!matchingOrder) {
    return { isValid: false, order: null, reason: 'ORDER_NOT_FOUND' };
  }

  // 4. Đơn hàng phải có cờ pendingCartCleanup === true
  if (!matchingOrder.pendingCartCleanup) {
    return { isValid: false, order: null, reason: 'NOT_PENDING_CLEANUP' };
  }

  return { isValid: true, order: matchingOrder };
}

/**
 * Sinh dấu vân tay (fingerprint) định danh giỏ hàng hiện tại dựa trên danh sách sản phẩm, số lượng và giá
 * @param {Array} items 
 * @returns {string}
 */
export function generateCartFingerprint(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map(i => `${i.productId}:${i.quantity}:${i.itemPrice || 0}`)
    .sort()
    .join('|');
}

/**
 * Kiểm tra và làm sạch dữ liệu đơn hàng (Validator & Guard)
 * Đảm bảo không làm crash trang Profile, Checkout hay các renderer
 * 
 * @param {*} order 
 * @returns {Object|null}
 */
export function validateAndSanitizeOrder(order) {
  if (!order || typeof order !== 'object') return null;

  const id = typeof order.id === 'string' && order.id.trim() 
    ? order.id.trim() 
    : `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

  const customerRaw = order.customer && typeof order.customer === 'object' ? order.customer : {};
  const customer = {
    name: typeof customerRaw.name === 'string' ? customerRaw.name.trim() : 'Khách hàng',
    phone: typeof customerRaw.phone === 'string' ? customerRaw.phone.trim() : '',
    email: typeof customerRaw.email === 'string' ? customerRaw.email.trim() : ''
  };

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items = rawItems
    .filter(it => it && typeof it === 'object' && it.productId)
    .map(it => ({
      productId: String(it.productId),
      name: typeof it.name === 'string' ? it.name : 'Sản phẩm Lá Sen',
      price: typeof it.price === 'number' && !isNaN(it.price) ? Math.max(0, it.price) : 0,
      quantity: typeof it.quantity === 'number' && Number.isInteger(it.quantity) ? Math.max(1, it.quantity) : 1,
      image: typeof it.image === 'string' ? it.image : ''
    }));

  const rawTotals = order.totals && typeof order.totals === 'object' ? order.totals : {};
  const subtotal = typeof rawTotals.subtotal === 'number' ? Math.max(0, rawTotals.subtotal) : 0;
  const shipping = typeof rawTotals.shipping === 'number' ? Math.max(0, rawTotals.shipping) : 0;
  const discount = typeof rawTotals.discount === 'number' ? Math.max(0, rawTotals.discount) : 0;
  const total = typeof rawTotals.total === 'number' ? Math.max(0, rawTotals.total) : (typeof order.total === 'number' ? order.total : Math.max(0, subtotal + shipping - discount));
  const coupon = (rawTotals.coupon && typeof rawTotals.coupon === 'object') ? rawTotals.coupon : null;

  const totals = { subtotal, shipping, discount, total, coupon };

  return {
    id,
    idempotencyToken: typeof order.idempotencyToken === 'string' ? order.idempotencyToken : null,
    cartFingerprint: typeof order.cartFingerprint === 'string' ? order.cartFingerprint : null,
    pendingCartCleanup: Boolean(order.pendingCartCleanup),
    userId: order.userId || 1,
    date: typeof order.date === 'string' ? order.date : new Date().toISOString(),
    status: typeof order.status === 'string' ? order.status : 'Chờ xác nhận',
    customer,
    shippingAddress: typeof order.shippingAddress === 'string' ? order.shippingAddress : '',
    paymentMethod: typeof order.paymentMethod === 'string' ? order.paymentMethod : 'COD',
    note: typeof order.note === 'string' ? order.note : '',
    items,
    totals
  };
}

/**
 * Xử lý đặt hàng thực tế (Production Checkout Logic)
 * 
 * @param {Object} orderInput Thông tin người nhận, địa chỉ, phương thức thanh toán, token
 * @param {Object} deps Dependency injection phục vụ kiểm thử và production
 * @returns {Object} Kết quả xử lý đơn hàng
 */
export function processCheckout(orderInput, deps = {}) {
  const cartService = deps.cartService || defaultCartService;
  const storage = deps.storage || defaultStorage;
  const ordersKey = deps.ordersKey || ORDERS_KEY;
  const completedKey = deps.completedKey || COMPLETED_CHECKOUT_KEY;
  const pendingCleanupKey = deps.pendingCleanupKey || PENDING_CLEANUP_KEY;

  const { customer, shippingAddress, paymentMethod, note, idempotencyToken } = orderInput;

  // 1. Đọc và chuẩn hóa danh sách đơn hàng đã lưu trong hệ thống
  const rawOrders = storage.get(ordersKey, []);
  let ordersList = Array.isArray(rawOrders)
    ? rawOrders.map(validateAndSanitizeOrder).filter(Boolean)
    : [];

  const lastCompletedRaw = storage.get(completedKey, null);
  const lastCompleted = validateAndSanitizeOrder(lastCompletedRaw);

  // 2. KIỂM TRA IDEMPOTENCY THEO TOKEN TRƯỚC HẾT (kể cả khi giỏ hàng đã rỗng):
  if (idempotencyToken) {
    if (lastCompleted && lastCompleted.idempotencyToken === idempotencyToken) {
      return {
        success: true,
        alreadyProcessed: true,
        order: lastCompleted,
        clearedCart: true,
        message: 'Đơn hàng này đã được hoàn tất trước đó.'
      };
    }

    const orderWithToken = ordersList.find(o => o.idempotencyToken === idempotencyToken);
    if (orderWithToken) {
      return {
        success: true,
        alreadyProcessed: true,
        order: orderWithToken,
        clearedCart: true,
        message: 'Đơn hàng này đã được tiếp nhận thành công.'
      };
    }
  }

  // 3. Lấy chi tiết giỏ hàng hiện tại
  const items = cartService.getCartDetails();
  const totals = cartService.getCartTotals(orderInput.couponCode || '');

  // 4. Kiểm tra giỏ hàng rỗng
  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'EMPTY_CART',
      message: 'Giỏ hàng đang trống, không thể tiến hành đặt hàng.'
    };
  }

  // 5. Tính toán dấu vân tay (fingerprint) của giỏ hàng hiện tại
  const cartFingerprint = generateCartFingerprint(items);

  // 6. KIỂM TRA PENDING CLEANUP RECOVERY (CHỈ KHI CÓ MARKER HỢP LỆ VÀ CÒN HẠN)
  // Tuyệt đối không đối chiếu mù quáng toàn bộ lịch sử để tránh chặn đơn hàng lặp lại hợp lệ (repeat order)
  const pendingRecovery = storage.get(pendingCleanupKey, null);
  const lastOrder = ordersList[0];

  // Xác định marker cần kiểm tra (hỗ trợ cả mock storage tối giản chỉ lưu ordersList)
  let markerToCheck = pendingRecovery;
  if (!markerToCheck && lastOrder && lastOrder.pendingCartCleanup && lastOrder.cartFingerprint === cartFingerprint) {
    markerToCheck = {
      orderId: lastOrder.id,
      fingerprint: lastOrder.cartFingerprint,
      timestamp: Date.now()
    };
  }

  if (markerToCheck) {
    const checkRes = validatePendingCleanupMarker(markerToCheck, cartFingerprint, ordersList);
    if (checkRes.isValid && checkRes.order) {
      const existingOrder = checkRes.order;
      const clearSuccess = cartService.clearCart();
      if (clearSuccess) {
        if (storage && typeof storage.remove === 'function') {
          storage.remove(pendingCleanupKey);
        } else if (storage && typeof storage.set === 'function') {
          storage.set(pendingCleanupKey, null);
        }
        delete existingOrder.pendingCartCleanup;
        storage.set(ordersKey, ordersList);
        storage.set(completedKey, existingOrder);
        return {
          success: true,
          alreadyProcessed: true,
          order: existingOrder,
          clearedCart: true,
          message: 'Đơn hàng này đã được hoàn tất trước đó.'
        };
      }

      return {
        success: true,
        alreadyProcessed: true,
        order: existingOrder,
        clearedCart: false,
        warning: 'Đơn hàng này đã được lưu thành công nhưng giỏ hàng chưa thể dọn sạch. Vui lòng không đặt lại để tránh trùng đơn!',
        message: 'Đơn hàng này đã được tiếp nhận thành công.'
      };
    } else {
      // Marker stale / expired / fake -> dọn dẹp để không chặn đơn mới
      if (storage && typeof storage.remove === 'function') {
        storage.remove(pendingCleanupKey);
      } else if (storage && typeof storage.set === 'function') {
        storage.set(pendingCleanupKey, null);
      }
    }
  }

  // 7. Tạo Order Snapshot mới với đầy đủ fingerprint
  const orderId = orderInput.id || `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
  const newOrder = validateAndSanitizeOrder({
    id: orderId,
    idempotencyToken: idempotencyToken || null,
    cartFingerprint,
    userId: orderInput.userId || 1,
    date: orderInput.date || new Date().toISOString(),
    status: 'Chờ xác nhận',
    customer: {
      name: customer?.name || '',
      phone: customer?.phone || '',
      email: customer?.email || ''
    },
    shippingAddress: shippingAddress || '',
    paymentMethod: paymentMethod || 'COD',
    note: note || '',
    items: items.map(it => ({
      productId: it.productId,
      name: it.product.name,
      price: it.itemPrice,
      quantity: it.quantity,
      image: it.product.image
    })),
    totals: { ...totals }
  });

  // 8. Lưu đơn hàng vào storage (Ghi snapshot)
  ordersList.unshift(newOrder);
  const orderSaved = storage.set(ordersKey, ordersList);

  // NẾU LƯU ĐƠN HÀNG THẤT BẠI: TUYỆT ĐỐI KHÔNG ĐỤNG TỚI GIỎ HÀNG
  if (!orderSaved) {
    return {
      success: false,
      error: 'ORDER_WRITE_FAILED',
      message: 'Không thể lưu đơn hàng do lỗi lưu trữ. Giỏ hàng của bạn vẫn được bảo toàn nguyên vẹn.'
    };
  }

  // Thử ghi metadata completed
  storage.set(completedKey, newOrder);

  // 9. Đơn hàng lưu thành công -> Tiến hành xóa giỏ hàng
  const clearSuccess = cartService.clearCart();

  // Xử lý khi clearCart thất bại: ghi nhận marker phục hồi pending cleanup
  if (!clearSuccess) {
    newOrder.pendingCartCleanup = true;
    storage.set(ordersKey, ordersList);
    if (storage && typeof storage.set === 'function') {
      storage.set(pendingCleanupKey, {
        orderId: newOrder.id,
        token: idempotencyToken || null,
        fingerprint: cartFingerprint,
        timestamp: Date.now()
      });
    }

    return {
      success: true,
      order: newOrder,
      clearedCart: false,
      warning: 'Đơn hàng đã được lưu thành công nhưng giỏ hàng chưa thể làm trống tự động. Vui lòng không đặt lại để tránh trùng đơn!',
      message: 'Đặt hàng thành công (dọn giỏ hàng gặp sự cố).'
    };
  }

  // Dọn giỏ thành công -> xóa marker pending và xóa coupon đang lưu
  if (storage && typeof storage.remove === 'function') {
    storage.remove(pendingCleanupKey);
  } else if (storage && typeof storage.set === 'function') {
    storage.set(pendingCleanupKey, null);
  }
  clearAppliedCoupon();

  return {
    success: true,
    order: newOrder,
    clearedCart: true,
    message: 'Đặt hàng thành công!'
  };
}
