const PROVINCES_API = 'https://provinces.open-api.vn/api/v1/?depth=2';

export async function getProvinces() {
  const response = await fetch(PROVINCES_API);
  if (!response.ok) {
    throw new Error(`Không thể tải danh sách tỉnh / thành phố (${response.status}).`);
  }
  return response.json();
}
