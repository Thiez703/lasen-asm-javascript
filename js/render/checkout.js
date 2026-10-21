/**
 * Render trang Thanh toán (checkout.html)
 */

import { cartService } from '../services/cartService.js';
import { createBuyNowSource } from '../services/buyNowService.js';
import { formatPrice, escapeHTML } from '../utils/format.js';
import { validation } from '../modules/validation.js';
import { showToast } from '../services/toast.js';
import { processCheckout, generateCartFingerprint, validateAndSanitizeOrder, ORDERS_KEY, COMPLETED_CHECKOUT_KEY, PENDING_CLEANUP_KEY, validatePendingCleanupMarker } from '../services/checkoutService.js';
import { storage } from '../services/storage.js';
import { getAccountProfile, getCurrentUser, getAccountStorageKey } from '../services/accountService.js';

// Dữ liệu Tỉnh/Thành phố và Quận/Huyện demo
const locationData = {
  'can-tho': {
    name: 'TP. Cần Thơ',
    districts: [
      { id: 'ninh-kieu', name: 'Quận Ninh Kiều' },
      { id: 'binh-thuy', name: 'Quận Bình Thuỷ' },
      { id: 'cai-rang', name: 'Quận Cái Răng' },
      { id: 'o-mon', name: 'Quận Ô Môn' },
      { id: 'thot-not', name: 'Quận Thốt Nốt' },
      { id: 'phong-dien', name: 'Huyện Phong Điền' }
    ]
  },
  'ho-chi-minh': {
    name: 'TP. Hồ Chí Minh',
    districts: [
      { id: 'q1', name: 'Quận 1' },
      { id: 'q3', name: 'Quận 3' },
      { id: 'q7', name: 'Quận 7' },
      { id: 'q10', name: 'Quận 10' },
      { id: 'thu-duc', name: 'TP. Thủ Đức' },
      { id: 'binh-thanh', name: 'Quận Bình Thạnh' },
      { id: 'go-vap', name: 'Quận Gò Vấp' }
    ]
  },
  'ha-noi': {
    name: 'TP. Hà Nội',
    districts: [
      { id: 'ba-dinh', name: 'Quận Ba Đình' },
      { id: 'hoan-kiem', name: 'Quận Hoàn Kiếm' },
      { id: 'dong-da', name: 'Quận Đống Đa' },
      { id: 'cau-giay', name: 'Quận Cầu Giấy' },
      { id: 'hai-ba-trung', name: 'Quận Hai Bà Trưng' },
      { id: 'tay-ho', name: 'Quận Tây Hồ' }
    ]
  },
  'da-nang': {
    name: 'TP. Đà Nẵng',
    districts: [
      { id: 'hai-chau', name: 'Quận Hải Châu' },
      { id: 'thanh-khe', name: 'Quận Thanh Khê' },
      { id: 'son-tra', name: 'Quận Sơn Trà' },
      { id: 'ngu-hanh-son', name: 'Quận Ngũ Hành Sơn' },
      { id: 'cam-le', name: 'Quận Cẩm Lệ' }
    ]
  },
  'an-giang': {
    name: 'An Giang',
    districts: [
      { id: 'long-xuyen', name: 'TP. Long Xuyên' },
      { id: 'chau-doc', name: 'TP. Châu Đốc' },
      { id: 'thoai-son', name: 'Huyện Thoại Sơn' }
    ]
  },
  'vinh-long': {
    name: 'Vĩnh Long',
    districts: [
      { id: 'tp-vinh-long', name: 'TP. Vĩnh Long' },
      { id: 'long-ho', name: 'Huyện Long Hồ' },
      { id: 'binh-minh', name: 'Thị xã Bình Minh' }
    ]
  },
  'hau-giang': {
    name: 'Hậu Giang',
    districts: [
      { id: 'vi-thanh', name: 'TP. Vị Thanh' },
      { id: 'nga-bay', name: 'TP. Ngã Bảy' },
      { id: 'chau-thanh-a', name: 'Huyện Châu Thành A' }
    ]
  },
  'soc-trang': {
    name: 'Sóc Trăng',
    districts: [
      { id: 'tp-soc-trang', name: 'TP. Sóc Trăng' },
      { id: 'my-xuyen', name: 'Huyện Mỹ Xuyên' },
      { id: 'vinh-chau', name: 'Thị xã Vĩnh Châu' }
    ]
  },
  'kien-giang': {
    name: 'Kiên Giang',
    districts: [
      { id: 'rach-gia', name: 'TP. Rạch Giá' },
      { id: 'phu-quoc', name: 'TP. Phú Quốc' },
      { id: 'ha-tien', name: 'TP. Hà Tiên' }
    ]
  },
  'ca-mau': {
    name: 'Cà Mau',
    districts: [
      { id: 'tp-ca-mau', name: 'TP. Cà Mau' },
      { id: 'nam-can', name: 'Huyện Năm Căn' },
      { id: 'u-minh', name: 'Huyện U Minh' }
    ]
  }
};

export async function renderCheckout() {
  const form = document.querySelector('[data-checkout-form]');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const isBuyNow = params.has('buyNow');
  const buyNowToken = params.get('token');
  const checkoutSource = isBuyNow
    ? createBuyNowSource(params.get('buyNow'), Number(params.get('quantity')))
    : cartService;
  const currentUserId = getCurrentUser()?.id ?? null;
  const belongsToCurrentAccount = order => order && String(order.userId ?? '') === String(currentUserId ?? '');
  const completedKey = getAccountStorageKey(isBuyNow ? `${COMPLETED_CHECKOUT_KEY}_buy_now` : COMPLETED_CHECKOUT_KEY);
  const pendingCleanupKey = getAccountStorageKey(PENDING_CLEANUP_KEY);
  const checkoutDeps = {
    cartService: checkoutSource,
    preserveCart: isBuyNow,
    completedKey,
    pendingCleanupKey
  };

  const refreshChangedAccount = () => {
    if (String(getCurrentUser()?.id ?? '') !== String(currentUserId ?? '')) {
      window.location.reload();
    }
  };
  window.addEventListener('pageshow', refreshChangedAccount);
  window.addEventListener('storage', refreshChangedAccount);
  window.addEventListener('auth:changed', refreshChangedAccount);

  const items = checkoutSource.getCartDetails();
  const totals = checkoutSource.getCartTotals();
  const currentFingerprint = generateCartFingerprint(items);

  const rawOrders = storage.get(ORDERS_KEY, []);
  const ordersList = Array.isArray(rawOrders)
    ? rawOrders.map(validateAndSanitizeOrder).filter(Boolean)
    : [];

  const lastCompletedRaw = storage.get(completedKey, null);
  const completedOrder = validateAndSanitizeOrder(lastCompletedRaw);
  const lastCompleted = belongsToCurrentAccount(completedOrder) ? completedOrder : null;

  if (isBuyNow) {
    // Token nằm trên URL để tải lại trang không tạo thêm một đơn mua ngay.
    const completedPurchase = buyNowToken && (
      ordersList.find(order => belongsToCurrentAccount(order) && order.idempotencyToken === buyNowToken)
      || (lastCompleted?.idempotencyToken === buyNowToken ? lastCompleted : null)
    );
    if (completedPurchase) {
      renderOrderSuccessView(completedPurchase);
      return;
    }

    // Không dùng giỏ hàng làm dự phòng khi đường dẫn mua ngay không hợp lệ.
    if (!buyNowToken || !/^buy_\d+_[a-z0-9]+$/.test(buyNowToken) || items.length !== 1) {
      const container = document.querySelector('.checkout');
      if (container) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 48px 24px; text-align: center;">
            <h2>Không thể mua ngay sản phẩm này</h2>
            <p>Sản phẩm hoặc số lượng không hợp lệ, hoặc sản phẩm đã hết hàng. Vui lòng chọn lại.</p>
            <a class="btn btn--primary" href="products.html">Chọn sản phẩm</a>
          </div>
        `;
      }
      return;
    }
  }

  // 1. Kiểm tra nếu có Pending cleanup recovery marker scoped phiên hợp lệ và còn hạn
  const pendingRecovery = isBuyNow ? null : storage.get(pendingCleanupKey, null);
  const recoveryOwner = ordersList.find(order => order.id === pendingRecovery?.orderId);
  if (pendingRecovery && (!recoveryOwner || belongsToCurrentAccount(recoveryOwner)) && currentFingerprint && items.length > 0) {
    const checkRes = validatePendingCleanupMarker(pendingRecovery, currentFingerprint, ordersList.filter(belongsToCurrentAccount));
    if (checkRes.isValid && checkRes.order) {
      const matchingOrder = checkRes.order;
      // Đơn hàng cho giỏ hàng này đã hoàn tất, thử dọn dẹp lại giỏ hàng (recovery cleanup)
      const cleared = cartService.clearCart();
      if (cleared) {
        if (storage && typeof storage.remove === 'function') {
          storage.remove(pendingCleanupKey);
        } else if (storage && typeof storage.set === 'function') {
          storage.set(pendingCleanupKey, null);
        }
        delete matchingOrder.pendingCartCleanup;
        storage.set(ORDERS_KEY, ordersList);
      }
      const warning = cleared ? '' : 'Đơn hàng đã được lưu thành công nhưng giỏ hàng chưa thể dọn sạch tự động.';
      renderOrderSuccessView(matchingOrder, warning);
      return;
    } else {
      // Marker stale / expired / fake -> dọn dẹp để không chặn giỏ hàng
      if (storage && typeof storage.remove === 'function') {
        storage.remove(pendingCleanupKey);
      } else if (storage && typeof storage.set === 'function') {
        storage.set(pendingCleanupKey, null);
      }
    }
  }

  // 2. Kiểm tra nếu giỏ hàng rỗng
  if (items.length === 0) {
    if (lastCompleted) {
      // Người dùng vừa reload sau khi đặt hàng thành công -> hiển thị đơn vừa đặt
      renderOrderSuccessView(lastCompleted);
      return;
    }
    const checkoutContainer = document.querySelector('.checkout');
    if (checkoutContainer) {
      checkoutContainer.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: var(--c-surface, #fff); border-radius: var(--radius-md, 8px); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.1));">
          <svg class="icon" style="width: 56px; height: 56px; color: var(--c-muted, #999); margin-bottom: 16px;" aria-hidden="true">
            <use href="#i-cart"></use>
          </svg>
          <h2 style="font-size: 20px; margin-bottom: 8px;">Giỏ hàng của bạn đang trống</h2>
          <p style="color: var(--c-muted, #666); margin-bottom: 24px;">Bạn chưa chọn sản phẩm nào để thanh toán. Vui lòng thêm sản phẩm vào giỏ hàng trước.</p>
          <a class="btn btn--primary" href="products.html">Khám phá sản phẩm ngay</a>
        </div>
      `;
    }
    return;
  }

  // 3. Giỏ hàng mới hợp lệ -> Render Order Summary đồng bộ với giỏ hàng
  const orderList = document.querySelector('[data-list="order"]');
  if (orderList) {
    orderList.innerHTML = items.map(item => {
      const p = item.product;
      return `
        <li class="summary__item" data-order-item data-id="${escapeHTML(p.id)}">
          <img class="summary__thumb" src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy">
          <span class="summary__info">
            <span class="summary__name">${escapeHTML(p.name)}</span>
            <span class="summary__qty">${formatPrice(item.itemPrice)} × ${item.quantity}</span>
          </span>
          <span class="summary__price" data-line-total>${formatPrice(item.lineTotal)}</span>
        </li>
      `;
    }).join('');
  }

  const countItemsEl = document.querySelector('.checkout__aside [data-cart-count-items]');
  if (countItemsEl) countItemsEl.textContent = totals.totalQuantity;

  const subtotalEl = document.querySelector('.checkout__aside [data-cart-subtotal]');
  if (subtotalEl) subtotalEl.textContent = formatPrice(totals.subtotal);

  const shippingEl = document.querySelector('.checkout__aside [data-cart-shipping]');
  if (shippingEl) {
    shippingEl.textContent = totals.shipping === 0 ? 'Miễn phí' : formatPrice(totals.shipping);
  }

  const totalEl = document.querySelector('.checkout__aside [data-cart-total]');
  if (totalEl) totalEl.textContent = formatPrice(totals.total);

  // 4. Khởi tạo chọn Tỉnh / Huyện cascading
  const provinceSelect = document.querySelector('[data-province]');
  const districtSelect = document.querySelector('[data-district]');
  if (provinceSelect && districtSelect) {
    const updateDistricts = () => {
      const provKey = provinceSelect.value;
      validation.clearError(provinceSelect);
      validation.clearError(districtSelect);

      if (!provKey || !locationData[provKey]) {
        districtSelect.innerHTML = '<option value="">Chọn tỉnh / thành phố trước</option>';
        districtSelect.disabled = true;
        return;
      }

      const { districts } = locationData[provKey];
      districtSelect.disabled = false;
      districtSelect.innerHTML = [
        '<option value="">Chọn quận / huyện</option>',
        ...districts.map(d => `<option value="${escapeHTML(d.id)}">${escapeHTML(d.name)}</option>`)
      ].join('');
    };

    provinceSelect.addEventListener('change', updateDistricts);
    if (provinceSelect.value) {
      updateDistricts();
    }
  }

  // 5. Tự động điền thông tin người nhận và địa chỉ mặc định từ Sổ địa chỉ & Hồ sơ
  const hoTenInput = form.querySelector('[data-input="hoTen"]');
  const sdtInput = form.querySelector('[data-input="soDienThoai"]');
  const emailInput = form.querySelector('[data-input="email"]');
  const tinhInput = form.querySelector('[data-input="tinhThanh"]');
  const huyenInput = form.querySelector('[data-input="quanHuyen"]');
  const diaChiInput = form.querySelector('[data-input="diaChi"]');
  const ghiChuInput = form.querySelector('[data-input="ghiChu"]');

  // Đọc thông tin hồ sơ
  const profile = getAccountProfile();
  if (profile) {
    if (hoTenInput && !hoTenInput.value && (profile.name || profile.hoTen)) hoTenInput.value = profile.name || profile.hoTen;
    if (sdtInput && !sdtInput.value && (profile.phone || profile.soDienThoai)) sdtInput.value = profile.phone || profile.soDienThoai;
    if (emailInput && !emailInput.value && profile.email) emailInput.value = profile.email;
  }

  // Đọc sổ địa chỉ
  const addresses = getCurrentUser() ? storage.get(getAccountStorageKey('lasen_addresses'), []) : [];
  const defaultAddr = (Array.isArray(addresses) && addresses.length > 0)
    ? (addresses.find(a => a.isDefault) || addresses[0])
    : null;

  if (defaultAddr) {
    if (hoTenInput && !hoTenInput.value && defaultAddr.name) hoTenInput.value = defaultAddr.name;
    if (sdtInput && !sdtInput.value && defaultAddr.phone) sdtInput.value = defaultAddr.phone;
    if (ghiChuInput && !ghiChuInput.value && defaultAddr.note) ghiChuInput.value = defaultAddr.note;

    const fullAddr = defaultAddr.address || '';
    const addrStr = fullAddr.toLowerCase();

    // Nhận diện Tỉnh / Thành phố
    if (tinhInput && !tinhInput.value) {
      let matchedProv = '';
      for (const [key, val] of Object.entries(locationData)) {
        const cleanName = val.name.toLowerCase().replace('tp.', '').trim();
        if (addrStr.includes(cleanName) || addrStr.includes(key.replace(/-/g, ' '))) {
          matchedProv = key;
          break;
        }
      }

      if (matchedProv) {
        tinhInput.value = matchedProv;
        // Kích hoạt change để cập nhật dropdown Quận / Huyện đúng cascading
        tinhInput.dispatchEvent(new Event('change'));

        // Nhận diện Quận / Huyện
        if (huyenInput && locationData[matchedProv]) {
          for (const dist of locationData[matchedProv].districts) {
            const cleanDist = dist.name.toLowerCase().replace(/quận|huyện|thị xã|tp\./g, '').trim();
            if (addrStr.includes(cleanDist) || addrStr.includes(dist.id)) {
              huyenInput.value = dist.id;
              huyenInput.dispatchEvent(new Event('change'));
              break;
            }
          }
        }
      }
    }

    // Điền địa chỉ chi tiết
    if (diaChiInput && !diaChiInput.value && fullAddr) {
      diaChiInput.value = fullAddr;
    }
  }

  // 6. Khởi tạo xử lý nộp form và đặt hàng an toàn với token
  const idempotencyToken = isBuyNow ? buyNowToken : `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  initCheckoutFormSubmit(form, idempotencyToken, checkoutDeps);
}

/**
 * Xử lý biểu mẫu đặt hàng, kiểm tra hợp lệ và tạo đơn hàng
 */
export function initCheckoutFormSubmit(form, idempotencyToken, checkoutDeps = {}) {
  let isSubmitting = false;
  const initialUserId = getCurrentUser()?.id ?? null;

  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('input', () => validation.clearError(field));
    field.addEventListener('change', () => validation.clearError(field));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (String(getCurrentUser()?.id ?? '') !== String(initialUserId ?? '')) {
      window.location.reload();
      return;
    }

    validation.clearAllErrors(form);

    const hoTenInput = form.querySelector('[data-input="hoTen"]');
    const sdtInput = form.querySelector('[data-input="soDienThoai"]');
    const emailInput = form.querySelector('[data-input="email"]');
    const tinhInput = form.querySelector('[data-input="tinhThanh"]');
    const huyenInput = form.querySelector('[data-input="quanHuyen"]');
    const diaChiInput = form.querySelector('[data-input="diaChi"]');
    const termsCheckbox = form.querySelector('[data-input="dongY"]');
    const paymentRadio = form.querySelector('input[name="thanhToan"]:checked');
    const ghiChuInput = form.querySelector('[data-input="ghiChu"]');

    let firstErrorField = null;

    if (!validation.isRequired(hoTenInput.value) || hoTenInput.value.trim().length < 2) {
      validation.showError(hoTenInput, 'Vui lòng nhập họ và tên đầy đủ (tối thiểu 2 ký tự).');
      if (!firstErrorField) firstErrorField = hoTenInput;
    }

    if (!validation.isValidPhone(sdtInput.value)) {
      validation.showError(sdtInput, 'Số điện thoại không đúng định dạng (cần 10 chữ số).');
      if (!firstErrorField) firstErrorField = sdtInput;
    }

    if (!validation.isValidEmail(emailInput.value)) {
      validation.showError(emailInput, 'Vui lòng nhập địa chỉ email hợp lệ.');
      if (!firstErrorField) firstErrorField = emailInput;
    }

    if (!validation.isRequired(tinhInput.value)) {
      validation.showError(tinhInput, 'Vui lòng chọn Tỉnh / Thành phố nhận hàng.');
      if (!firstErrorField) firstErrorField = tinhInput;
    }

    if (!validation.isRequired(huyenInput.value)) {
      validation.showError(huyenInput, 'Vui lòng chọn Quận / Huyện nhận hàng.');
      if (!firstErrorField) firstErrorField = huyenInput;
    }

    if (!validation.isRequired(diaChiInput.value) || diaChiInput.value.trim().length < 5) {
      validation.showError(diaChiInput, 'Vui lòng nhập số nhà, tên đường chi tiết.');
      if (!firstErrorField) firstErrorField = diaChiInput;
    }

    if (!termsCheckbox.checked) {
      validation.showError(termsCheckbox, 'Bạn cần đồng ý với chính sách của Lá Sen để tiếp tục.');
      if (!firstErrorField) firstErrorField = termsCheckbox;
    }

    if (firstErrorField) {
      firstErrorField.focus();
      showToast('Vui lòng kiểm tra lại các thông tin còn thiếu hoặc sai định dạng.', 'error');
      return;
    }

    const provinceKey = tinhInput.value;
    const provinceName = locationData[provinceKey]?.name || provinceKey;
    const districtKey = huyenInput.value;
    const districtObj = locationData[provinceKey]?.districts.find(d => d.id === districtKey);
    const districtName = districtObj ? districtObj.name : districtKey;
    const fullAddress = `${diaChiInput.value.trim()}, ${districtName}, ${provinceName}`;

    const submitBtn = document.querySelector('[data-place-order]');

    // Khóa nút để chặn double click / double submit
    isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang xử lý đơn hàng...';
    }

    const orderInput = {
      idempotencyToken,
      userId: getCurrentUser()?.id ?? null,
      customer: {
        name: hoTenInput.value.trim(),
        phone: sdtInput.value.trim(),
        email: emailInput.value.trim()
      },
      shippingAddress: fullAddress,
      paymentMethod: paymentRadio ? (paymentRadio.value === 'cod' ? 'COD' : 'Chuyển khoản') : 'COD',
      note: ghiChuInput ? ghiChuInput.value.trim() : ''
    };

    const checkoutResult = processCheckout(orderInput, checkoutDeps);

    if (!checkoutResult.success) {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đặt hàng';
      }
      showToast(checkoutResult.message, 'error');
      return;
    }

    if (checkoutResult.warning) {
      showToast(checkoutResult.warning, 'error', 6000);
    } else {
      showToast('Đặt hàng thành công!');
    }

    renderOrderSuccessView(checkoutResult.order, checkoutResult.warning);
  });
}

/**
 * Hiển thị màn hình xác nhận đơn hàng thành công mô phỏng
 */
function renderOrderSuccessView(order, warningMessage = '') {
  const container = document.querySelector('.checkout');
  if (!container) return;

  const orderDate = new Date(order.date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const warningMarkup = warningMessage ? `
    <div style="margin-bottom: 16px; padding: 12px 16px; background: #fff3cd; color: #856404; border-radius: 6px; font-size: 13px; text-align: left;">
      <strong>Lưu ý:</strong> ${escapeHTML(warningMessage)}
    </div>
  ` : '';

  container.innerHTML = `
    <div style="grid-column: 1 / -1; max-width: 760px; margin: 0 auto; background: var(--c-surface, #fff); border-radius: var(--radius-md, 8px); box-shadow: var(--shadow, 0 4px 12px rgba(0,0,0,0.08)); padding: var(--sp-8, 32px);">
      
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; background: #eafaf1; color: #27ae60; margin-bottom: 16px;">
          <svg class="icon" style="width: 36px; height: 36px;" aria-hidden="true"><use href="#i-check"></use></svg>
        </div>
        <h2 style="font-size: 24px; color: var(--c-ink, #222); margin-bottom: 8px;">Đặt hàng thành công!</h2>
        <div style="display: inline-block; padding: 6px 14px; background: #fff3cd; color: #856404; border-radius: 4px; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
          ⚠ ĐÂY LÀ ĐƠN HÀNG MÔ PHỎNG (DEMO — KHÔNG THU TIỀN THỰC TẾ)
        </div>
        <p style="color: var(--c-muted, #666); font-size: 14px;">
          Cảm ơn bạn <strong>${escapeHTML(order.customer.name)}</strong>. Lá Sen đã ghi nhận đơn hàng <strong>#${escapeHTML(order.id)}</strong> vào hệ thống lưu trữ trên máy bạn.
        </p>
      </div>

      ${warningMarkup}

      <div style="background: var(--c-paper, #f9f9f9); border-radius: 6px; padding: 16px 20px; margin-bottom: 24px; font-size: 14px; line-height: 1.8;">
        <div><strong>Mã đơn hàng:</strong> #${escapeHTML(order.id)}</div>
        <div><strong>Thời gian đặt:</strong> ${escapeHTML(orderDate)}</div>
        <div><strong>Số điện thoại:</strong> ${escapeHTML(order.customer.phone)}</div>
        <div><strong>Địa chỉ giao:</strong> ${escapeHTML(order.shippingAddress)}</div>
        <div><strong>Phương thức thanh toán:</strong> ${escapeHTML(order.paymentMethod)}</div>
        <div><strong>Trạng thái:</strong> <span class="badge badge--soft" style="font-size: 12px;">${escapeHTML(order.status)}</span></div>
      </div>

      <h3 style="font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid var(--c-border, #eee); padding-bottom: 8px;">Sản phẩm đã đặt</h3>
      <ul style="list-style: none; padding: 0; margin: 0 0 24px 0;">
        ${order.items.map(it => `
          <li style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--c-border, #eee);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${escapeHTML(it.image)}" alt="${escapeHTML(it.name)}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 4px;">
              <div>
                <div style="font-weight: 500; font-size: 14px;">${escapeHTML(it.name)}</div>
                <div style="font-size: 12px; color: var(--c-muted, #777);">${formatPrice(it.price)} × ${it.quantity}</div>
              </div>
            </div>
            <div style="font-weight: 600; font-size: 14px;">${formatPrice(it.price * it.quantity)}</div>
          </li>
        `).join('')}
      </ul>

      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; margin-bottom: 32px; font-size: 18px; font-weight: 700;">
        <span>Tổng thanh toán:</span>
        <span style="color: var(--c-primary, #27ae60);">${formatPrice(order.totals.total)}</span>
      </div>

      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
        <a class="btn btn--outline" href="products.html">Tiếp tục xem sản phẩm</a>
        <a class="btn btn--primary" href="profile.html">Xem đơn hàng trong Hồ sơ</a>
      </div>
    </div>
  `;

  window.scrollTo({ top: container.offsetTop - 80, behavior: 'smooth' });
}
