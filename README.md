# Store Hub Admin — React

Web quản trị tiếng Việt xây dựng trực tiếp từ FeTest (React 19 + Vite 8), kết nối các route Express trong store-hub-server(1).zip. Không kết nối MongoDB trực tiếp từ trình duyệt. Không cần sửa BE để dùng các chức năng đã nối API.

## Chạy trên máy của bạn

Cài Node.js 22.12+ (hoặc 24 LTS). Mở terminal trong thư mục FeTest chứa package.json:

```bash
npm ci
```

Sao chép `.env.example` thành `.env`. Trên Windows CMD:

```bat
copy .env.example .env
```

Trên macOS/Linux: `cp .env.example .env`.

Nếu BE chạy trên máy bạn, giữ:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

Nếu BE đã deploy, thay bằng URL gốc HTTPS thực tế của BE. Không thêm `/api`, `/users` hoặc đường dẫn router vào biến này. Không đưa MongoDB URI, JWT_SECRET, mật khẩu Atlas hoặc khóa Cloudinary vào FE. Tất cả biến VITE_ đều được đóng gói công khai vào JavaScript.

```bash
npm run dev
```

Mở địa chỉ Vite hiển thị (thường là http://localhost:5173). Đăng nhập bằng email/mật khẩu của tài khoản `admin` hoặc `superadmin` đã có trong database. Không có tài khoản mặc định hoặc tài khoản đăng nhập mẫu. Tài khoản đăng ký thông thường có role customer sẽ bị chặn khỏi giao diện quản trị.

Nếu chạy BE local, thực hiện cấu hình và khởi động BE riêng theo dự án của bạn; Atlas tiếp tục là database của BE. File zip này chỉ bao gồm FE.

## Chức năng

- Đăng nhập email/mật khẩu, JWT Bearer, đăng xuất, xử lý phiên hết hạn. Phiên lưu trong sessionStorage theo tab.
- Tổng quan: số đơn, sản phẩm, tài khoản, doanh số đã giao/hoàn thành; biểu đồ giá trị đơn hàng, sản phẩm bán nhiều.
- Sản phẩm: tìm kiếm toàn bộ dữ liệu qua BE, lọc danh mục, phân trang, thêm/sửa, ảnh upload Cloudinary qua BE, giá, tồn kho, ngừng bán, màu sắc và màu mặc định. Xóa chỉ hiện cho superadmin theo BE.
- Danh mục: thêm, sửa, tải ảnh, xóa (BE chặn nếu danh mục còn sản phẩm).
- Đơn hàng: phân trang, tìm trong trang hiện tại, chi tiết người nhận/sản phẩm/thanh toán, cập nhật trạng thái đúng quy trình BE, xác nhận riêng trước khi cập nhật hoặc hủy.
- Người dùng: tìm kiếm qua BE, phân loại khách hàng/nhân viên, phân trang, thêm/sửa, đổi role chỉ hiển thị cho superadmin, xóa theo quyền BE.
- Tin tức: xem cả bản nháp/đã xuất bản/ẩn, lọc trạng thái, phân trang, tìm tiêu đề trong trang, thêm/sửa/xóa, upload ảnh.
- Hồ sơ cá nhân: sửa tên/SĐT/địa chỉ/avatar, đổi mật khẩu.
- Bố cục responsive, sidebar di động, thông báo lỗi/thành công, trạng thái tải/rỗng, hộp thoại hỗ trợ bàn phím.

## API đã tích hợp

Tất cả đường dẫn bên dưới có tiền tố `/api`.

| Mục | Router và endpoint |
| --- | --- |
| Đăng nhập/đăng xuất | POST /usersRouter/login; POST /usersRouter/logout |
| Thống kê | GET /usersRouter/admin/dashboard; GET /usersRouter/admin/revenue-stats |
| Sản phẩm | GET /productsRouter/search-product; POST /productsRouter/add-product; PUT /productsRouter/update-product/:id; DELETE /productsRouter/delete-product/:id |
| Danh mục | GET /productsRouter/get-categories; POST /productsRouter/add-category; PUT /productsRouter/update-category/:id; DELETE /productsRouter/delete-category/:id |
| Đơn hàng | GET /oderRouter/admin/orders; GET /oderRouter/admin/orders/:id; PUT /oderRouter/admin/orders/:id/status |
| Người dùng | GET /usersRouter/get-all-users; POST /usersRouter/add-user; PUT /usersRouter/update-user/:id; DELETE /usersRouter/delete-user/:id |
| Tin tức | GET /newsRouter/admin/get-all-news; POST /newsRouter/admin/add-news; PUT /newsRouter/admin/update-news/:id; DELETE /newsRouter/admin/delete-news/:id |
| Hồ sơ | PUT /usersRouter/update-profile; PUT /usersRouter/change-password |

Tên `oderRouter` được giữ đúng như BE, không phải lỗi đánh máy trong FE. File ảnh được gửi qua FormData với field `image`; trình duyệt tự tạo multipart boundary.

## Các giới hạn quan sát trực tiếp trong BE

1. `get-categories` chỉ trả danh mục isActive=true. FE không cung cấp nút tắt danh mục, vì BE chưa có endpoint liệt kê lại danh mục đã tắt.
2. API đơn hàng không nhận bộ lọc tìm kiếm/trạng thái. Tìm kiếm đơn hàng trên FE chỉ áp dụng trang đang xem (được ghi trên ô tìm). Tin tức cũng tìm tiêu đề trong trang vì admin endpoint chưa hỗ trợ keyword.
3. API người dùng và tin tức không trả tổng số trang. Nút Sau dựa trên số lượng trả về; có thể tới một trang trống khi tổng bản ghi chia hết cho 10, và có thể quay lại bằng Trước.
4. Dashboard totalSales cộng totalPrice của đơn đã giao/hoàn thành. Revenue-stats cộng totalAmount của các đơn không hủy, gồm cả đơn chưa hoàn thành. FE ghi rõ hai ý nghĩa, không gọi tất cả là doanh thu đã thu. Không hiển thị phần trăm tăng trưởng giả định +15% hardcode trong BE.
5. Báo cáo tháng cộng gộp theo thứ trong tuần, không phải từng ngày. Chế độ năm trong BE hardcode 2026 nên giao diện ghi rõ Năm 2026.
6. API đơn hàng và tin tức chỉ cho role admin/superadmin, trong khi một số API khác chấp nhận tên role tiếng Việt. FE giải thích khi role cũ không được các mục này hỗ trợ.
7. BE update-user/add-user chưa giới hạn chặt thao tác gán role theo cấp quản trị. FE chỉ cho superadmin chọn role, nhưng cần bổ sung kiểm tra ở BE trước khi triển khai production; ẩn lựa chọn trên FE không phải ranh giới bảo mật.
8. Hủy đơn gọi logic hoàn tồn kho/hoàn tiền hiện có ở BE. FE không tự xử lý thanh toán và không thể xác minh hoàn tiền thành công ngoài phản hồi BE.

Không sửa BE, không chạy migration/seed, không thay đổi Atlas trong quá trình xây dựng FE. Chưa triển khai các mục chưa nối giao diện như phản hồi đánh giá, nhật ký hoạt động hoặc sửa số lượng trong đơn.

## Cấu trúc

```text
src/
  api.js                 # base URL, HTTP, session, định dạng và quy tắc trạng thái
  hooks.js               # tải dữ liệu, hủy request, retry
  App.jsx                # đăng nhập, layout, điều hướng hash
  components/UI.jsx      # bảng điều khiển, modal, input, ảnh, icon, phân trang
  pages/Dashboard.jsx
  pages/Catalog.jsx       # sản phẩm, danh mục, người dùng, tin tức
  pages/Orders.jsx
  pages/Settings.jsx
  index.css
```

Điều hướng hash giúp host tĩnh không cần cấu hình rewrite cho các trang con. CSS thuần và SVG icon nội bộ, không phụ thuộc CDN.

## Kiểm tra và đóng gói

```bash
npm run lint
npm test
npm run build
npm run preview
```

Đã chạy thành công lint, production build và 6 bài kiểm tra tự động về role, quy tắc trạng thái, query, multipart/JWT và xử lý lỗi. Đã kiểm thử trình duyệt: đăng nhập/đăng xuất, điều hướng các trang, sửa sản phẩm multipart, yêu cầu ảnh khi thêm mới, hủy thao tác xóa, chuyển trạng thái đơn, hiển thị lỗi/thử lại và bố cục điện thoại 390px. Các kiểm thử dùng phản hồi API giả lập theo mã BE, không phải kiểm thử trực tiếp với Atlas. Không có lỗi JavaScript runtime trong các luồng đã kiểm tra. Cần thử trên BE của bạn: đăng nhập thật, upload ảnh Cloudinary, thêm/sửa dữ liệu và cập nhật đơn thử nghiệm.

Thư mục `dist/` được sinh khi build. Nếu triển khai FE lên host tĩnh: build command `npm run build`, output directory `dist`, đặt biến `VITE_API_BASE_URL` trước build. FE HTTPS cần BE HTTPS. Mỗi lần đổi URL cần build/deploy lại.

## Xử lý lỗi kết nối

- Không kết nối được BE: kiểm tra URL, BE có hoạt động không, CORS; với BE local phải khởi động BE riêng.
- BE trả HTML/404: URL phải là URL gốc BE, không thêm `/api` vào biến môi trường.
- 403 quyền truy cập: kiểm tra role thực tế; token cũ chứa role cũ nên cần đăng xuất/đăng nhập lại sau khi đổi role.
- Upload thất bại: ảnh PNG/JPG/JPEG/WEBP/GIF tối đa 5 MB và BE phải có cấu hình Cloudinary hợp lệ.
- BE chạy nhưng không tải được dữ liệu: kiểm tra kết nối Atlas và biến môi trường ở BE.
