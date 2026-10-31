import { getAddresses, saveAddresses } from '../../services/addressService.js';
import { getProvinces } from '../../services/locationService.js';
import { isValidPhone, showError, clearErrors, clearErrorWhenTyping } from '../../utils/form.js';
import { showToast } from '../../utils/toast.js';

export async function initAddressBook() {
  const formBox = document.querySelector('[data-address-form-box]');
  const form = document.querySelector('[data-address-form]');
  const idInput = form.querySelector('[data-address-input="id"]');
  const nameInput = form.querySelector('[data-address-input="name"]');
  const phoneInput = form.querySelector('[data-address-input="phone"]');
  const addressInput = form.querySelector('[data-address-input="address"]');
  const provinceInput = form.querySelector('[data-address-input="province"]');
  const districtInput = form.querySelector('[data-address-input="district"]');
  const noteInput = form.querySelector('[data-address-input="note"]');
  const defaultCheckbox = form.querySelector('[data-address-input="isDefault"]');

  showAddresses();
  clearErrorWhenTyping(form);
  let provinces;
  try {
    provinces = await getProvinces();
    provinceInput.innerHTML =
      '<option value="">Chọn tỉnh / thành phố</option>' +
      provinces.map(province => `<option value="${province.code}">${province.name}</option>`).join('');
  } catch (error) {
    showToast('Không thể tải danh sách tỉnh / thành phố. Vui lòng thử lại.', 'error');
    return;
  }

  provinceInput.addEventListener('change', () => {
    const province = provinces.find(item => item.code === Number(provinceInput.value));
    districtInput.innerHTML = province
      ? '<option value="">Chọn quận / huyện</option>' +
        province.districts.map(district => `<option value="${district.code}">${district.name}</option>`).join('')
      : '<option value="">Chọn tỉnh / thành phố trước</option>';
    districtInput.disabled = !province;
  });

  function openForm(address) {
    clearErrors(form);
    form.reset();

    if (address) {
      document.querySelector('[data-address-form-title]').textContent = 'Chỉnh sửa địa chỉ';
      idInput.value = address.id;
      nameInput.value = address.name;
      phoneInput.value = address.phone;
      addressInput.value = address.address;
      provinceInput.value = address.provinceCode || '';
      provinceInput.dispatchEvent(new Event('change'));
      districtInput.value = address.districtCode || '';
      noteInput.value = address.note;
      defaultCheckbox.checked = address.isDefault;
    } else {
      document.querySelector('[data-address-form-title]').textContent = 'Thêm địa chỉ mới';
      provinceInput.dispatchEvent(new Event('change'));
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

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors(form);

    const newAddress = {
      id: idInput.value || 'addr-' + Date.now(),
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim(),
      provinceCode: provinceInput.value,
      provinceName: provinceInput.options[provinceInput.selectedIndex]?.text || '',
      districtCode: districtInput.value,
      districtName: districtInput.options[districtInput.selectedIndex]?.text || '',
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
    if (!newAddress.provinceCode) {
      showError('addressProvince', 'Vui lòng chọn tỉnh / thành phố.');
      isValid = false;
    }
    if (!newAddress.districtCode) {
      showError('addressDistrict', 'Vui lòng chọn quận / huyện.');
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
      addresses = addresses.map(address => (address.id === newAddress.id ? newAddress : address));
    } else {
      addresses.push(newAddress);
    }

    saveAddresses(addresses);
    showAddresses();
    closeForm();
    showToast(isEditing ? 'Đã cập nhật địa chỉ!' : 'Đã thêm địa chỉ mới!');
  });

  document.querySelector('[data-list="addresses"]').addEventListener('click', event => {
    const editButton = event.target.closest('[data-address-edit]');
    if (editButton) {
      const address = getAddresses().find(item => item.id === editButton.getAttribute('data-id'));
      openForm(address);
    }

    const deleteButton = event.target.closest('[data-address-delete]');
    if (deleteButton && confirm('Bạn có chắc muốn xoá địa chỉ này?')) {
      const addresses = getAddresses();
      const addressId = deleteButton.getAttribute('data-id');
      const index = addresses.findIndex(item => item.id === addressId);
      if (index === -1) return;

      addresses.splice(index, 1);
      saveAddresses(addresses);
      showAddresses();
      closeForm();
      showToast('Đã xoá địa chỉ!');
    }
  });
}

function showAddresses() {
  const addresses = getAddresses();
  document.querySelector('[data-addresses-count]').textContent = addresses.length;
  document.querySelector('[data-addresses-empty]').classList.toggle('is-hidden', addresses.length > 0);

  document.querySelector('[data-list="addresses"]').innerHTML = addresses
    .map(
      address => `
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
        ${address.address}${address.districtName ? `, ${address.districtName}` : ''}${address.provinceName ? `, ${address.provinceName}` : ''}
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
  `
    )
    .join('');
}
