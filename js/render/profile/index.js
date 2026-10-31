import { getCurrentUser, logout, rememberCurrentPage } from '../../services/accountService.js';
import { showAccountCard, initProfileForm } from './profileForm.js';
import { initAddressBook } from './addressBook.js';
import { renderOrders } from './orders.js';
import { renderWishlist } from '../../components/favorites.js';

export function renderProfile() {
  if (!document.querySelector('[data-account-tabs]')) return;

  const user = getCurrentUser();
  if (!user) {
    rememberCurrentPage();
    window.location.replace('login.html');
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
    window.location.replace('login.html');
  });
}

function initTabs() {
  const tabs = document.querySelectorAll('[data-account-tab]');
  const panels = document.querySelectorAll('[data-account-panel]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-account-tab');
      tabs.forEach(item => item.classList.toggle('is-active', item === tab));
      panels.forEach(panel =>
        panel.classList.toggle('is-hidden', panel.getAttribute('data-account-panel') !== tabName)
      );
    });
  });
}
