/**
 * Coupon Service — Quản lý nạp dữ liệu coupon từ file JSON thực tế (Single Source of Truth)
 * Tính toán giảm giá và đồng bộ mã ưu đãi giữa Giỏ hàng & Thanh toán
 * Tuyệt đối không hardcode mảng coupon hay hằng số nghiệp vụ trong mã nguồn
 */

import { storage } from './storage.js';
import { formatPrice } from '../utils/format.js';

const APPLIED_COUPON_KEY = 'lasen_applied_coupon';

// Bộ nhớ đệm danh sách coupon được nạp trực tiếp từ js/data/coupons.json
let cachedCoupons = null;

/**
 * Đọc dữ liệu JSON coupon trong môi trường Node.js (phục vụ test runner)
 * @returns {Array|null}
 */
function readJsonInNode() {
  try {
    if (typeof process !== 'undefined' && process.getBuiltinModule) {
      const fs = process.getBuiltinModule('node:fs');
      const path = process.getBuiltinModule('node:path');
      const jsonPath = path.resolve(process.cwd(), 'js', 'data', 'coupons.json');
      if (fs.existsSync(jsonPath)) {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    }
  } catch (err) {
    // Không đọc được file trong môi trường Node
  }
  return null;
}

/**
 * Nạp danh sách coupon từ file js/data/coupons.json qua async fetch (hoặc fs trong Node)
 * @param {string} url Đường dẫn tới tệp coupons.json
 * @returns {Promise<Array>}
 */
export async function loadCoupons(url = 'js/data/coupons.json') {
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

  // 1. Nếu đang chạy trong môi trường Node.js (test runner)
  if (isNode) {
    const nodeData = readJsonInNode();
    if (Array.isArray(nodeData) && nodeData.length > 0) {
      cachedCoupons = nodeData;
      return cachedCoupons;
    }
    cachedCoupons = [];
    throw new Error('Không thể nạp tệp js/data/coupons.json trong môi trường Node.js');
  }

  // 2. Môi trường Trình duyệt (Browser HTTP fetch)
  try {
    const response = await fetch(url);
    if (!response.ok) {
      cachedCoupons = [];
      throw new Error(`Tải js/data/coupons.json thất bại (HTTP ${response.status})`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      cachedCoupons = [];
      throw new Error('Dữ liệu coupons.json không đúng định dạng mảng');
    }
    cachedCoupons = data;
    return cachedCoupons;
  } catch (err) {
    cachedCoupons = [];
    throw err;
  }
}

/**
 * Thiết lập thủ công danh sách coupon (phục vụ kiểm thử failure state hoặc custom fixture)
 * @param {Array|null} coupons
 */
export function setCachedCoupons(coupons) {
  cachedCoupons = Array.isArray(coupons) ? coupons : null;
}

/**
 * Lấy danh sách coupons đã nạp từ JSON
 * @returns {Array}
 */
export function getCoupons() {
  if (cachedCoupons === null) {
    const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
    if (isNode) {
      const nodeData = readJsonInNode();
      if (Array.isArray(nodeData)) {
        cachedCoupons = nodeData;
        return cachedCoupons;
      }
    }
    return [];
  }
  return cachedCoupons;
}

/**
 * Tìm kiếm coupon theo mã (không phân biệt chữ hoa/thường)
 * @param {string} code
 * @returns {Object|null}
 */
export function findCoupon(code) {
  if (!code || typeof code !== 'string') return null;
  const clean = code.trim().toUpperCase();
  const list = getCoupons();
  return list.find(c => String(c.code).trim().toUpperCase() === clean) || null;
}

/**
 * Kiểm tra tính hợp lệ của mã giảm giá với giá trị đơn hàng
 * @param {string} code Mã coupon
 * @param {number} subtotal Tạm tính của giỏ
 * @param {number} shipping Phí vận chuyển
 * @returns {{ valid: boolean, error?: string, message: string, discount: number, coupon: Object|null }}
 */
export function validateCoupon(code, subtotal = 0, shipping = 0) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) {
    return {
      valid: false,
      error: 'EMPTY',
      message: 'Vui lòng nhập mã giảm giá.',
      discount: 0,
      coupon: null
    };
  }

  const couponsList = getCoupons();
  if (couponsList.length === 0) {
    return {
      valid: false,
      error: 'COUPONS_UNAVAILABLE',
      message: 'Hệ thống mã giảm giá tạm thời không khả dụng hoặc chưa tải xong.',
      discount: 0,
      coupon: null
    };
  }

  const coupon = findCoupon(cleanCode);
  if (!coupon) {
    return {
      valid: false,
      error: 'INVALID_CODE',
      message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.',
      discount: 0,
      coupon: null
    };
  }

  const minSubtotal = Number(coupon.minSubtotal) || 0;
  if (subtotal < minSubtotal) {
    return {
      valid: false,
      error: 'MIN_NOT_MET',
      message: `Mã ${coupon.code} chỉ áp dụng cho đơn hàng từ ${formatPrice(minSubtotal)} trở lên.`,
      discount: 0,
      coupon
    };
  }

  let discount = 0;
  if (coupon.discountType === 'fixed') {
    discount = Number(coupon.discountValue) || 0;
  } else if (coupon.discountType === 'percent') {
    const rawDiscount = Math.round(subtotal * (Number(coupon.discountValue) || 0));
    discount = coupon.maxDiscount ? Math.min(Number(coupon.maxDiscount), rawDiscount) : rawDiscount;
  } else if (coupon.discountType === 'shipping') {
    discount = shipping;
  }

  return {
    valid: true,
    message: `Áp dụng mã ${coupon.code} thành công!`,
    discount,
    coupon: {
      code: coupon.code,
      desc: coupon.description || coupon.title
    }
  };
}

/**
 * Lấy mã coupon đang được lưu trong storage
 * @returns {string}
 */
export function getAppliedCoupon() {
  const val = storage.get(APPLIED_COUPON_KEY, '');
  return typeof val === 'string' ? val.trim().toUpperCase() : '';
}

/**
 * Lưu mã coupon đang áp dụng vào storage
 * @param {string} code
 * @returns {boolean}
 */
export function setAppliedCoupon(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) {
    return clearAppliedCoupon();
  }
  return storage.set(APPLIED_COUPON_KEY, clean);
}

/**
 * Xóa mã coupon đang lưu trong storage
 * @returns {boolean}
 */
export function clearAppliedCoupon() {
  return storage.remove(APPLIED_COUPON_KEY);
}

/**
 * Tự động kiểm tra lại mã coupon đã lưu sau khi giỏ hàng thay đổi
 * Nếu không còn thỏa điều kiện, tự động dọn dẹp mã
 * @param {number} subtotal
 * @param {number} shipping
 * @returns {{ valid: boolean, code: string, message?: string }}
 */
export function revalidateAppliedCoupon(subtotal, shipping) {
  const currentCode = getAppliedCoupon();
  if (!currentCode) return { valid: false, code: '' };

  const validationRes = validateCoupon(currentCode, subtotal, shipping);
  if (!validationRes.valid) {
    // KHÔNG xóa mã đã lưu khi hệ thống chưa tải xong dữ liệu hoặc gặp sự cố mạng tạm thời
    if (validationRes.error === 'COUPONS_UNAVAILABLE') {
      return {
        valid: false,
        unavailable: true,
        code: currentCode,
        message: 'Dữ liệu mã giảm giá đang được tải hoặc chưa khả dụng.'
      };
    }

    // Chỉ xóa mã khi kiểm tra nghiệp vụ thực sự không đạt (hết hạn hoặc không đủ giá trị tối thiểu)
    clearAppliedCoupon();
    return {
      valid: false,
      code: currentCode,
      message: `Mã ${currentCode} đã được gỡ bỏ do giá trị giỏ hàng không còn đủ điều kiện.`
    };
  }

  return { valid: true, code: currentCode };
}
