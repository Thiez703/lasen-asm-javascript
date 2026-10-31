import { initLayout } from './modules/layout.js';
import { initAddToCartButtons } from './components/productCard.js';
import { initFavoriteButtons } from './components/favorites.js';
import { renderHome } from './render/home.js';
import { renderProducts } from './render/products.js';
import { renderProductDetail } from './render/detail.js';
import { renderCart } from './render/cart.js';
import { renderCheckout } from './render/checkout.js';
import { renderProfile } from './render/profile/index.js';
import { renderAuth } from './render/auth.js';
import { renderContact } from './render/contact.js';
import { removeOldStorage } from './utils/storage.js';

removeOldStorage();

const response = await fetch('assets/icons.svg');
const svgText = await response.text();
document.body.insertAdjacentHTML('afterbegin', svgText);

initLayout();
initAddToCartButtons();
initFavoriteButtons();
renderHome();
renderProducts();
renderProductDetail();
renderCart();
renderCheckout();
renderProfile();
renderAuth();
renderContact();
