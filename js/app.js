import { loadIcons } from './icons.js';
import { initUI } from './modules/ui.js';
import { renderProducts } from './render/products.js';
import { renderProfile } from './render/profile.js';
import { renderCart } from './render/cart.js';
import { renderCheckout } from './render/checkout.js';
import { renderProductDetail } from './render/detail.js';
import { renderContact } from './render/contact.js';
import { renderAuth } from './render/auth.js';
import { initProductFilters } from './modules/filter.js';

await loadIcons();

initUI();
renderAuth();
renderProducts();
initProductFilters();
renderProductDetail();
renderCart();
renderCheckout();
renderProfile();
renderContact();



