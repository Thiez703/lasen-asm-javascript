import { initUI } from './modules/ui.js';
import { renderProducts } from './render/products.js';
import { renderProductDetail } from './render/detail.js';
import { renderCart } from './render/cart.js';
import { renderCheckout } from './render/checkout.js';
import { renderProfile } from './render/profile.js';
import { renderAuth } from './render/auth.js';
import { renderContact } from './render/contact.js';

const response = await fetch('js/utils/icons.svg');
const svgText = await response.text();
document.body.insertAdjacentHTML('afterbegin', svgText);

initUI();
renderProducts();
renderProductDetail();
renderCart();
renderCheckout();
renderProfile();
renderAuth();
renderContact();
