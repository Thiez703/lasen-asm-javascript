import { getProductById } from '../services/dataService.js';
import { getCart, getCartItems, getCartTotals, clearCart, saveOrder } from '../services/cartService.js';
import { getCurrentUser, getAddresses } from '../services/accountService.js';
import { formatPrice, isValidEmail, isValidPhone, showError, clearErrors, clearErrorWhenTyping, showToast } from '../utils/helpers.js';

const PROVINCES_API = 'https://provinces.open-api.vn/api/v1/?depth=2';
let provinces = [];

export async function renderCheckout() {
  const form = document.querySelector('[data-checkout-form]');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const buyNowId = params.get('buyNow');
  let cart = getCart();
  if (buyNowId) {
    cart = [{ productId: buyNowId, quantity: Number(params.get('quantity')) }];
  }

  const items = getCartItems(cart);
  const totals = getCartTotals(items);

  if (items.length === 0) {
    showEmptyCart();
    return;
  }

  showOrderSummary(items, totals);

  clearErrorWhenTyping(form);
  form.querySelector('[name="dongY"]').addEventListener('change', () => showError('dongY', ''));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm(form)) {
      showToast('Vui lòng kiểm tra lại các thông tin còn thiếu hoặc sai.', 'error');
      return;
    }

    const order = createOrder(items, totals);
    saveOrder(order);
    if (!buyNowId) {
      clearCart();
    }
    showToast('Đặt hàng thành công!');
    showOrderSuccess(order);
  });

  const response = await fetch(PROVINCES_API);
  provinces = await response.json();

  showProvinces();
  const provinceSelect = document.getElementById('tinhThanh');
  provinceSelect.addEventListener('change', () => showDistricts(provinceSelect.value));

  fillCustomerInfo();
}

function showEmptyCart() {
  document.querySelector('.checkout').innerHTML = `
    <div style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: var(--c-surface, #fff); border-radius: 8px;">
      <h2 style="font-size: 20px; margin-bottom: 8px;">Giỏ hàng của bạn đang trống</h2>
      <p style="margin-bottom: 24px;">Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán.</p>
      <a class="btn btn--primary" href="products.html">Khám phá sản phẩm ngay</a>
    </div>
  `;
}

function showOrderSummary(items, totals) {
  document.querySelector('[data-list="order"]').innerHTML = items.map(item => `
    <li class="summary__item">
      <img class="summary__thumb" src="${item.product.image}" alt="${item.product.name}" loading="lazy">
      <span class="summary__info">
        <span class="summary__name">${item.product.name}</span>
        <span class="summary__qty">${formatPrice(item.price)} × ${item.quantity}</span>
      </span>
      <span class="summary__price">${formatPrice(item.lineTotal)}</span>
    </li>
  `).join('');

  document.querySelector('[data-cart-count-items]').textContent = totals.totalQuantity;
  document.querySelector('[data-cart-subtotal]').textContent = formatPrice(totals.subtotal);
  document.querySelector('[data-cart-shipping]').textContent = totals.shipping === 0 ? 'Miễn phí' : formatPrice(totals.shipping);
  document.querySelector('.checkout__aside [data-cart-total]').textContent = formatPrice(totals.total);
}

function showProvinces() {
  const options = provinces.map(province => `<option value="${province.code}">${province.name}</option>`);
  document.getElementById('tinhThanh').innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' + options.join('');
  showDistricts('');
}

function showDistricts(provinceCode) {
  const districtSelect = document.getElementById('quanHuyen');
  const province = provinces.find(item => item.code === Number(provinceCode));

  if (!province) {
    districtSelect.innerHTML = '<option value="">Chọn tỉnh / thành phố trước</option>';
    districtSelect.disabled = true;
    return;
  }

  const options = province.districts.map(district => `<option value="${district.code}">${district.name}</option>`);
  districtSelect.innerHTML = '<option value="">Chọn quận / huyện</option>' + options.join('');
  districtSelect.disabled = false;
}

function fillCustomerInfo() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById('hoTen').value = user.name;
  document.getElementById('soDienThoai').value = user.phone;
  document.getElementById('email').value = user.email;

  const defaultAddress = getAddresses().find(address => address.isDefault);
  if (!defaultAddress) return;

  document.getElementById('diaChi').value = defaultAddress.address;
  document.getElementById('ghiChu').value = defaultAddress.note;

  const addressText = defaultAddress.address.toLowerCase();
  const province = provinces.find(item => {
    const shortName = item.name.toLowerCase().replace('thành phố ', '').replace('tỉnh ', '');
    return addressText.includes(shortName);
  });
  if (!province) return;

  document.getElementById('tinhThanh').value = province.code;
  showDistricts(province.code);

  const district = province.districts.find(item => addressText.includes(item.name.toLowerCase()));
  if (district) {
    document.getElementById('quanHuyen').value = district.code;
  }
}

function validateForm(form) {
  clearErrors(form);
  let isValid = true;

  if (document.getElementById('hoTen').value.trim().length < 2) {
    showError('hoTen', 'Vui lòng nhập họ và tên (ít nhất 2 ký tự).');
    isValid = false;
  }
  if (!isValidPhone(document.getElementById('soDienThoai').value.trim())) {
    showError('soDienThoai', 'Số điện thoại cần 10 chữ số và bắt đầu bằng 0.');
    isValid = false;
  }
  if (!isValidEmail(document.getElementById('email').value.trim())) {
    showError('email', 'Vui lòng nhập địa chỉ email hợp lệ.');
    isValid = false;
  }
  if (document.getElementById('tinhThanh').value === '') {
    showError('tinhThanh', 'Vui lòng chọn tỉnh / thành phố.');
    isValid = false;
  }
  if (document.getElementById('quanHuyen').value === '') {
    showError('quanHuyen', 'Vui lòng chọn quận / huyện.');
    isValid = false;
  }
  if (document.getElementById('diaChi').value.trim().length < 5) {
    showError('diaChi', 'Vui lòng nhập số nhà, tên đường.');
    isValid = false;
  }
  if (!form.querySelector('[name="dongY"]').checked) {
    showError('dongY', 'Bạn cần đồng ý với chính sách của Lá Sen để tiếp tục.');
    isValid = false;
  }

  return isValid;
}

function createOrder(items, totals) {
  const provinceSelect = document.getElementById('tinhThanh');
  const districtSelect = document.getElementById('quanHuyen');
  const provinceName = provinceSelect.options[provinceSelect.selectedIndex].text;
  const districtName = districtSelect.options[districtSelect.selectedIndex].text;
  const payment = document.querySelector('[name="thanhToan"]:checked').value;
  const user = getCurrentUser();

  return {
    id: 'ORD-' + Date.now(),
    userId: user ? user.id : null,
    date: new Date().toISOString(),
    status: 'Chờ xác nhận',
    customer: {
      name: document.getElementById('hoTen').value.trim(),
      phone: document.getElementById('soDienThoai').value.trim(),
      email: document.getElementById('email').value.trim()
    },
    shippingAddress: `${document.getElementById('diaChi').value.trim()}, ${districtName}, ${provinceName}`,
    paymentMethod: payment === 'cod' ? 'COD' : 'Chuyển khoản',
    note: document.getElementById('ghiChu').value.trim(),
    items: items.map(item => {
      return { productId: item.product.id, quantity: item.quantity, price: item.price };
    }),
    total: totals.total
  };
}

function showOrderSuccess(order) {
  const itemsHTML = order.items.map(item => {
    const product = getProductById(item.productId);
    return `
      <li style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--c-border, #eee);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${product.image}" alt="${product.name}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 4px;">
          <div>
            <div style="font-weight: 500; font-size: 14px;">${product.name}</div>
            <div style="font-size: 12px;">${formatPrice(item.price)} × ${item.quantity}</div>
          </div>
        </div>
        <div style="font-weight: 600; font-size: 14px;">${formatPrice(item.price * item.quantity)}</div>
      </li>
    `;
  }).join('');

  const container = document.querySelector('.checkout');
  container.innerHTML = `
    <div style="grid-column: 1 / -1; max-width: 760px; margin: 0 auto; background: var(--c-surface, #fff); border-radius: 8px; box-shadow: var(--shadow, 0 4px 12px rgba(0,0,0,0.08)); padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="font-size: 24px; margin-bottom: 8px;">Đặt hàng thành công!</h2>
        <p style="display: inline-block; padding: 6px 14px; background: #fff3cd; color: #856404; border-radius: 4px; font-weight: 600; font-size: 13px;">
          ĐÂY LÀ ĐƠN HÀNG MÔ PHỎNG (DEMO — KHÔNG THU TIỀN THỰC TẾ)
        </p>
        <p>Cảm ơn <strong>${order.customer.name}</strong>, Lá Sen đã ghi nhận đơn hàng <strong>#${order.id}</strong>.</p>
      </div>

      <div style="background: var(--c-paper, #f9f9f9); border-radius: 6px; padding: 16px 20px; margin-bottom: 24px; font-size: 14px; line-height: 1.8;">
        <div><strong>Thời gian đặt:</strong> ${new Date(order.date).toLocaleString('vi-VN')}</div>
        <div><strong>Số điện thoại:</strong> ${order.customer.phone}</div>
        <div><strong>Địa chỉ giao:</strong> ${order.shippingAddress}</div>
        <div><strong>Thanh toán:</strong> ${order.paymentMethod}</div>
        <div><strong>Trạng thái:</strong> <span class="badge badge--soft">${order.status}</span></div>
      </div>

      <h3 style="font-size: 16px; margin-bottom: 12px;">Sản phẩm đã đặt</h3>
      <ul style="list-style: none; padding: 0; margin: 0 0 24px;">${itemsHTML}</ul>

      <div style="display: flex; justify-content: space-between; margin-bottom: 32px; font-size: 18px; font-weight: 700;">
        <span>Tổng thanh toán:</span>
        <span style="color: var(--c-primary, #27ae60);">${formatPrice(order.total)}</span>
      </div>

      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
        <a class="btn btn--outline" href="products.html">Tiếp tục mua sắm</a>
        <a class="btn btn--primary" href="profile.html">Xem đơn hàng trong Hồ sơ</a>
      </div>
    </div>
  `;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
