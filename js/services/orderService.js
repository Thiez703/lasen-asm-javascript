/**
 * Adapter nạp danh sách đơn hàng mẫu minh họa (Sample Orders) từ tệp JSON thực tế js/data/sample-orders.json
 * Toàn bộ đơn mẫu đều có cờ isDemo: true và không được ghi đè hay trộn lẫn với đơn thực tế của người dùng
 */

function readSampleOrdersInNode() {
  try {
    if (typeof process !== 'undefined' && process.getBuiltinModule) {
      const fs = process.getBuiltinModule('node:fs');
      const jsonPath = new URL('../data/sample-orders.json', import.meta.url);
      if (fs.existsSync(jsonPath)) {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    }
  } catch (err) {
    // Không đọc được file trong môi trường Node
  }
  return [];
}

let cachedSampleOrders = readSampleOrdersInNode();

/**
 * Nạp danh sách đơn mẫu bất đồng bộ từ js/data/sample-orders.json
 * @param {string} url
 * @returns {Promise<Array>}
 */
export async function loadSampleOrders(url = 'js/data/sample-orders.json') {
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (isNode) {
    cachedSampleOrders = readSampleOrdersInNode();
    return cachedSampleOrders;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Tải sample-orders.json thất bại (HTTP ${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      cachedSampleOrders = data;
      return cachedSampleOrders;
    }
  } catch (err) {
    console.warn('Lỗi khi nạp sample-orders.json:', err);
  }
  return cachedSampleOrders || [];
}

/**
 * Lấy danh sách đơn mẫu đồng bộ
 * @returns {Array}
 */
export function getSampleOrders() {
  if (cachedSampleOrders === null || cachedSampleOrders.length === 0) {
    if (typeof window === 'undefined') {
      cachedSampleOrders = readSampleOrdersInNode();
    }
  }
  return cachedSampleOrders || [];
}

