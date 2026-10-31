export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone) {
  return /^0\d{9}$/.test(phone.replaceAll(' ', ''));
}

export function showError(errorFor, message) {
  const errorElement = document.querySelector(`[data-error-for="${errorFor}"]`);
  errorElement.textContent = message;

  const field = errorElement.closest('.field') || errorElement.previousElementSibling;
  if (!field) return;

  field.classList.toggle('is-invalid', message !== '');
  field.querySelectorAll('input, select, textarea').forEach(input => {
    if (message) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  });
}

export function clearErrors(form) {
  form.querySelectorAll('.field__error').forEach(errorElement => {
    errorElement.textContent = '';
  });
  form.querySelectorAll('.is-invalid').forEach(field => {
    field.classList.remove('is-invalid');
  });
  form.querySelectorAll('[aria-invalid]').forEach(input => {
    input.removeAttribute('aria-invalid');
  });
}

export function clearErrorWhenTyping(form) {
  form.addEventListener('input', event => {
    const field = event.target.closest('.field');
    if (!field) return;

    field.classList.remove('is-invalid');
    event.target.removeAttribute('aria-invalid');
    const errorElement = field.querySelector('.field__error');
    if (errorElement) {
      errorElement.textContent = '';
    }
  });
}
