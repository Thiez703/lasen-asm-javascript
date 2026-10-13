/**
 * Render và xử lý sự kiện trang Liên hệ & FAQ (contact.html)
 */

import { validation } from '../modules/validation.js';
import { showToast } from '../services/toast.js';

export function renderContact() {
  initFAQAccordion();
  initContactForm();
}

/**
 * Xử lý mở/gập các câu hỏi thường gặp (Accordion FAQ)
 */
function initFAQAccordion() {
  const accordion = document.querySelector('[data-accordion]');
  if (!accordion) return;

  const items = accordion.querySelectorAll('[data-accordion-item]');

  items.forEach(item => {
    const btn = item.querySelector('[data-accordion-btn]');
    const panel = item.querySelector('[data-accordion-panel]');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      // Nếu muốn chế độ toggle độc lập:
      if (isOpen) {
        item.classList.remove('is-open');
        panel.classList.add('is-hidden');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('is-open');
        panel.classList.remove('is-hidden');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/**
 * Xử lý kiểm tra hợp lệ và gửi biểu mẫu liên hệ
 */
function initContactForm() {
  const form = document.querySelector('.contact-card__form, form[data-contact-form]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    validation.clearAllErrors(form);

    const nameInput = form.querySelector('[data-input="hoTen"]');
    const emailInput = form.querySelector('[data-input="email"]');
    const subjectSelect = form.querySelector('[data-input="chuDe"]');
    const messageInput = form.querySelector('[data-input="noiDung"]');

    let hasError = false;
    let firstError = null;

    if (!nameInput || !validation.isRequired(nameInput.value)) {
      validation.showError(nameInput, 'Vui lòng nhập họ và tên của bạn.');
      hasError = true;
      if (!firstError) firstError = nameInput;
    }

    if (!emailInput || !validation.isValidEmail(emailInput.value)) {
      validation.showError(emailInput, 'Vui lòng nhập địa chỉ email hợp lệ.');
      hasError = true;
      if (!firstError) firstError = emailInput;
    }

    if (!subjectSelect || !validation.isRequired(subjectSelect.value)) {
      validation.showError(subjectSelect, 'Vui lòng chọn chủ đề bạn cần hỗ trợ.');
      hasError = true;
      if (!firstError) firstError = subjectSelect;
    }

    if (!messageInput || !validation.isRequired(messageInput.value)) {
      validation.showError(messageInput, 'Vui lòng nhập nội dung câu hỏi hoặc phản hồi.');
      hasError = true;
      if (!firstError) firstError = messageInput;
    }

    if (hasError) {
      if (firstError) firstError.focus();
      return;
    }

    // Gửi thành công mô phỏng
    showToast('Cảm ơn bạn đã gửi liên hệ! Lá Sen sẽ phản hồi qua email trong 24 giờ.');
    form.reset();

    const statusNote = document.querySelector('[data-contact-status]');
    if (statusNote) {
      statusNote.innerHTML = '<span style="color: #27ae60; font-weight: 500;">✓ Đã gửi thông điệp thành công. Nhân viên sẽ liên hệ với bạn sớm!</span>';
    }
  });
}
