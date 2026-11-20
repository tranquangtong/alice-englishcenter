# Handoff — Alice English Center

Tài liệu bàn giao nhanh để tiếp tục dự án trên macOS trong phiên Claude Code mới.

## 1. Trạng thái hiện tại (2026-11-19)

- **Repo & deploy:** nhánh `main` tại commit `65021da`, live tại <https://tranquangtong.github.io/alice-englishcenter/> (site tĩnh HTML/CSS/JS, không build step khi deploy).
- **IELTS GT Listening:** 4 đề hoàn chỉnh (`gt-l-01`..`gt-l-04`, tự biên soạn trong `content/ielts-gt/listening/index.json`), audio MP3 tạo bằng `msedge-tts` (`npm run audio`), hỗ trợ chế độ **Luyện tập** & **Thi thử**, chấm điểm/Band, transcript nổi bật dẫn chứng và danh sách nguồn luyện ngoài.
- **UI & a11y:** đã sửa tương phản badge trên bản đồ SVG (≥ 6.5:1); nút `IELTS General` gọn trên header; sidebar riêng cho các route `#/ielts-gt`; bộ chuyển giao diện **Hệ thống / Sáng / Tối** góc trên phải.
- **CSS minification & budget:** minify qua `scripts/build-css.mjs`, budget đã nâng lên `<60 KB` raw / `<15 KB` gzip theo duyệt của chủ dự án (hiện `59.0 KB` raw — gần chạm trần).
- **Thông báo cập nhật & tài liệu nội bộ:** toast ở đáy trang poll `version.json` mỗi 5 phút và khi quay lại tab (có biến thể cảnh báo khi đang thi thử); lộ trình Teacher–Student đã chuyển sang [docs/roadmap-teacher-student.md](roadmap-teacher-student.md) (nội bộ, không hiện trên site).
- **Kiểm thử gần nhất:** `node --test` đạt **38/38 pass**, `node scripts/check.mjs` báo **0 errors**.

## 2. Setup trên macOS

1. Yêu cầu **Node.js ≥ 20** và **Git**, sau đó clone và cài devDependencies (chỉ dùng cho test E2E và tạo audio):
   ```sh
   git clone https://github.com/tranquangtong/alice-englishcenter.git
   cd alice-englishcenter
   npm ci
   ```
   `devDependencies` gồm: `playwright-core`, `ffmpeg-static`, `msedge-tts`, `marked`, `dompurify`. (`ffmpeg-static` tự cấp binary `ffmpeg` cho `scripts/build-listening-audio.mjs`, không cần cài `ffmpeg` ngoài.)
2. Chạy server cục bộ (mở `http://localhost:8000`):
   ```sh
   python3 -m http.server 8000
   # hoặc: npx serve
   ```
3. **Trình duyệt cho E2E test.** Dùng `npm run test:chrome` với Google Chrome và `npm run test:webkit` với WebKit (engine của Safari). Nếu chưa có WebKit, chạy `npx playwright-core install webkit`. Lệnh `node --test` mặc định dùng Microsoft Edge.

## 3. Quy trình bắt buộc trước mỗi commit

1. Chỉ sửa CSS nguồn (`assets/css/style.css`, `assets/css/listening.css`), **không sửa trực tiếp** `*.min.css`. Nếu đổi CSS/JS, tăng tham số `?v=` tương ứng trong `index.html`.
2. Build lại CSS minified, cập nhật hash phiên bản và chạy đủ kiểm tra:
   ```sh
   node scripts/build-css.mjs
   node scripts/build-version.mjs
   node scripts/check.mjs
   npm run test:chrome
   npm run test:webkit
   ```
   - Ảnh chụp và số đo E2E nằm trong `test-artifacts/<suite>/<engine>/`.
   - `scripts/check.mjs` sẽ **fail** nếu `*.min.css` hoặc `version.json` / `<meta name="aec-version">` bị cũ, thiếu, hoặc tổng CSS vượt budget (`<60 KB` raw / `<15 KB` gzip).
3. Push lên `main` → GitHub Pages tự động deploy từ nhánh `main` / root (`.nojekyll`).

## 4. Multi-agent collab

- Quy tắc dự án nằm trong [collab.md](../collab.md):
  - **Lead không tự implement** (kể cả sửa một dòng).
  - **codex:** JS, scripts, tests, build/CI, review mọi diff trước khi merge.
  - **agy:** UI/HTML/CSS, nội dung tiếng Anh, tài liệu.
  - **Design gene bắt buộc:** **Frutiger Aero** ([docs/design-system.md](design-system.md)) — mọi thay đổi UI phải tuân thủ và qua checklist.
- **Khác biệt Windows vs macOS:**
  - Bridge `~/.ai-bridge` (`ask-codex`, `ask-agy`, `~/.ai-bridge/config` — trên Windows đặt `AI_BRIDGE_DATA=/d/ai-bridge`) cần cài và cấu hình riêng trên Mac.
  - Ghi chú Windows trong `collab.md` (không có Python, headless Edge `--no-sandbox`) không áp dụng giống hệt trên Mac (`python3` có sẵn, dùng Edge/Chrome bản macOS).
- **Bản quyền:** tuyệt đối không xuất bản nguyên văn nội dung đề từ `ielts.app` (chỉ tham khảo cấu trúc, tự viết đề mới).

## 5. Việc còn mở / gợi ý tiếp theo

- **Gộp/tối ưu CSS trước khi thêm UI mới:** tổng CSS minified đã `59.0 KB / 60 KB` raw.
- **Bảo mật devDependencies:** `npm audit` đang báo **1 moderate vulnerability** (chưa triage).
- **3 kỹ năng IELTS GT còn lại:** Reading, Writing, Speaking hiện đánh dấu `Sắp ra mắt` (chưa triển khai).
- **Nền tảng Teacher–Student:** giai đoạn 1–3 dùng Supabase (Auth/Postgres/Storage + RLS) theo [docs/roadmap-teacher-student.md](roadmap-teacher-student.md).
- **Dọn máy Windows:** còn các bridge worktree cũ trên máy Windows — nhớ chạy `/collab-clean` khi quay lại máy đó.

## 6. Câu mở đầu gợi ý cho phiên Claude mới trên Mac

```text
Đọc docs/HANDOFF.md, collab.md và docs/design-system.md trước khi bắt đầu. Xác nhận trạng thái hiện tại, kiểm tra môi trường macOS (Node, npm test, check.mjs, ~/.ai-bridge nếu có) rồi chờ mình chọn việc tiếp theo.
```
