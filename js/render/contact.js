import { isValidEmail, showError, clearErrors, clearErrorWhenTyping, showToast } from '../utils/helpers.js';

export function renderContact() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  document.querySelectorAll('[data-accordion-item]').forEach(item => {
    const button = item.querySelector('[data-accordion-btn]');
    const answer = item.querySelector('[data-accordion-panel]');

    button.addEventListener('click', () => {
      const isOpen = item.classList.toggle('is-open');
      answer.classList.toggle('is-hidden', !isOpen);
      button.setAttribute('aria-expanded', isOpen);
    });
  });

  clearErrorWhenTyping(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors(form);

    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const subject = document.getElementById('contact-subject').value;
    const message = document.getElementById('contact-message').value.trim();

    let isValid = true;
    if (name === '') {
      showError('hoTen', 'Vui lòng nhập họ và tên của bạn.');
      isValid = false;
    }
    if (!isValidEmail(email)) {
      showError('email', 'Vui lòng nhập địa chỉ email hợp lệ.');
      isValid = false;
    }
    if (subject === '') {
      showError('chuDe', 'Vui lòng chọn chủ đề bạn cần hỗ trợ.');
      isValid = false;
    }
    if (message === '') {
      showError('noiDung', 'Vui lòng nhập nội dung câu hỏi.');
      isValid = false;
    }
    if (!isValid) return;

    form.reset();
    showToast('Cảm ơn bạn đã gửi liên hệ! Lá Sen sẽ phản hồi qua email trong 24 giờ.');
    document.querySelector('[data-contact-status]').innerHTML =
      '<span style="color: #27ae60; font-weight: 500;">✓ Đã gửi thành công. Nhân viên sẽ liên hệ với bạn sớm!</span>';
  });
}
