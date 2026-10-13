/**
 * Quản lý và nạp kho icon SVG dùng chung (js/utils/icons.svg) vào DOM.
 * Tách các thẻ <symbol> ra file riêng để tái sử dụng và giữ code HTML sạch gọn.
 */

export async function loadIcons() {
  // Tránh nạp trùng lặp nếu kho icon đã tồn tại trong DOM
  if (document.getElementById('i-lotus')) return;

  try {
    const iconUrl = new URL('./utils/icons.svg', import.meta.url);
    const res = await fetch(iconUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svgText = await res.text();
    injectSprite(svgText);
  } catch (err) {
    console.error('Lỗi khi nạp kho icon từ js/utils/icons.svg:', err);
  }
}

function injectSprite(svgContent) {
  if (document.getElementById('i-lotus')) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElem = doc.querySelector('svg');

  if (svgElem) {
    svgElem.classList.add('sprite');
    svgElem.style.display = 'none';
    svgElem.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(document.importNode(svgElem, true), document.body.firstChild);
  } else {
    const container = document.createElement('div');
    container.style.display = 'none';
    container.setAttribute('aria-hidden', 'true');
    container.innerHTML = svgContent;
    document.body.insertBefore(container, document.body.firstChild);
  }
}
