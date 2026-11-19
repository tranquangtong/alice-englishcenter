# Alice English Center

Không gian học tập và mentoring tiếng Anh (IELTS/TOEIC) dành cho đồng nghiệp và học viên. Giao diện tiếng Việt; tài liệu hiện tập trung vào IELTS và sẽ bổ sung TOEIC dần.

Website tĩnh dùng HTML/CSS/JavaScript, không có build step hay npm dependencies. Markdown được tải phía trình duyệt, render bằng marked 12.0.2 và sanitize bằng DOMPurify 3.1.6 từ CDN jsDelivr. Cần kết nối Internet để tải hai thư viện này.

## Chạy trên máy

Từ thư mục dự án:

```sh
python3 -m http.server 8000
```

Mở http://localhost:8000. Chạy qua HTTP để trình duyệt tải được Markdown; mở trực tiếp `index.html` bằng `file://` sẽ không hoạt động đầy đủ.

Kiểm tra bằng Node.js ≥ 20, không cần cài package:

```sh
node scripts/check.mjs
node --check assets/js/app.js
```

Khi sửa CSS, chỉnh `assets/css/style.css` hoặc `assets/css/listening.css`, rồi chạy
`node scripts/build-css.mjs` (hoặc `npm run css`) để tạo lại các file `.min.css`
mà `index.html` tải. Commit cả nguồn dễ đọc và file sinh ra; không sửa trực tiếp
file `.min.css`. Script không cần cài package. GitHub Pages dùng các file đã tạo
sẵn, không cần chạy build khi triển khai. `node scripts/check.mjs` kiểm tra file
sinh ra có khớp nguồn và báo tổng byte CSS được tải.

Trước khi commit thay đổi trong `index.html`, `assets/` hoặc `content/`, tăng
`?v=` trong `index.html` cho các tệp CSS/JavaScript đã sửa, tạo lại CSS nếu cần,
rồi chạy `node scripts/build-version.mjs` và `node scripts/check.mjs`. Commit cả
`version.json` và mã phiên bản mà script cập nhật trong `index.html`. Mã này dùng
SHA-256 từ đường dẫn và nội dung của các tệp trong ba vị trí trên, bỏ trống thẻ
mã phiên bản khi tính hash và chuẩn hóa xuống dòng CRLF của các định dạng văn bản
web. Trình duyệt dùng mã này để báo khi có nội dung mới.

Bộ kiểm tra xác thực manifest, file nội dung, liên kết tương đối trong Markdown/HTML và cú pháp JavaScript. File syllabus/roadmap chưa xuất bản được báo `WARNING`; các lỗi khác khiến lệnh trả về exit code 1. Bộ kiểm tra không truy cập liên kết Internet hoặc xác thực fragment/anchor trong tài liệu.

## Triển khai GitHub Pages

1. Đưa các file lên nhánh `main` của repository trên GitHub.
2. Vào **Settings > Pages**.
3. Chọn **Source: Deploy from a branch**.
4. Chọn nhánh **main**, thư mục **/ (root)**, rồi **Save**.
5. Khi triển khai xong, mở URL GitHub Pages hiển thị trong phần Pages.

Giữ file `.nojekyll` ở root. Tất cả tài nguyên dùng đường dẫn tương đối nên chạy được dưới đường dẫn `/<repo>/`. Không cần workflow build. GitHub Pages là nơi xuất bản nội dung công khai: chỉ đưa tài liệu được phép chia sẻ lên website.

## Cấu trúc dự án

- `index.html`: khung trang, landmarks và thư viện CDN.
- `assets/css/style.css`: responsive layout, giao diện Hệ thống/Sáng/Tối, style in trang.
- `assets/js/app.js`: hash routing `#/id`, tải và sanitize Markdown, mục lục h2/h3, chuyển liên kết nội bộ.
- `content/manifest.json`: danh mục `{id, title, group, path}`; thứ tự trong file quyết định thứ tự điều hướng.
- `content/home.md`: lời giới thiệu.
- `content/syllabus/`: các đề cương kỹ năng do nhóm nội dung bổ sung.
- `docs/roadmap-teacher-student.md` là lộ trình phát triển nội bộ, không hiển thị trong menu trang học.
- `docs/`: tài liệu tham khảo, bao gồm [cấu trúc đề thi](docs/exam-structure.md).
- `scripts/check.mjs`: kiểm tra cục bộ không cần dependencies.

## Thêm tài liệu

Tạo file Markdown và thêm một entry có `id` duy nhất vào manifest. Viết liên kết `.md` tương đối từ file nội dung; nếu file đích nằm trong manifest, ứng dụng tự chuyển thành SPA route. Ảnh tương đối cũng được tính từ file Markdown. Link mục lục có dạng `#/id?section=ten-de-muc` để có thể chia sẻ trực tiếp.

Khi tài liệu trong manifest trả về HTTP 404, trang hiển thị **Đang soạn**. Các lỗi tải khác hiển thị hướng dẫn thử lại. Đây là website tài liệu tĩnh; chức năng tài khoản và vai trò Teacher–Student thuộc lộ trình tương lai.

## Design

Giao diện tuân theo design gene **Frutiger Aero** — bắt buộc cho mọi thay đổi UI sau này. Xem [docs/design-system.md](docs/design-system.md).
