# Dự Án Lá Sen Cosmetics (Vanilla JavaScript)

Môn học: WEB1044 — Lập trình cơ sở với JavaScript (FPT Polytechnic Cần Thơ).

## 1. Cách chạy ứng dụng qua máy chủ HTTP
Vì ứng dụng sử dụng chuẩn **ES Modules** (`<script type="module">`) và nạp dữ liệu động từ các file JSON thực tế (`js/data/coupons.json`, `js/data/order-statuses.json`), trình duyệt yêu cầu chạy trên máy chủ HTTP (không mở trực tiếp file `file:///` để tránh lỗi CORS):

### Cách 1: Sử dụng VS Code Live Server (Khuyên dùng)
1. Mở thư mục dự án trong VS Code.
2. Cài đặt tiện ích mở rộng **Live Server**.
3. Nhấp chuột phải vào `index.html` và chọn **Open with Live Server**.

### Cách 2: Sử dụng Node.js (npx serve hoặc http-server)
Chạy lệnh sau tại thư mục dự án:
```bash
npx serve .
# Hoặc:
npx http-server -p 3000
```
Sau đó truy cập: `http://localhost:3000` (hoặc cổng được hiển thị).

### Cách 3: Sử dụng Python
```bash
python -m http.server 8000
```
Truy cập: `http://localhost:8000`.

---

## 2. Cách chạy kiểm thử tự động (Unit & Regression Tests)
Dự án tích hợp sẵn bộ kiểm thử chạy với Node.js native test runner (không cần cài thêm dependencies):
```bash
node --test tests/*.test.js
```
Kiểm tra cú pháp JavaScript:
```bash
node --check js/app.js
```

---

## 3. Kiến trúc dữ liệu và các tính năng chính
1. **Dữ liệu JSON thực tế (Single Source of Truth)**:
   - `js/data/products.json`: Danh sách 30 sản phẩm.
   - `js/data/categories.json`: Danh sách 5 danh mục sản phẩm.
   - `js/data/reviews.json`: Các đánh giá sản phẩm.
   - `js/data/users.json`: Dữ liệu người dùng mẫu.
   - `js/data/coupons.json`: Danh sách 5 mã ưu đãi (`LASEN30`, `SEN50`, `SEN10`, `FREESHIP`, `CHAOBAN`) dùng chung cho render trang chủ, giỏ hàng và thanh toán. Không duplicate hằng số coupon trong mã nguồn.
   - `js/data/order-statuses.json`: Metadata 5 trạng thái đơn hàng (`tat-ca`, `cho-xac-nhan`, `dang-giao`, `da-giao`, `da-huy`) dùng để render động bộ lọc trên hồ sơ cá nhân.
   - `js/data/sample-orders.json`: Danh sách các đơn hàng mẫu minh họa mang cờ `isDemo: true`, chỉ hiển thị khi người dùng chưa có đơn hàng thực tế.
   - Thư mục `js/data` chỉ chứa JSON. `js/services/dataService.js` nạp dữ liệu trước khi các module sử dụng và cung cấp hàm tra cứu sản phẩm, đánh giá; `js/services/orderService.js` nạp đơn hàng mẫu.
2. **Luồng mã giảm giá (Coupon)**:
   - Nút sao chép mã (Copy) trên giao diện trang chủ hoạt động bằng Clipboard API + fallback `execCommand`.
   - Giỏ hàng (`cart.html`) và Thanh toán (`checkout.html`) đều hỗ trợ nhập mã, áp dụng và gỡ bỏ mã với thông báo tiếng Việt cụ thể.
   - Mã giảm giá được đồng bộ qua `localStorage` (`lasen_applied_coupon`), tự động revalidate khi giỏ hàng thay đổi và tự động xóa sau khi đặt hàng thành công.
3. **Cơ chế chống trùng lặp & Phục hồi đơn hàng (Idempotency & Resilience)**:
   - Chống nhân bản đơn hàng bằng `idempotencyToken`.
   - Cơ chế phục hồi dọn giỏ hàng lỗi (Pending Cleanup Recovery) được giới hạn phạm vi phiên qua marker `lasen_pending_cart_cleanup` và cờ `pendingCartCleanup` của đơn vừa đặt, tuyệt đối không chặn các đơn mua lại hợp lệ (legitimate repeat order) từ lịch sử.
4. **Quản lý đơn hàng & Hồ sơ cá nhân**:
   - Bộ lọc trạng thái đơn hàng được render động từ JSON, hoạt động đầy đủ trên 5 trạng thái với xử lý giao diện rỗng (empty state).
   - Biểu mẫu hồ sơ cá nhân có kiểm tra tính hợp lệ (Validation) và lưu trữ bền vững (`lasen_user_profile`).
   - Tự động điền (Autofill) địa chỉ mặc định từ Sổ địa chỉ sang biểu mẫu thanh toán theo cấu trúc tầng (Cascading: Tỉnh -> Huyện).
