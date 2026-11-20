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

Sau khi chạy `npm ci`, dùng `npm run test:chrome` với Google Chrome hoặc `npm run test:webkit` với WebKit (engine của Safari). Cài WebKit bằng `npx playwright-core install webkit` nếu máy chưa có.
Lệnh `node --test` mặc định dùng Microsoft Edge cho E2E.

Khi sửa CSS, chỉnh `assets/css/style.css`, `assets/css/listening.css` hoặc `assets/css/practice.css`, rồi chạy
`node scripts/build-css.mjs` (hoặc `npm run css`) để tạo lại các file `.min.css`
mà website tải. Commit cả nguồn dễ đọc và file sinh ra; không sửa trực tiếp
file `.min.css`. Script không cần cài package. GitHub Pages dùng các file đã tạo
sẵn, không cần chạy build khi triển khai. `node scripts/check.mjs` kiểm tra file
sinh ra có khớp nguồn và báo tổng byte CSS theo tuyến. Các trang cơ bản tải
`style.min.css` và `listening.min.css`, với giới hạn dưới 60.000 byte raw và
15.000 byte gzip. Trang luyện kỹ năng tải thêm `practice.min.css`, với tổng dưới
72.000 byte raw và 18.000 byte gzip. Gzip được tính riêng cho từng tệp.

Trước khi commit thay đổi trong `index.html`, `assets/` hoặc `content/`, tăng
`?v=` trong `index.html` cho các tệp CSS/JavaScript đã sửa, tạo lại CSS nếu cần,
rồi chạy `node scripts/build-version.mjs` và `node scripts/check.mjs`. Commit cả
`version.json` và mã phiên bản mà script cập nhật trong `index.html`. Mã này dùng
SHA-256 từ đường dẫn và nội dung của các tệp trong ba vị trí trên, bỏ trống thẻ
mã phiên bản khi tính hash và chuẩn hóa xuống dòng CRLF của các định dạng văn bản
web. Trình duyệt dùng mã này để báo khi có nội dung mới.

Bộ kiểm tra xác thực manifest, file nội dung, liên kết tương đối trong Markdown/HTML và cú pháp JavaScript. File syllabus/roadmap chưa xuất bản được báo `WARNING`; các lỗi khác khiến lệnh trả về exit code 1. Bộ kiểm tra không truy cập liên kết Internet hoặc xác thực fragment/anchor trong tài liệu.

## Luyện kỹ năng IELTS GT Listening

Bốn nhóm bài luyện có trang giới thiệu và bài tập riêng trong danh mục Listening.
Tiến độ từng bài được lưu trong trình duyệt. Xem [schema bài luyện](docs/listening-methods-schema.md)
để thêm bài và dùng `npm run audio:methods` để tạo audio từ kịch bản gốc.

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
- [docs/HANDOFF.md](docs/HANDOFF.md): tài liệu bàn giao dự án (trạng thái hiện tại, setup macOS, quy trình commit và việc còn mở).
- `scripts/check.mjs`: kiểm tra cục bộ không cần dependencies.

## Thêm tài liệu

Tạo file Markdown và thêm một entry có `id` duy nhất vào manifest. Viết liên kết `.md` tương đối từ file nội dung; nếu file đích nằm trong manifest, ứng dụng tự chuyển thành SPA route. Ảnh tương đối cũng được tính từ file Markdown. Link mục lục có dạng `#/id?section=ten-de-muc` để có thể chia sẻ trực tiếp.

Khi tài liệu trong manifest trả về HTTP 404, trang hiển thị **Đang soạn**. Các lỗi tải khác hiển thị hướng dẫn thử lại. Đây là website tài liệu tĩnh; chức năng tài khoản và vai trò Teacher–Student thuộc lộ trình tương lai.

## Design

Giao diện tuân theo design gene **Frutiger Aero** — bắt buộc cho mọi thay đổi UI sau này. Xem [docs/design-system.md](docs/design-system.md).

## CREDITS

Bài chép câu dùng bản ghi MP3 nguyên gốc và văn bản từ [Tatoeba](https://tatoeba.org/en/downloads).

| Câu | Audio | Người đọc | Giấy phép audio | Người đóng góp và giấy phép văn bản |
| --- | --- | --- | --- | --- |
| [#22449](https://tatoeba.org/en/sentences/show/22449) | [1037020](https://tatoeba.org/audio/download/1037020) | [Auride](https://tatoeba.org/en/user/profile/Auride) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Auride · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#22813](https://tatoeba.org/en/sentences/show/22813) | [1037024](https://tatoeba.org/audio/download/1037024) | [Auride](https://tatoeba.org/en/user/profile/Auride) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Auride · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#22863](https://tatoeba.org/en/sentences/show/22863) | [942490](https://tatoeba.org/audio/download/942490) | [Auride](https://tatoeba.org/en/user/profile/Auride) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | CK · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#23383](https://tatoeba.org/en/sentences/show/23383) | [942491](https://tatoeba.org/audio/download/942491) | [Auride](https://tatoeba.org/en/user/profile/Auride) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | CK · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#35384](https://tatoeba.org/en/sentences/show/35384) | [951110](https://tatoeba.org/audio/download/951110) | [Auride](https://tatoeba.org/en/user/profile/Auride) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | CM · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#37351](https://tatoeba.org/en/sentences/show/37351) | [1285222](https://tatoeba.org/audio/download/1285222) | [rul](https://tatoeba.org/en/user/profile/rul) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | shekitten · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#57106](https://tatoeba.org/en/sentences/show/57106) | [956177](https://tatoeba.org/audio/download/956177) | [Auride](https://tatoeba.org/en/user/profile/Auride) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | CM · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#66110](https://tatoeba.org/en/sentences/show/66110) | [1152910](https://tatoeba.org/audio/download/1152910) | [Them](https://tatoeba.org/en/user/profile/Them) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | CK · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#247383](https://tatoeba.org/en/sentences/show/247383) | [956240](https://tatoeba.org/audio/download/956240) | [Auride](https://tatoeba.org/en/user/profile/Auride) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | CM · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#249940](https://tatoeba.org/en/sentences/show/249940) | [1247324](https://tatoeba.org/audio/download/1247324) | [rul](https://tatoeba.org/en/user/profile/rul) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | rul · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#259617](https://tatoeba.org/en/sentences/show/259617) | [1041093](https://tatoeba.org/audio/download/1041093) | [Auride](https://tatoeba.org/en/user/profile/Auride) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Auride · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#1299110](https://tatoeba.org/en/sentences/show/1299110) | [1121361](https://tatoeba.org/audio/download/1121361) | [Them](https://tatoeba.org/en/user/profile/Them) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | rahim · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#12658241](https://tatoeba.org/en/sentences/show/12658241) | [1247289](https://tatoeba.org/audio/download/1247289) | [rul](https://tatoeba.org/en/user/profile/rul) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | rul · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#10696223](https://tatoeba.org/en/sentences/show/10696223) | [1114134](https://tatoeba.org/audio/download/1114134) | [Them](https://tatoeba.org/en/user/profile/Them) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | tokzyk · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| [#11180924](https://tatoeba.org/en/sentences/show/11180924) | [1115394](https://tatoeba.org/audio/download/1115394) | [Them](https://tatoeba.org/en/user/profile/Them) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | DJ_Saidez · [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
