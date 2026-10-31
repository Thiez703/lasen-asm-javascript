import { getProductById } from '../services/dataService.js';
import { getCart, getCartItems, getCartTotals, clearCart } from '../services/cartService.js';
import { saveOrder } from '../services/orderService.js';
import { getCurrentUser, rememberCurrentPage } from '../services/accountService.js';
import { getAddresses } from '../services/addressService.js';
import { getProvinces } from '../services/locationService.js';
import { formatPrice } from '../utils/price.js';
import { isValidEmail, isValidPhone, showError, clearErrors, clearErrorWhenTyping } from '../utils/form.js';
import { showToast } from '../utils/toast.js';

let provinces = [];

export async function renderCheckout() {
  const form = document.querySelector('[data-checkout-form]');
  if (!form) return;

  if (!getCurrentUser()) {
    rememberCurrentPage();
    window.location.replace('login.html');
    return;
  }

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

  form.addEventListener('submit', event => {
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

  try {
    provinces = await getProvinces();
  } catch (error) {
    showToast('Không thể tải danh sách tỉnh / thành phố. Vui lòng thử lại.', 'error');
    return;
  }

  showProvinces();
  const provinceSelect = document.getElementById('tinhThanh');
  provinceSelect.addEventListener('change', () => showDistricts(provinceSelect.value));

  fillCustomerInfo();
}

function showEmptyCart() {
  document.querySelector('.checkout').innerHTML = `
    <div class="empty checkout__empty">
      <svg class="empty__icon" aria-hidden="true"><use href="#i-cart"></use></svg>
      <h2 class="empty__title">Giỏ hàng của bạn đang trống</h2>
      <p class="empty__text">Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán.</p>
      <div class="empty__actions">
        <a class="btn btn--primary" href="products.html">Khám phá sản phẩm ngay</a>
      </div>
    </div>
  `;
}

function showOrderSummary(items, totals) {
  document.querySelector('[data-list="order"]').innerHTML = items
    .map(
      item => `
    <li class="summary__item">
      <img class="summary__thumb" src="${item.product.image}" alt="${item.product.name}" loading="lazy">
      <span class="summary__info">
        <span class="summary__name">${item.product.name}</span>
        <span class="summary__qty">${formatPrice(item.price)} × ${item.quantity}</span>
      </span>
      <span class="summary__price">${formatPrice(item.lineTotal)}</span>
    </li>
  `
    )
    .join('');

  document.querySelector('[data-cart-count-items]').textContent = totals.totalQuantity;
  document.querySelector('[data-cart-subtotal]').textContent = formatPrice(totals.subtotal);
  document.querySelector('[data-cart-shipping]').textContent =
    totals.shipping === 0 ? 'Miễn phí' : formatPrice(totals.shipping);
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

  if (defaultAddress.provinceCode && defaultAddress.districtCode) {
    document.getElementById('tinhThanh').value = defaultAddress.provinceCode;
    showDistricts(defaultAddress.provinceCode);
    document.getElementById('quanHuyen').value = defaultAddress.districtCode;
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
  const itemsHTML = order.items
    .map(item => {
      const product = getProductById(item.productId);
      return `
      <li class="checkout-success__item">
        <div class="checkout-success__product">
          <img class="checkout-success__thumb" src="${product.image}" alt="${product.name}">
          <div>
            <div class="checkout-success__name">${product.name}</div>
            <div class="checkout-success__qty">${formatPrice(item.price)} × ${item.quantity}</div>
          </div>
        </div>
        <div class="checkout-success__price">${formatPrice(item.price * item.quantity)}</div>
      </li>
    `;
    })
    .join('');

  const container = document.querySelector('.checkout');
  const dialog = document.createElement('dialog');
  dialog.className = 'checkout-success';
  dialog.innerHTML = `
    <div class="checkout-success__box">
      <button class="checkout-success__close" type="button" aria-label="Đóng">×</button>
      <div class="checkout-success__heading">
        <h2 class="checkout-success__title">Đặt hàng thành công!</h2>
        <p class="checkout-success__demo">
          ĐÂY LÀ ĐƠN HÀNG MÔ PHỎNG (DEMO — KHÔNG THU TIỀN THỰC TẾ)
        </p>
        <p>Cảm ơn <strong>${order.customer.name}</strong>, Lá Sen đã ghi nhận đơn hàng <strong>#${order.id}</strong>.</p>
      </div>

      <div class="checkout-success__details">
        <div><strong>Thời gian đặt:</strong> ${new Date(order.date).toLocaleString('vi-VN')}</div>
        <div><strong>Số điện thoại:</strong> ${order.customer.phone}</div>
        <div><strong>Địa chỉ giao:</strong> ${order.shippingAddress}</div>
        <div><strong>Thanh toán:</strong> ${order.paymentMethod}</div>
        <div><strong>Trạng thái:</strong> <span class="badge badge--soft">${order.status}</span></div>
      </div>

      <h3 class="checkout-success__subtitle">Sản phẩm đã đặt</h3>
      <ul class="checkout-success__items">${itemsHTML}</ul>

      <div class="checkout-success__total">
        <span>Tổng thanh toán:</span>
        <span>${formatPrice(order.total)}</span>
      </div>

      <div class="checkout-success__actions">
        <button class="btn btn--outline checkout-success__dismiss" type="button">Đóng</button>
        <a class="btn btn--outline" href="products.html">Tiếp tục mua sắm</a>
        <a class="btn btn--primary" href="profile.html">Xem đơn hàng trong Hồ sơ</a>
      </div>
    </div>
  `;

  const closeDialog = () => dialog.close();
  dialog.querySelector('.checkout-success__close').addEventListener('click', closeDialog);
  dialog.querySelector('.checkout-success__dismiss').addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', () => dialog.remove());

  container.appendChild(dialog);
  dialog.showModal();
}
