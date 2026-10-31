import { showError, clearErrorWhenTyping } from './form.js';

function openDialog({ icon, title, message, content = '', confirmText, cancelText, danger = false }) {
  const dialog = document.createElement('dialog');
  dialog.className = danger ? 'dialog dialog--danger' : 'dialog';
  dialog.innerHTML = `
    <form class="dialog__box" method="dialog" novalidate>
      <span class="dialog__icon">
        <svg class="icon" aria-hidden="true"><use href="#${icon}"></use></svg>
      </span>
      <h2 class="dialog__title">${title}</h2>
      <p class="dialog__text">${message}</p>
      ${content}
      <div class="dialog__actions">
        <button class="btn btn--outline" type="submit" value="cancel">${cancelText}</button>
        <button class="btn btn--primary dialog__confirm" type="submit" value="confirm">${confirmText}</button>
      </div>
    </form>
  `;

  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());

  document.body.appendChild(dialog);
  dialog.showModal();
  return dialog;
}

export function showConfirm({ confirmText = 'Đồng ý', cancelText = 'Quay lại', ...options }) {
  return new Promise(resolve => {
    const dialog = openDialog({ confirmText, cancelText, ...options });
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'));
  });
}

export function showPrompt({
  label,
  placeholder,
  emptyMessage,
  confirmText = 'Gửi',
  cancelText = 'Quay lại',
  ...options
}) {
  return new Promise(resolve => {
    const dialog = openDialog({
      confirmText,
      cancelText,
      ...options,
      content: `
        <div class="field dialog__field">
          <label class="sr-only" for="dialog-input">${label}</label>
          <textarea class="field__input field__input--area" id="dialog-input" placeholder="${placeholder}"></textarea>
          <span class="field__error" data-error-for="dialogInput"></span>
        </div>
      `
    });

    const form = dialog.querySelector('form');
    const input = dialog.querySelector('textarea');
    clearErrorWhenTyping(form);

    form.addEventListener('submit', event => {
      if (event.submitter.value === 'confirm' && input.value.trim() === '') {
        event.preventDefault();
        showError('dialogInput', emptyMessage);
        input.focus();
      }
    });

    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm' ? input.value.trim() : null);
    });
  });
}
