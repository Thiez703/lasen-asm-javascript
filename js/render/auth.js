import {
  DEMO_ACCOUNT,
  getCurrentUser,
  loginAccount,
  registerAccount
} from '../services/accountService.js';

/** Gắn tương tác cho hai biểu mẫu xác thực; dữ liệu do accountService quản lý. */
export function renderAuth() {
  const form = document.querySelector('[data-auth-form]');
  if (!form || form.dataset.authInitialized) return;
  form.dataset.authInitialized = 'true';

  const redirectIfSignedIn = () => {
    if (!getCurrentUser()) return false;
    window.location.replace('profile.html');
    return true;
  };

  if (redirectIfSignedIn()) return;
  window.addEventListener('pageshow', redirectIfSignedIn);
  window.addEventListener('storage', redirectIfSignedIn);

  const isRegister = form.dataset.authForm === 'register';
  const submitButton = form.querySelector('[data-auth-submit]');
  const message = form.querySelector('[data-auth-message]');
  const inputs = Array.from(form.querySelectorAll('[data-auth-input]'));
  let submitting = false;

  const clearFieldError = (input) => {
    input.removeAttribute('aria-invalid');
    input.closest('.field')?.classList.remove('is-invalid');
    const error = document.getElementById(`auth-error-${input.name}`);
    if (error) error.textContent = '';
  };

  const clearMessage = () => {
    if (!message) return;
    message.textContent = '';
    message.hidden = true;
  };

  const showMessage = (text) => {
    if (!message) return;
    message.textContent = text;
    message.hidden = false;
  };

  const showErrors = (result) => {
    let firstInvalid = null;
    inputs.forEach((input) => {
      const errorText = result.errors?.[input.name];
      if (!errorText) return;
      input.setAttribute('aria-invalid', 'true');
      input.closest('.field')?.classList.add('is-invalid');
      const error = document.getElementById(`auth-error-${input.name}`);
      if (error) error.textContent = errorText;
      if (!firstInvalid) firstInvalid = input;
    });

    if (result.error) showMessage(result.error);
    if (firstInvalid) {
      showMessage(result.error || 'Vui lòng kiểm tra các thông tin được đánh dấu bên dưới.');
      firstInvalid.focus();
    } else {
      showMessage(result.error || (isRegister
        ? 'Chưa thể tạo tài khoản. Vui lòng thử lại.'
        : 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.'));
      message?.focus();
    }
  };

  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      clearFieldError(input);
      // Mật khẩu thay đổi cũng có thể sửa lỗi xác nhận mật khẩu.
      if (input.name === 'password') {
        const confirmInput = inputs.find((field) => field.name === 'confirmPassword');
        if (confirmInput) clearFieldError(confirmInput);
      }
      clearMessage();
    });
  });

  form.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Ẩn' : 'Hiện';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', `${show ? 'Ẩn' : 'Hiện'} ${input.name === 'confirmPassword' ? 'mật khẩu xác nhận' : 'mật khẩu'}`);
    });
  });

  const demoButton = document.querySelector('[data-fill-demo]');
  if (demoButton) {
    document.querySelector('[data-demo-email]').textContent = DEMO_ACCOUNT.email;
    document.querySelector('[data-demo-password]').textContent = DEMO_ACCOUNT.password;
    demoButton.addEventListener('click', () => {
      if (submitting) return;
      form.elements.namedItem('email').value = DEMO_ACCOUNT.email;
      form.elements.namedItem('password').value = DEMO_ACCOUNT.password;
      inputs.forEach(clearFieldError);
      clearMessage();
      submitButton?.focus();
    });
  }

  if (!isRegister && new URLSearchParams(window.location.search).get('registered') === '1') {
    const successMessage = document.querySelector('[data-registration-success]');
    if (successMessage) successMessage.hidden = false;
    form.elements.namedItem('email')?.focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    clearMessage();
    inputs.forEach(clearFieldError);
    form.setAttribute('aria-busy', 'true');
    const initialLabel = submitButton?.textContent;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = isRegister ? 'Đang tạo tài khoản…' : 'Đang đăng nhập…';
    }
    if (demoButton) demoButton.disabled = true;

    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const result = await (isRegister ? registerAccount(values) : loginAccount(values));
      if (!result.success) {
        showErrors(result);
        return;
      }
      if (isRegister) {
        form.reset();
        window.location.assign('login.html?registered=1');
      } else {
        window.location.replace('profile.html');
      }
    } catch {
      showMessage('Không thể xử lý yêu cầu. Vui lòng kiểm tra bộ nhớ trình duyệt và thử lại.');
      message?.focus();
    } finally {
      submitting = false;
      form.removeAttribute('aria-busy');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = initialLabel;
      }
      if (demoButton) demoButton.disabled = false;
    }
  });
}
