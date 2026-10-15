# Dự Án Lá Sen Cosmetics (Vanilla JavaScript)

Môn học: WEB1044 — Lập trình cơ sở với JavaScript (FPT Polytechnic Cần Thơ).

## 1. Cách chạy ứng dụng qua máy chủ HTTP
Vì ứng dụng sử dụng chuẩn **ES Modules** (`<script type="module">`) và nạp dữ liệu động từ các file JSON thực tế (`js/data/products.json`, `js/data/order-statuses.json`), trình duyệt yêu cầu chạy trên máy chủ HTTP (không mở trực tiếp file `file:///` để tránh lỗi CORS):

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
   - `js/data/order-statuses.json`: Metadata 5 trạng thái đơn hàng (`tat-ca`, `cho-xac-nhan`, `dang-giao`, `da-giao`, `da-huy`) dùng để render động bộ lọc trên hồ sơ cá nhân.
   - `js/data/sample-orders.json`: Danh sách các đơn hàng mẫu minh họa mang cờ `isDemo: true`, chỉ hiển thị khi người dùng chưa có đơn hàng thực tế.
   - Thư mục `js/data` chỉ chứa JSON. `js/services/dataService.js` nạp dữ liệu trước khi các module sử dụng và cung cấp hàm tra cứu sản phẩm, đánh giá; `js/services/orderService.js` nạp đơn hàng mẫu.
2. **Giỏ hàng và tính tiền**:
   - Sản phẩm được tính theo giá bán hiện tại, số lượng được giới hạn theo tồn kho.
   - Tổng thanh toán gồm tiền sản phẩm và phí vận chuyển 30.000đ; đơn từ 500.000đ tự động miễn phí vận chuyển.
3. **Cơ chế chống trùng lặp & Phục hồi đơn hàng (Idempotency & Resilience)**:
   - Chống nhân bản đơn hàng bằng `idempotencyToken`.
   - Cơ chế phục hồi dọn giỏ hàng lỗi (Pending Cleanup Recovery) được giới hạn phạm vi phiên qua marker `lasen_pending_cart_cleanup` và cờ `pendingCartCleanup` của đơn vừa đặt, tuyệt đối không chặn các đơn mua lại hợp lệ (legitimate repeat order) từ lịch sử.
4. **Quản lý đơn hàng & Hồ sơ cá nhân**:
   - Bộ lọc trạng thái đơn hàng được render động từ JSON, hoạt động đầy đủ trên 5 trạng thái với xử lý giao diện rỗng (empty state).
   - Biểu mẫu hồ sơ cá nhân có kiểm tra tính hợp lệ (Validation) và lưu trữ bền vững (`lasen_user_profile`).
   - Tự động điền (Autofill) địa chỉ mặc định từ Sổ địa chỉ sang biểu mẫu thanh toán theo cấu trúc tầng (Cascading: Tỉnh -> Huyện).
5. **Tìm và lọc sản phẩm**:
   - Chọn một hoặc nhiều loại sản phẩm, kết hợp khoảng giá theo giá bán hiện tại.
   - Danh sách hỗ trợ tìm kiếm, sắp xếp và phân trang; trên điện thoại, mở nút Bộ lọc để chọn loại và giá.

---

## 4. Checklist đọc hiểu dự án

Đọc theo thứ tự các nhóm bên dưới. Khi đã hiểu một file, đổi `- [ ]` thành `- [x]` để đánh dấu. Chỉ tick khi bạn giải thích được vai trò của file, dữ liệu nó sử dụng và cách nó liên hệ với các file khác.

Luồng chính để theo dõi: **xem sản phẩm → thêm vào giỏ → thanh toán → xem đơn hàng trong hồ sơ**. Với mỗi trang, mở HTML và JavaScript tương ứng cạnh nhau để đối chiếu các thuộc tính `data-*`.

### 4.1. Tổng quan và điểm khởi động

- [ ] [README.md](README.md) — Hiểu cách chạy dự án bằng HTTP và các chức năng chính; chạy thử một lượt mua hàng.
- [ ] [index.html](index.html) — Xem cấu trúc trang chủ, các vùng `data-list` và thẻ `<script type="module" src="js/app.js">`.
- [ ] [js/app.js](js/app.js) — Nắm các module được import và thứ tự gọi hàm khởi tạo.

Mọi trang HTML đều nạp `app.js`. Các hàm khởi tạo kiểm tra phần tử DOM của chức năng trước khi xử lý, nên hãy chú ý các đoạn `querySelector(...)` và `if (!element) return`.

Các bước chỉ chạy một lần được viết trực tiếp trong hàm chính của từng chức năng, có chú thích để đọc từ trên xuống. Chỉ giữ hàm riêng cho phần được dùng lại như lưu trữ, định dạng, kiểm tra dữ liệu và cập nhật giao diện theo sự kiện.

### 4.2. Dữ liệu và các hàm dùng chung

- [ ] [js/data/products.json](js/data/products.json) — Hiểu cấu trúc một sản phẩm: `id`, giá, giá giảm, danh mục, loại da và tồn kho.
- [ ] [js/data/categories.json](js/data/categories.json) — Hiểu dữ liệu danh mục sản phẩm.
- [ ] [js/data/reviews.json](js/data/reviews.json) — Hiểu đánh giá được liên kết với sản phẩm qua `productId`.
- [ ] [js/data/users.json](js/data/users.json) — Hiểu dữ liệu người dùng mẫu.
- [ ] [js/services/dataService.js](js/services/dataService.js) — Theo dõi việc nạp JSON, export dữ liệu và tra cứu bằng `getProductById()` / `getReviewsByProductId()`.
- [ ] [js/services/storage.js](js/services/storage.js) — Hiểu đọc, ghi, xóa dữ liệu JSON trong `localStorage` và xử lý khi lưu trữ lỗi.
- [ ] [js/utils/format.js](js/utils/format.js) — Hiểu định dạng tiền, chuyển số nguyên và thoát ký tự HTML.
- [ ] [js/services/toast.js](js/services/toast.js) — Hiểu cách hiển thị thông báo cho người dùng.

### 4.3. Danh sách và chi tiết sản phẩm

- [ ] [products.html](products.html) — Xác định vùng danh sách, bộ lọc loại sản phẩm và khoảng giá, tìm kiếm, sắp xếp và phân trang.
- [ ] [js/services/favoriteService.js](js/services/favoriteService.js) — Hiểu cách lưu, thêm và bỏ sản phẩm yêu thích.
- [ ] [js/render/products.js](js/render/products.js) — Bắt đầu từ `createProductCard()` và `renderProducts()`; theo dõi sự kiện thêm giỏ và yêu thích.
- [ ] [js/modules/filter.js](js/modules/filter.js) — Bắt đầu từ `filterAndSortProducts()` và `initProductFilters()`; theo dõi lọc loại sản phẩm kết hợp giá, đồng bộ URL và render danh sách trên `products.html`.
- [ ] [product-detail.html](product-detail.html) — Xác định thông tin sản phẩm, thư viện ảnh, ô số lượng, các tab và đánh giá.
- [ ] [js/render/detail.js](js/render/detail.js) — Bắt đầu từ `renderProductDetail()`; theo dõi lấy `id` từ URL, tra cứu sản phẩm và thêm số lượng đã chọn vào giỏ.

### 4.4. Giỏ hàng

- [ ] [js/services/cartService.js](js/services/cartService.js) — Theo dõi `addToCart()` → `saveCart()`; hiểu chuẩn hóa giỏ, giới hạn tồn kho, tính tiền và phát sự kiện `cart:updated`.
- [ ] [cart.html](cart.html) — Xác định bảng giỏ hàng, ô số lượng, tổng tiền và giao diện giỏ rỗng.
- [ ] [js/render/cart.js](js/render/cart.js) — Bắt đầu từ `renderCart()` và `updateCartUI()`; hiểu cách hiển thị giỏ và xử lý đổi số lượng, xóa sản phẩm.

### 4.5. Thanh toán và tạo đơn hàng

- [ ] [js/modules/validation.js](js/modules/validation.js) — Hiểu kiểm tra dữ liệu bắt buộc, email, số điện thoại và hiển thị lỗi trên form.
- [ ] [js/services/checkoutService.js](js/services/checkoutService.js) — Bắt đầu từ `processCheckout()`; hiểu lấy dữ liệu giỏ, tạo đơn, lưu `lasen_orders` và dọn giỏ sau khi đặt hàng.
- [ ] [checkout.html](checkout.html) — Xác định form người nhận, phương thức thanh toán, tóm tắt đơn và nút đặt hàng.
- [ ] [js/render/checkout.js](js/render/checkout.js) — Bắt đầu từ `renderCheckout()` và `initCheckoutFormSubmit()`; theo dõi kiểm tra form, tạo `orderInput`, gọi service và hiển thị kết quả.

Ở lượt đọc tiếp theo, xem kỹ cơ chế chống tạo đơn trùng và phục hồi khi dọn giỏ lỗi trong `checkoutService.js`.

### 4.6. Hồ sơ, lịch sử đơn hàng và sổ địa chỉ

- [ ] [js/data/order-statuses.json](js/data/order-statuses.json) — Hiểu các trạng thái dùng để lọc đơn hàng.
- [ ] [js/data/sample-orders.json](js/data/sample-orders.json) — Hiểu cấu trúc đơn mẫu và cờ `isDemo`.
- [ ] [js/services/orderService.js](js/services/orderService.js) — Hiểu cách nạp và lưu cache đơn mẫu để minh họa khi chưa có đơn thực tế.
- [ ] [profile.html](profile.html) — Xác định các tab thông tin cá nhân, đơn hàng, địa chỉ và sản phẩm yêu thích.
- [ ] [js/render/profile.js](js/render/profile.js) — Bắt đầu từ `renderProfile()`; đọc lần lượt phần hồ sơ, sổ địa chỉ và chuyển tab trong hàm này, sau đó xem `renderUserOrders()` và `renderWishlist()` để hiểu cập nhật danh sách theo sự kiện.

### 4.7. Giao diện chung và các trang phụ

- [ ] [js/modules/ui.js](js/modules/ui.js) — Bắt đầu từ `initUI()`; hiểu cập nhật giỏ trên header, tìm kiếm, menu mobile và các tương tác chung.
- [ ] [contact.html](contact.html) — Xác định form liên hệ và vùng câu hỏi thường gặp.
- [ ] [js/render/contact.js](js/render/contact.js) — Hiểu mở/gập câu hỏi và kiểm tra form liên hệ.
- [ ] [about.html](about.html) — Hiểu cấu trúc trang giới thiệu và các thành phần dùng chung.

### 4.8. CSS và icon — đọc sau khi nắm luồng JavaScript

- [ ] [js/icons.js](js/icons.js) — Hiểu cách nạp kho icon SVG vào DOM.
- [ ] [js/utils/icons.svg](js/utils/icons.svg) — Hiểu các `<symbol>` được sử dụng qua `<use href="#i-...">`.
- [ ] [css/base.css](css/base.css) — Nắm các quy tắc CSS nền tảng.
- [ ] [css/components.css](css/components.css) — Nắm kiểu của các thành phần giao diện dùng chung.
- [ ] [css/pages/home.css](css/pages/home.css) — Hiểu bố cục và kiểu riêng của trang chủ.
- [ ] [css/pages/products.css](css/pages/products.css) — Hiểu bố cục danh sách và bộ lọc sản phẩm.
- [ ] [css/pages/detail.css](css/pages/detail.css) — Hiểu bố cục trang chi tiết sản phẩm.
- [ ] [css/pages/cart.css](css/pages/cart.css) — Hiểu bố cục trang giỏ hàng.
- [ ] [css/pages/checkout.css](css/pages/checkout.css) — Hiểu bố cục trang thanh toán.
- [ ] [css/pages/profile.css](css/pages/profile.css) — Hiểu bố cục các tab hồ sơ.
- [ ] [css/pages/contact.css](css/pages/contact.css) — Hiểu bố cục trang liên hệ.
- [ ] [css/pages/about.css](css/pages/about.css) — Hiểu bố cục trang giới thiệu.

### 4.9. Kiểm thử — đối chiếu hành vi sau khi đọc code

- [ ] [tests/unit.test.js](tests/unit.test.js) — Đọc các ví dụ kiểm tra hàm tiện ích, dữ liệu, validation và giỏ hàng.
- [ ] [tests/filter_checkout.test.js](tests/filter_checkout.test.js) — Đối chiếu các trường hợp lọc sản phẩm và xử lý thanh toán.
- [ ] [tests/new_features.test.js](tests/new_features.test.js) — Đọc các trường hợp kiểm thử tính năng bổ sung.
- [ ] [tests/regression.test.js](tests/regression.test.js) — Đọc các trường hợp kiểm tra để lỗi cũ không xuất hiện lại.
- [ ] [tests/icons.test.js](tests/icons.test.js) — Hiểu cách kiểm tra kho icon và các tham chiếu icon.
