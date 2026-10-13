import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

test('Kiểm tra kho icon SVG (icons.svg) dùng chung trong js/utils', async (t) => {
  const rootIconPath = path.join(projectRoot, 'icons.svg');
  const oldUtilsDir = path.join(projectRoot, 'utils');
  const oldUtilsIconPath = path.join(oldUtilsDir, 'icons.svg');
  const targetIconPath = path.join(projectRoot, 'js', 'utils', 'icons.svg');

  await t.test('File icons.svg không còn tồn tại ở root project con', () => {
    assert.strictEqual(fs.existsSync(rootIconPath), false, 'File icons.svg cũ không được tồn tại ở thư mục gốc');
  });

  await t.test('Thư mục utils root cũ không còn tồn tại', () => {
    assert.strictEqual(fs.existsSync(oldUtilsIconPath), false, 'File icons.svg không được nằm ở utils/icons.svg');
    assert.strictEqual(fs.existsSync(oldUtilsDir), false, 'Thư mục utils/ ở root project con phải được dọn dẹp');
  });

  await t.test('File icons.svg tồn tại ở vị trí đích (js/utils/icons.svg)', () => {
    assert.strictEqual(fs.existsSync(targetIconPath), true, 'File icons.svg phải tồn tại trong thư mục js/utils/');
  });

  await t.test('Nội dung SVG chứa các symbol id duy nhất và biểu tượng chính', () => {
    const content = fs.readFileSync(targetIconPath, 'utf8');
    assert.ok(content.includes('<svg class="sprite"'), 'File SVG phải có thẻ svg mở');
    assert.ok(content.includes('</svg>'), 'File SVG phải có thẻ svg đóng');

    const symbolMatches = [...content.matchAll(/id=["'](i-[a-z0-9-]+)["']/g)].map(m => m[1]);
    assert.strictEqual(symbolMatches.length, new Set(symbolMatches).size, 'Các symbol id không được trùng nhau');
    assert.ok(symbolMatches.includes('i-lotus'), 'Phải chứa symbol logo i-lotus');
    assert.ok(symbolMatches.includes('i-cart'), 'Phải chứa symbol i-cart');
    assert.ok(symbolMatches.includes('i-search'), 'Phải chứa symbol i-search');
  });

  await t.test('URL phân giải trong js/icons.js trỏ đúng tới js/utils/icons.svg qua import.meta.url', () => {
    const iconsJsPath = path.join(projectRoot, 'js', 'icons.js');
    const iconsJsContent = fs.readFileSync(iconsJsPath, 'utf8');
    assert.ok(iconsJsContent.includes("'./utils/icons.svg'"), "icons.js phải phân giải đường dẫn tới './utils/icons.svg'");

    // Mô phỏng resolve URL từ import.meta.url của js/icons.js
    const fakeIconsJsUrl = new URL('js/icons.js', 'http://localhost:3000/').href;
    const resolvedUrl = new URL('./utils/icons.svg', fakeIconsJsUrl).href;
    assert.strictEqual(resolvedUrl, 'http://localhost:3000/js/utils/icons.svg', 'URL phải trỏ về /js/utils/icons.svg');

    // Kiểm tra trường hợp trang nằm trong thư mục con lồng nhau (ví dụ: pages/sub/order.html)
    // Khi trang lồng nhau import module js/icons.js, import.meta.url của icons.js vẫn là http://localhost:3000/js/icons.js
    const resolvedFromNested = new URL('./utils/icons.svg', fakeIconsJsUrl).href;
    assert.strictEqual(resolvedFromNested, 'http://localhost:3000/js/utils/icons.svg', 'Trang lồng nhau vẫn phân giải đúng đường dẫn sprite');
  });

  await t.test('Mọi fragment #i-* được tham chiếu trong HTML và JS đều tồn tại trong js/utils/icons.svg', () => {
    const content = fs.readFileSync(targetIconPath, 'utf8');
    const svgSymbols = new Set([...content.matchAll(/id=["'](i-[a-z0-9-]+)["']/g)].map(m => m[1]));

    function walkDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = [];
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...walkDir(full));
        } else if (full.endsWith('.html') || (full.endsWith('.js') && !full.includes('tests'))) {
          files.push(full);
        }
      }
      return files;
    }

    const appFiles = walkDir(projectRoot);
    const missingReferences = [];

    for (const file of appFiles) {
      const fileContent = fs.readFileSync(file, 'utf8');
      const matches = [...fileContent.matchAll(/#(i-[a-z0-9-]+)/g)].map(m => m[1]);
      for (const ref of matches) {
        if (!svgSymbols.has(ref)) {
          missingReferences.push({ file: path.relative(projectRoot, file), symbol: ref });
        }
      }
    }

    assert.strictEqual(missingReferences.length, 0, `Có tham chiếu icon không tồn tại: ${JSON.stringify(missingReferences)}`);
  });
});
