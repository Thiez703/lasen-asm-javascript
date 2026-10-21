import { getProductById } from '../services/dataService.js';
import { getCurrentUser, updateProfile, logout, getAddresses, saveAddresses } from '../services/accountService.js';
import { getOrders, getCancelledOrderIds, cancelOrder, addToCart } from '../services/cartService.js';
import { renderWishlist } from './products.js';
import { updateHeaderAccount } from '../modules/ui.js';
import { formatPrice, isValidEmail, isValidPhone, showError, clearErrors, clearErrorWhenTyping, showToast } from '../utils/helpers.js';

const ORDER_STATUS = {
  'Chờ xác nhận': { key: 'cho-xac-nhan', badge: 'badge--soft' },
  'Đang vận chuyển': { key: 'dang-giao', badge: 'badge--info' },
  'Đã giao hàng': { key: 'da-giao', badge: 'badge--success' },
  'Đã huỷ': { key: 'da-huy', badge: 'badge--danger' }
};

export function renderProfile() {
  if (!document.querySelector('[data-account-tabs]')) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  showAccountCard(user);
  initTabs();
  initProfileForm();
  initAddressBook();
  renderOrders(user);
  renderWishlist();

  document.querySelector('[data-logout]').addEventListener('click', () => {
    logout();
    window.location.href = 'login.html';
  });
}

function showAccountCard(user) {
  const lastWord = user.name.split(' ').pop();
  document.querySelector('[data-account-avatar]').textContent = lastWord.charAt(0).toUpperCase();
  document.querySelector('[data-account-email]').textContent = user.email;

  const since = document.querySelector('[data-account-since]');
  if (user.createdAt) {
    const date = new Date(user.createdAt);
    since.textContent = `Thành viên từ tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
  } else {
    since.textContent = 'Thành viên Lá Sen';
  }
}

function initTabs() {
  const tabs = document.querySelectorAll('[data-account-tab]');
  const panels = document.querySelectorAll('[data-account-panel]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-account-tab');
      tabs.forEach(item => item.classList.toggle('is-active', item === tab));
      panels.forEach(panel => panel.classList.toggle('is-hidden', panel.getAttribute('data-account-panel') !== tabName));
    });
  });
}

function initProfileForm() {
  const form = document.querySelector('[data-profile-form]');
  const nameInput = document.getElementById('pf-name');
  const phoneInput = document.getElementById('pf-phone');
  const emailInput = document.getElementById('pf-email');
  const birthInput = document.getElementById('pf-birth');
  const skinSelect = document.getElementById('pf-skin');
  const newsletterCheckbox = form.querySelector('[name="nhanBanTin"]');

  function fillForm() {
    const user = getCurrentUser();
    nameInput.value = user.name;
    phoneInput.value = user.phone;
    emailInput.value = user.email;
    birthInput.value = user.birth || '';
    skinSelect.value = user.skin || '';
    form.querySelector(`[name="gioiTinh"][value="${user.gender || 'nu'}"]`).checked = true;
    newsletterCheckbox.checked = user.newsletter !== false;
  }
  fillForm();
  clearErrorWhenTyping(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors(form);

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();

    let isValid = true;
    if (name.length < 2) {
      showError('profileHoTen', 'Vui lòng nhập họ và tên (ít nhất 2 ký tự).');
      isValid = false;
    }
    if (!isValidPhone(phone)) {
      showError('profileSoDienThoai', 'Số điện thoại cần 10 chữ số và bắt đầu bằng 0.');
      isValid = false;
    }
    if (!isValidEmail(email)) {
      showError('profileEmail', 'Vui lòng nhập địa chỉ email hợp lệ.');
      isValid = false;
    }
    if (!isValid) return;

    const saved = updateProfile({
      name: name,
      phone: phone,
      email: email,
      birth: birthInput.value,
      skin: skinSelect.value,
      gender: form.querySelector('[name="gioiTinh"]:checked').value,
      newsletter: newsletterCheckbox.checked
    });
    if (!saved) {
      showError('profileEmail', 'Email này đã được tài khoản khác sử dụng.');
      return;
    }

    showAccountCard(getCurrentUser());
    updateHeaderAccount();
    showToast('Đã lưu thông tin hồ sơ!');
  });

  document.querySelector('[data-profile-reset]').addEventListener('click', (event) => {
    event.preventDefault();
    clearErrors(form);
    fillForm();
  });
}

function showAddresses() {
  const addresses = getAddresses();
  document.querySelector('[data-addresses-count]').textContent = addresses.length;
  document.querySelector('[data-addresses-empty]').classList.toggle('is-hidden', addresses.length > 0);

  document.querySelector('[data-list="addresses"]').innerHTML = addresses.map(address => `
    <article class="address ${address.isDefault ? 'address--default' : ''}">
      <div class="address__head">
        <h3 class="address__name">${address.name}</h3>
        ${address.isDefault ? '<span class="badge badge--soft">Mặc định</span>' : ''}
      </div>
      <p class="address__line">
        <svg class="icon" aria-hidden="true"><use href="#i-phone"></use></svg>
        ${address.phone}
      </p>
      <p class="address__line">
        <svg class="icon" aria-hidden="true"><use href="#i-pin"></use></svg>
        ${address.address}
      </p>
      ${address.note ? `<p class="address__note">${address.note}</p>` : ''}
      <div class="address__actions">
        <button class="btn btn--ghost btn--sm" type="button" data-address-edit data-id="${address.id}">
          <svg class="icon" aria-hidden="true"><use href="#i-pencil"></use></svg>
          Sửa
        </button>
        <button class="btn btn--ghost btn--sm address__remove" type="button" data-address-delete data-id="${address.id}">
          <svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>
          Xoá
        </button>
      </div>
    </article>
  `).join('');
}

function initAddressBook() {
  const formBox = document.querySelector('[data-address-form-box]');
  const form = document.querySelector('[data-address-form]');
  const idInput = form.querySelector('[data-address-input="id"]');
  const nameInput = form.querySelector('[data-address-input="name"]');
  const phoneInput = form.querySelector('[data-address-input="phone"]');
  const addressInput = form.querySelector('[data-address-input="address"]');
  const noteInput = form.querySelector('[data-address-input="note"]');
  const defaultCheckbox = form.querySelector('[data-address-input="isDefault"]');

  showAddresses();
  clearErrorWhenTyping(form);

  // Không truyền address thì mở form thêm mới, có address thì mở form sửa địa chỉ đó
  function openForm(address) {
    clearErrors(form);
    form.reset();

    if (address) {
      document.querySelector('[data-address-form-title]').textContent = 'Chỉnh sửa địa chỉ';
      idInput.value = address.id;
      nameInput.value = address.name;
      phoneInput.value = address.phone;
      addressInput.value = address.address;
      noteInput.value = address.note;
      defaultCheckbox.checked = address.isDefault;
    } else {
      document.querySelector('[data-address-form-title]').textContent = 'Thêm địa chỉ mới';
    }
    formBox.classList.remove('is-hidden');
  }

  function closeForm() {
    formBox.classList.add('is-hidden');
  }

  document.querySelectorAll('[data-address-add], [data-address-add-empty]').forEach(button => {
    button.addEventListener('click', () => {
      if (getAddresses().length >= 5) {
        showToast('Bạn chỉ có thể lưu tối đa 5 địa chỉ.', 'error');
        return;
      }
      openForm();
    });
  });

  form.querySelector('[data-address-cancel]').addEventListener('click', closeForm);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors(form);

    const newAddress = {
      id: idInput.value || 'addr-' + Date.now(),
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim(),
      note: noteInput.value.trim(),
      isDefault: defaultCheckbox.checked
    };

    let isValid = true;
    if (newAddress.name.length < 2) {
      showError('addressName', 'Vui lòng nhập họ và tên người nhận (ít nhất 2 ký tự).');
      isValid = false;
    }
    if (!isValidPhone(newAddress.phone)) {
      showError('addressPhone', 'Số điện thoại cần 10 chữ số và bắt đầu bằng 0.');
      isValid = false;
    }
    if (newAddress.address.length < 5) {
      showError('addressDetail', 'Vui lòng nhập địa chỉ nhận hàng chi tiết.');
      isValid = false;
    }
    if (!isValid) return;

    let addresses = getAddresses();

    if (newAddress.isDefault) {
      addresses.forEach(address => {
        address.isDefault = false;
      });
    }

    const isEditing = idInput.value !== '';
    if (isEditing) {
      addresses = addresses.map(address => address.id === newAddress.id ? newAddress : address);
    } else {
      addresses.push(newAddress);
    }

    saveAddresses(addresses);
    showAddresses();
    closeForm();
    showToast(isEditing ? 'Đã cập nhật địa chỉ!' : 'Đã thêm địa chỉ mới!');
  });

  document.querySelector('[data-list="addresses"]').addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-address-edit]');
    if (editButton) {
      const address = getAddresses().find(item => item.id === editButton.getAttribute('data-id'));
      openForm(address);
    }

    const deleteButton = event.target.closest('[data-address-delete]');
    if (deleteButton && confirm('Bạn có chắc muốn xoá địa chỉ này?')) {
      const addresses = getAddresses().filter(item => item.id !== deleteButton.getAttribute('data-id'));
      saveAddresses(addresses);
      showAddresses();
      closeForm();
      showToast('Đã xoá địa chỉ!');
    }
  });
}

async function renderOrders(user) {
  const statusResponse = await fetch('js/data/order-statuses.json');
  const statuses = await statusResponse.json();
  const sampleResponse = await fetch('js/data/sample-orders.json');
  const sampleOrders = await sampleResponse.json();

  const realOrders = getOrders().filter(order => order.userId === user.id);
  const demoOrders = sampleOrders.filter(order => order.userId === user.id);
  const orders = realOrders.concat(demoOrders);
  const cancelledIds = getCancelledOrderIds();
  orders.forEach(order => {
    if (cancelledIds.includes(order.id)) {
      order.status = 'Đã huỷ';
    }
  });
  document.querySelector('[data-orders-count]').textContent = orders.length;

  const filterBox = document.querySelector('[data-order-filters]');
  const orderList = document.querySelector('[data-list="orders"]');

  filterBox.innerHTML = statuses.map(status => `
    <button class="chip ${status.key === 'tat-ca' ? 'is-active' : ''}" type="button" data-order-filter="${status.key}">${status.label}</button>
  `).join('');

  function showOrders(statusKey) {
    const filtered = orders.filter(order => statusKey === 'tat-ca' || ORDER_STATUS[order.status].key === statusKey);
    document.querySelector('[data-orders-empty]').classList.toggle('is-hidden', filtered.length > 0);
    orderList.innerHTML = filtered.map(order => createOrderCard(order)).join('');
  }

  filterBox.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-order-filter]');
    if (!chip) return;

    filterBox.querySelectorAll('.chip').forEach(item => item.classList.toggle('is-active', item === chip));
    showOrders(chip.getAttribute('data-order-filter'));
  });

  orderList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-rebuy]');
    if (!button) return;

    const order = orders.find(item => item.id === button.getAttribute('data-id'));
    order.items.forEach(item => addToCart(item.productId, item.quantity));
    setTimeout(() => {
      window.location.href = 'cart.html';
    }, 800);
  });

  orderList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-cancel]');
    if (!button || !confirm('Bạn có chắc muốn huỷ đơn hàng này?')) return;

    const order = orders.find(item => item.id === button.getAttribute('data-id'));
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
  const cancelButtonHTML = status.key === 'cho-xac-nhan'
    ? `<button class="btn btn--ghost btn--sm" type="button" data-order-cancel data-id="${order.id}">Huỷ đơn</button>`
    : '';

  const itemsHTML = order.items.map(item => {
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
  }).join('');

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
