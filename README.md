# Dự Án Lá Sen Cosmetics (Vanilla JavaScript)

Môn học: WEB1044 — Lập trình cơ sở với JavaScript (FPT Polytechnic Cần Thơ).

## 1. Cách chạy ứng dụng qua máy chủ HTTP
Vì ứng dụng sử dụng chuẩn **ES Modules** (`<script type="module">`) và nạp dữ liệu từ các file JSON (`js/data/*.json`) bằng `fetch`, trình duyệt yêu cầu chạy trên máy chủ HTTP (không mở trực tiếp file `file:///` để tránh lỗi CORS):

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

## 2. Cấu trúc thư mục JavaScript

```
js/
├── app.js                   Điểm khởi động: nạp icon rồi gọi hàm của từng trang
├── data/*.json              Dữ liệu: sản phẩm, danh mục, đánh giá, tài khoản mẫu, trạng thái đơn, đơn mẫu
├── utils/
│   ├── helpers.js           Hàm dùng chung: định dạng giá, đọc/ghi localStorage, thông báo, kiểm tra form
│   └── icons.svg            Kho icon SVG
├── services/                Xử lý dữ liệu
│   ├── dataService.js       Nạp các file JSON, tìm sản phẩm và đánh giá
│   ├── accountService.js    Tài khoản: đăng ký, đăng nhập, đăng xuất, cập nhật hồ sơ, sổ địa chỉ
│   ├── cartService.js       Giỏ hàng, tính tiền, lưu đơn hàng
│   └── favoriteService.js   Sản phẩm yêu thích
├── modules/
│   └── ui.js                Phần chung mọi trang (header, menu, tìm kiếm, nhận tin) + banner, đồng hồ trang chủ
└── render/                  Giao diện từng trang
    ├── products.js          Thẻ sản phẩm, danh sách trang chủ, trang Sản phẩm (lọc, sắp xếp, phân trang)
    ├── detail.js            Trang chi tiết sản phẩm
    ├── cart.js              Trang giỏ hàng
    ├── checkout.js          Trang thanh toán và "Mua ngay"
    ├── profile.js           Trang tài khoản: hồ sơ, đơn hàng, sổ địa chỉ, yêu thích
    ├── auth.js              Đăng nhập, đăng ký
    └── contact.js           Trang liên hệ
```

Mọi trang HTML đều nạp `app.js`. Mỗi hàm khởi tạo tự kiểm tra trang hiện tại có phần tử nó cần hay không (`if (!element) return;`), nên cùng một `app.js` dùng được cho tất cả các trang.

---

## 3. Các tính năng chính
1. **Sản phẩm**: trang chủ có Flash sale, sản phẩm nổi bật, hàng mới và gợi ý theo loại; trang Sản phẩm tìm kiếm, lọc theo loại và khoảng giá, sắp xếp, phân trang (9 sản phẩm/trang); trang chi tiết có thư viện ảnh, chọn số lượng, tab mô tả, đánh giá, sản phẩm tương tự và sản phẩm đã xem gần đây.
2. **Giỏ hàng và tính tiền**: tính theo giá khuyến mãi, số lượng không vượt quá tồn kho. Phí giao hàng 30.000đ, đơn từ 500.000đ được miễn phí.
3. **Thanh toán**: kiểm tra form, chọn Tỉnh → Quận/Huyện, tự điền thông tin từ hồ sơ và địa chỉ mặc định. Nút "Mua ngay" ở trang chi tiết chỉ thanh toán sản phẩm đó và giữ nguyên giỏ hàng.
4. **Tài khoản**: đăng ký, đăng nhập, đăng xuất, sửa hồ sơ, sổ địa chỉ (tối đa 5 địa chỉ, luôn có 1 địa chỉ mặc định), lịch sử đơn hàng lọc theo trạng thái (lấy từ `order-statuses.json`), đặt lại đơn cũ, danh sách yêu thích.

## 4. Dữ liệu lưu trong localStorage

| Key | Nội dung |
| --- | --- |
| `lasen_cart` | Giỏ hàng: `[{ productId, quantity }]` |
| `lasen_order_list` | Các đơn đã đặt (đơn mới nhất đứng đầu) |
| `lasen_users` | Danh sách tài khoản (lần đầu lấy từ `users.json`) |
| `lasen_current_user` | Id tài khoản đang đăng nhập |
| `lasen_favorites_<id>` | Id các sản phẩm yêu thích của từng tài khoản |
| `lasen_addresses_<id>` | Sổ địa chỉ của từng tài khoản |
| `lasen_recent_products` | Id các sản phẩm đã xem gần đây |

Muốn chạy lại từ đầu: mở DevTools (F12) → **Application** → **Local Storage** → chuột phải → **Clear**.

## 5. Đăng ký và đăng nhập

- Mở `login.html` để đăng nhập, `register.html` để đăng ký.
- Tài khoản mẫu: **nguyenvana@gmail.com** / **password123** (lấy từ `js/data/users.json`). Tài khoản này có sẵn 4 đơn hàng mẫu (`sample-orders.json`) để minh họa khi chưa đặt đơn nào.
- Đăng ký yêu cầu họ tên, số điện thoại 10 số, email chưa sử dụng, mật khẩu tối thiểu 8 ký tự và nhập lại mật khẩu khớp. Đăng ký xong sẽ chuyển về trang đăng nhập.
- Đây là bản demo chạy trên máy (localhost): mật khẩu lưu nguyên văn trong localStorage và dữ liệu hiển thị bằng `innerHTML`. Website thật cần máy chủ để xác thực và bảo vệ dữ liệu.

## 6. Checklist đọc hiểu dự án

Đọc theo thứ tự các nhóm bên dưới. Khi đã hiểu một file, đổi `- [ ]` thành `- [x]` để đánh dấu. Chỉ tick khi bạn giải thích được vai trò của file, dữ liệu nó sử dụng và cách nó liên hệ với các file khác.

Luồng chính để theo dõi: **xem sản phẩm → thêm vào giỏ → thanh toán → xem đơn hàng trong hồ sơ**. Với mỗi trang, mở HTML và JavaScript tương ứng cạnh nhau để đối chiếu các thuộc tính `data-*`.

### 6.1. Tổng quan và điểm khởi động

- [ ] [README.md](README.md) — Hiểu cách chạy dự án và các chức năng chính; chạy thử một lượt mua hàng.
- [ ] [index.html](index.html) — Xem cấu trúc trang chủ, các vùng `data-list` và thẻ `<script type="module" src="js/app.js">`.
- [ ] [js/app.js](js/app.js) — Nắm cách nạp icon bằng `fetch` và thứ tự gọi các hàm khởi tạo.

### 6.2. Dữ liệu và các hàm dùng chung

- [ ] [js/data/products.json](js/data/products.json) — Hiểu cấu trúc một sản phẩm: `id`, giá, giá giảm, danh mục, loại da và tồn kho.
- [ ] [js/data/reviews.json](js/data/reviews.json) — Hiểu đánh giá được liên kết với sản phẩm qua `productId`.
- [ ] [js/data/users.json](js/data/users.json) — Hiểu dữ liệu tài khoản mẫu.
- [ ] [js/services/dataService.js](js/services/dataService.js) — Theo dõi việc nạp JSON và tra cứu bằng `getProductById()` / `getReviewsByProductId()`.
- [ ] [js/utils/helpers.js](js/utils/helpers.js) — Hiểu `formatPrice()`, `getPrice()`, `getStorage()` / `setStorage()`, `showToast()` và các hàm kiểm tra form.

### 6.3. Tài khoản

- [ ] [js/services/accountService.js](js/services/accountService.js) — Hiểu `getAccounts()`, `getCurrentUser()`, `login()`, `register()`, `updateProfile()`, `getUserKey()` và sổ địa chỉ.
- [ ] [login.html](login.html), [register.html](register.html), [js/render/auth.js](js/render/auth.js) — Theo dõi form đăng nhập/đăng ký, lỗi từng ô nhập và chuyển trang.

### 6.4. Danh sách và chi tiết sản phẩm

- [ ] [js/services/favoriteService.js](js/services/favoriteService.js) — Hiểu cách lưu, thêm và bỏ sản phẩm yêu thích.
- [ ] [products.html](products.html) — Xác định vùng danh sách, bộ lọc loại sản phẩm và khoảng giá, tìm kiếm, sắp xếp và phân trang.
- [ ] [js/render/products.js](js/render/products.js) — Bắt đầu từ `createProductCard()` và `renderProducts()`; sau đó đọc `filterProducts()` và `renderProductsPage()` cho trang Sản phẩm.
- [ ] [product-detail.html](product-detail.html) — Xác định thông tin sản phẩm, thư viện ảnh, ô số lượng, các tab và đánh giá.
- [ ] [js/render/detail.js](js/render/detail.js) — Bắt đầu từ `renderProductDetail()`; theo dõi lấy `id` từ URL, tra cứu sản phẩm, thêm giỏ và "Mua ngay".

### 6.5. Giỏ hàng và thanh toán

- [ ] [js/services/cartService.js](js/services/cartService.js) — Theo dõi `addToCart()` → `saveCart()`; hiểu giới hạn tồn kho, `getCartItems()`, `getCartTotals()` và `saveOrder()`.
- [ ] [cart.html](cart.html), [js/render/cart.js](js/render/cart.js) — Hiểu `showCart()` và cách xử lý nút tăng/giảm, xóa sản phẩm.
- [ ] [checkout.html](checkout.html), [js/render/checkout.js](js/render/checkout.js) — Bắt đầu từ `renderCheckout()`; theo dõi `validateForm()`, `createOrder()` và `showOrderSuccess()`.

### 6.6. Hồ sơ, lịch sử đơn hàng và sổ địa chỉ

- [ ] [js/data/order-statuses.json](js/data/order-statuses.json), [js/data/sample-orders.json](js/data/sample-orders.json) — Hiểu các trạng thái dùng để lọc và cấu trúc đơn mẫu.
- [ ] [profile.html](profile.html), [js/render/profile.js](js/render/profile.js) — Bắt đầu từ `renderProfile()`; đọc lần lượt `initTabs()`, `initProfileForm()`, `initAddressBook()` và `renderOrders()`.

### 6.7. Giao diện chung và các trang phụ

- [ ] [js/modules/ui.js](js/modules/ui.js) — Bắt đầu từ `initUI()`; hiểu header, menu mobile, gợi ý tìm kiếm, banner và đồng hồ đếm ngược.
- [ ] [contact.html](contact.html), [js/render/contact.js](js/render/contact.js) — Hiểu mở/gập câu hỏi và kiểm tra form liên hệ.
- [ ] [about.html](about.html) — Hiểu cấu trúc trang giới thiệu và các thành phần dùng chung.

### 6.8. CSS và icon — đọc sau khi nắm luồng JavaScript

- [ ] [js/utils/icons.svg](js/utils/icons.svg) — Hiểu các `<symbol>` được sử dụng qua `<use href="#i-...">`.
- [ ] [css/base.css](css/base.css) — Nắm các quy tắc CSS nền tảng.
- [ ] [css/components.css](css/components.css) — Nắm kiểu của các thành phần giao diện dùng chung.
- [ ] [css/pages/](css/pages/) — Bố cục riêng của từng trang.
