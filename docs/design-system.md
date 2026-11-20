# Design system — "Frutiger Aero" gene (BẮT BUỘC)

> **Quy tắc:** mọi thay đổi UI của dự án này (làm mới giao diện, thêm trang, thêm tính năng như
> đăng nhập, dashboard teacher/student, quiz, nộp bài…) **phải tuân theo design gene Frutiger Aero**
> trong file này. Muốn đổi gene → phải được chủ dự án đồng ý và cập nhật file này trước.

## 1. Tinh thần (gene)

Frutiger Aero là thẩm mỹ công nghệ khoảng 2004–2013 (Windows Vista/7 "Aero", Wii, iOS đời đầu, Skype):
**lạc quan, trong trẻo, thiên nhiên + công nghệ sạch**. Năm gene không được mất:

1. **Trời & nước:** nền xanh da trời → trắng, nước, bong bóng, mây, ánh sáng mặt trời (lens flare nhẹ).
2. **Thiên nhiên tươi:** xanh lá cỏ non / xanh ngọc làm màu nhấn (cỏ, lá, aurora).
3. **Kính bóng (glossy glass):** bề mặt mờ trong (translucent), viền trắng sáng, highlight bóng phía trên,
   đổ bóng mềm — giống kính Aero.
4. **Bo tròn & mềm:** góc tròn lớn, nút "viên kẹo" (pill / gel button) có gradient và vệt sáng.
5. **Chữ sạch, thân thiện:** sans-serif hiện đại, rõ ràng — **Inter** cho chữ thân bài/giao diện,
   **Noto Sans** cho tiêu đề (h1–h6, tên thương hiệu); cả hai hỗ trợ đầy đủ tiếng Việt.

Tránh: flat design phẳng lì, màu xám buồn, brutalism, neon cyberpunk, góc vuông sắc, nền đen tuyền
ở chế độ sáng.

## 2. Design tokens (nguồn sự thật: `:root` trong `assets/css/style.css`)

| Nhóm | Token | Giá trị gợi ý (light) | Ghi chú |
|---|---|---|---|
| Nền trời | `--sky-top` / `--sky-bottom` | `#4fb3ef` → `#eaf7ff` | gradient nền trang |
| Nước / chính | `--aqua` | `#1593d6` | link, nút chính, trạng thái active |
| Cỏ / nhấn | `--grass` | `#45b649` (đậm cho chữ: `#237a2b`) | tiến bộ, thành công, badge |
| Kính | `--glass` / `--glass-strong` | `rgb(255 255 255 / .55)` / `/ .78` | panel, card, sidebar |
| Viền kính | `--glass-edge` | `rgb(255 255 255 / .85)` | viền 1px + inner highlight |
| Chữ | `--ink` / `--ink-soft` | `#0b2a3c` / `#3d5b6c` | luôn đạt tương phản AA trên kính |
| Bóng | `--shadow-soft` | `0 8px 24px rgb(0 60 110 / .18)` | đổ bóng mềm, ám xanh |
| Bo góc | `--radius-s/m/l` | `10px / 18px / 28px` | pill = `999px` |
| Chữ thân bài | `--font` | `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif` | body, nav, bảng, nút |
| Chữ tiêu đề | `--font-heading` | `"Noto Sans", "Inter", system-ui, sans-serif` | h1–h6 (bài viết, tiêu đề sidebar/TOC), tên thương hiệu |

**Dark mode = "Aero ban đêm":** trời đêm xanh navy → teal (`#06223a` → `#0b4a63`), kính tối
(`rgb(10 40 60 / .55)`), chữ `#e8f6ff`, aqua sáng hơn (`#5cc8ff`), cỏ sáng (`#7ee07f`), có aurora mờ.

## 3. Thành phần (component) chuẩn

- **Glass panel/card:** nền `--glass` + `backdrop-filter: blur(14px) saturate(160%)`, viền 1px
  `--glass-edge`, `inset 0 1px 0 rgb(255 255 255 / .9)` (vệt sáng trên), `--shadow-soft`, bo `--radius-l`.
  Luôn có **fallback** khi trình duyệt không hỗ trợ `backdrop-filter` (dùng `--glass-strong`).
- **Gel button / pill:** gradient dọc aqua (sáng trên, đậm dưới), nửa trên có lớp bóng trắng
  (`::before`), bo pill, hover sáng hơn + nhấc nhẹ, active lún xuống.
- **Nav item active:** dạng pill kính có vệt sáng, chữ aqua đậm.
- **Header:** dải kính lỏng (*liquid glass*) nổi dạng pill — `blur` `2–3px` (hiện `2.5px`) + `saturate(125%)`
  (không tăng `brightness`), phủ tint trung tính dịu nhẹ để dải kính vẫn trong; kèm lớp **text scrim cục bộ**
  mềm (`--glass-scrim`, ~40% trắng ở light / xanh navy đậm ở dark, tỏa mượt về trong suốt bằng `radial-gradient`)
  chỉ đặt sau cụm thương hiệu và cụm nút điều khiển để chữ/nút luôn dễ đọc khi nội dung cuộn qua. Tạo chất
  kính bằng viền sáng 1px, vệt specular đỉnh, hiệu ứng uốn/đổ bóng cạnh trái-phải và bóng ngoài mềm (fallback
  `--glass-strong` khi thiếu `backdrop-filter` / `prefers-reduced-transparency`); logo giọt nước bóng.
- **Bảng:** khung kính, hàng tiêu đề gradient aqua nhạt, sọc ngựa vằn rất nhẹ. Ưu tiên đọc **không cuộn
  ngang**: `table-layout: auto`, ô tự xuống dòng, bảng nhiều cột (≥ 5) chữ/padding gọn hơn. Khi vùng
  nội dung hẹp (≤ 42rem, tức màn hình ~720px; bảng ≥ 7 cột từ ≤ 50rem) → **dạng thẻ xếp chồng**: mỗi
  hàng là một thẻ kính, mỗi ô hiện nhãn cột (`td[data-label]` do `app.js` gán), `thead` ẩn bằng mắt
  nhưng vẫn đọc được bằng trình đọc màn hình. Cuộn ngang `.table-scroll` chỉ là phương án cuối.
- **Blockquote / callout:** khung kính viền trái màu cỏ hoặc aqua, icon giọt nước/lá (SVG inline).
- **Trang trí:** bong bóng, mây, sóng, aurora bằng CSS gradient / SVG inline; **chỉ ở nền**, không
  chồng lên chữ, `pointer-events: none`, `aria-hidden="true"`.

### Listening test player (`assets/css/listening.css`)

- **Menu IELTS General (`.top-menu*`):** nút disclosure dùng `.aero-btn` đặt cạnh thương hiệu; bảng thả
  xuống `.top-menu__panel` là glass panel có icon kỹ năng, mục sắp ra mắt dịu màu (vẫn đạt AA). Trên
  màn hình hẹp (≤ 600px), header giữ **một hàng gọn** (`--header-offset` không tăng): nút menu rút gọn
  nhãn/icon nhưng giữ nguyên tên truy cập (accessible name).
- **Hub & Danh sách đề (`.gt-hub`, `.lt-list`, `.lt-card`):** lưới 2 cột đáp ứng; thẻ Listening nổi
  bật bằng glass sheen + pill cỏ, các kỹ năng `Sắp ra mắt` (`.gt-skill--soon`) viền nét đứt, không
  nhấc khi hover. Mỗi thẻ đề có 2 nút gel (Luyện tập aqua · Thi thử hổ phách ấm `--lt-exam-*`); khối
  liên kết ngoài chia 2 cột gọn kèm dấu `↗` và ghi chú bản quyền.
- **Trình phát & Bài làm (`.lt-*`):** thanh audio `.lt-audio` dạng glass dính dưới header
  (`top: var(--header-offset)`), nút phát chính là gel aqua, nút tua nhanh dùng glass phụ để phân cấp,
  slider giọt nước và đồng hồ `tabular-nums`. Chế độ luyện tập (`.lt-mode--practice`) mang sắc aqua;
  chế độ thi thử (`.lt-mode--exam`, `.lt-timer`) dùng nhóm token hổ phách ấm `--lt-amber-*` (đủ tương
  phản AA cả light/dark). Tab chọn Part (`.lt-tabs`) là segmented glass control; nhóm câu hỏi
  (`.lt-group`) là glass sub-panel; ô điền `.lt-gap` nội tuyến, lựa chọn `.lt-option` ≥ 44px, sơ đồ
  `.lt-map` đóng khung trên nền giấy sáng `--lt-map-bg` để đọc rõ cả dark mode.
- **Kết quả & Transcript (`.lt-result`, `.lt-feedback`, `.lt-transcript`):** thẻ hero điểm + Band
  (`tabular-nums`); câu đúng/sai (`.lt-q--correct` / `.lt-q--wrong`) phân biệt bằng **cả màu sắc lẫn
  ký hiệu/chữ** (`✓ Đúng` / `✗ Chưa đúng`); 3 khối giải thích (`.lt-explain`), dẫn chứng
  (`.lt-evidence`), và Bẫy (`.lt-distractors`, hổ phách + `⚠`) tách biệt rõ; transcript làm nổi bật
  bằng chứng bằng `mark.lt-hl`.
- **Trang luyện kỹ năng (`assets/css/practice.css`, `.practice*`):** nạp lười riêng trên tuyến phương
  pháp nghe; danh sách bài `.practice-list` dùng lưới thẻ kính Aero 2 cột có huy hiệu số bài và nút
  vào bài; thanh audio `.practice-audio` dùng kính bóng với nút phát chính gel aqua, nút nghe lại kính
  phụ và chọn tốc độ dạng pill giống `.lt-speed`; nút gợi ý `[data-practice-action="hint"]` là chip
  kính mờ nhẹ (≥ 44px) đặt cuối ô nhập; lựa chọn `.practice-choice` là thẻ kính bấm lớn; phản hồi
  đúng / một phần / chưa đúng kết hợp màu cỏ / hổ phách / đỏ với ký hiệu (`✓` / `◐` / `✗` / `+` / gạch
  ngang), so sánh từng từ `.practice-diff` và thẻ điểm `.practice-score` đạt AA cả sáng/tối.

## 4. Ràng buộc kỹ thuật & a11y (không được phá)

- Tương phản chữ ≥ **WCAG AA** (4.5:1) — đo trên nền kính *xấu nhất* (vùng sáng nhất của trời).
- Tôn trọng `prefers-reduced-motion` (tắt bong bóng bay / shimmer) và `prefers-color-scheme`.
- Không dùng ảnh nặng: trang trí bằng CSS/SVG inline; tổng CSS đã minify gọn (< ~60 KB, gzip < ~15 KB).
- Font: chỉ font hệ thống hoặc Google Fonts (hiện dùng Inter + Noto Sans, một link Google Fonts có
  hỗ trợ tiếng Việt, `display=swap`); không tải font từ nguồn khác.
- Mobile 360px: không cuộn ngang, nút ≥ 44px chạm được, blur nặng có thể giảm trên mobile.
- In ấn (`@media print`): bỏ nền trời, kính → nền trắng, chữ đen.
- Không đổi class/id mà `assets/js/app.js` đang dùng nếu không cập nhật JS tương ứng.

## 5. Checklist review mỗi thay đổi UI

- [ ] Có đủ 5 gene (trời/nước · cỏ · kính bóng · bo tròn/gel · chữ sạch Inter/Noto Sans)?
- [ ] Dùng token trong `:root`, không hard-code màu mới lẻ tẻ?
- [ ] AA contrast, light + dark, reduced-motion, mobile 360px, print đều ổn?
- [ ] Component mới tái dùng glass panel / gel button thay vì tự chế kiểu khác?
