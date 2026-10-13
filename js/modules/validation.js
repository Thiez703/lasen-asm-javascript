/**
 * Module kiểm tra hợp lệ dữ liệu biểu mẫu (Form Validation)
 */

export const validation = {
  /**
   * Kiểm tra chuỗi không rỗng
   * @param {string} val 
   * @returns {boolean}
   */
  isRequired(val) {
    if (val === null || val === undefined) return false;
    return String(val).trim().length > 0;
  },

  /**
   * Kiểm tra định dạng email hợp lệ
   * @param {string} email 
   * @returns {boolean}
   */
  isValidEmail(email) {
    if (!this.isRequired(email)) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).trim());
  },

  /**
   * Kiểm tra số điện thoại Việt Nam (10 số, đầu số 03, 05, 07, 08, 09, 02)
   * @param {string} phone 
   * @returns {boolean}
   */
  isValidPhone(phone) {
    if (!this.isRequired(phone)) return false;
    const clean = String(phone).replace(/[\s.-]/g, '');
    const re = /^(03|05|07|08|09|02)[0-9]{8}$/;
    return re.test(clean);
  },

  /**
   * Hiển thị thông báo lỗi ngay dưới trường nhập liệu
   * @param {HTMLElement} inputElem 
   * @param {string} message 
   */
  showError(inputElem, message) {
    if (!inputElem) return;

    inputElem.classList.add('has-error');
    inputElem.setAttribute('aria-invalid', 'true');

    const name = inputElem.name || inputElem.id;
    let errorSpan = null;

    if (name) {
      errorSpan = document.querySelector(`[data-error-for="${name}"]`);
    }

    if (!errorSpan && inputElem.closest('.field')) {
      errorSpan = inputElem.closest('.field').querySelector('.field__error');
    }

    if (errorSpan) {
      errorSpan.textContent = message;
      errorSpan.style.display = 'block';
    }
  },

  /**
   * Xoá thông báo lỗi của một trường
   * @param {HTMLElement} inputElem 
   */
  clearError(inputElem) {
    if (!inputElem) return;

    inputElem.classList.remove('has-error');
    inputElem.removeAttribute('aria-invalid');

    const name = inputElem.name || inputElem.id;
    let errorSpan = null;

    if (name) {
      errorSpan = document.querySelector(`[data-error-for="${name}"]`);
    }

    if (!errorSpan && inputElem.closest('.field')) {
      errorSpan = inputElem.closest('.field').querySelector('.field__error');
    }

    if (errorSpan) {
      errorSpan.textContent = '';
      errorSpan.style.display = '';
    }
  },

  /**
   * Xoá toàn bộ lỗi trong biểu mẫu
   * @param {HTMLFormElement} form 
   */
  clearAllErrors(form) {
    if (!form) return;
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => this.clearError(input));

    const errors = form.querySelectorAll('[data-error-for], .field__error');
    errors.forEach(el => {
      el.textContent = '';
      el.style.display = '';
    });
  }
};
