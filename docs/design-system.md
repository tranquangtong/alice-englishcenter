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
5. **Chữ nhân văn, sạch:** sans-serif humanist (họ Frutiger / Segoe / Myriad), rõ ràng, thân thiện.

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
| Chữ | `--font` | `"Frutiger", "Segoe UI", "Myriad Pro", "Nunito Sans", system-ui, sans-serif` | |

**Dark mode = "Aero ban đêm":** trời đêm xanh navy → teal (`#06223a` → `#0b4a63`), kính tối
(`rgb(10 40 60 / .55)`), chữ `#e8f6ff`, aqua sáng hơn (`#5cc8ff`), cỏ sáng (`#7ee07f`), có aurora mờ.

## 3. Thành phần (component) chuẩn

- **Glass panel/card:** nền `--glass` + `backdrop-filter: blur(14px) saturate(160%)`, viền 1px
  `--glass-edge`, `inset 0 1px 0 rgb(255 255 255 / .9)` (vệt sáng trên), `--shadow-soft`, bo `--radius-l`.
  Luôn có **fallback** khi trình duyệt không hỗ trợ `backdrop-filter` (dùng `--glass-strong`).
- **Gel button / pill:** gradient dọc aqua (sáng trên, đậm dưới), nửa trên có lớp bóng trắng
  (`::before`), bo pill, hover sáng hơn + nhấc nhẹ, active lún xuống.
- **Nav item active:** dạng pill kính có vệt sáng, chữ aqua đậm.
- **Header:** dải kính mỏng; logo dạng "giọt nước / bong bóng" bóng.
- **Bảng:** khung kính, hàng tiêu đề gradient aqua nhạt, sọc ngựa vằn rất nhẹ.
- **Blockquote / callout:** khung kính viền trái màu cỏ hoặc aqua, icon giọt nước/lá (SVG inline).
- **Trang trí:** bong bóng, mây, sóng, aurora bằng CSS gradient / SVG inline; **chỉ ở nền**, không
  chồng lên chữ, `pointer-events: none`, `aria-hidden="true"`.

## 4. Ràng buộc kỹ thuật & a11y (không được phá)

- Tương phản chữ ≥ **WCAG AA** (4.5:1) — đo trên nền kính *xấu nhất* (vùng sáng nhất của trời).
- Tôn trọng `prefers-reduced-motion` (tắt bong bóng bay / shimmer) và `prefers-color-scheme`.
- Không dùng ảnh nặng: trang trí bằng CSS/SVG inline; tổng CSS gọn (< ~40 KB).
- Font: chỉ font hệ thống hoặc Google Fonts (ví dụ Nunito Sans); không tải font từ nguồn khác.
- Mobile 360px: không cuộn ngang, nút ≥ 44px chạm được, blur nặng có thể giảm trên mobile.
- In ấn (`@media print`): bỏ nền trời, kính → nền trắng, chữ đen.
- Không đổi class/id mà `assets/js/app.js` đang dùng nếu không cập nhật JS tương ứng.

## 5. Checklist review mỗi thay đổi UI

- [ ] Có đủ 5 gene (trời/nước · cỏ · kính bóng · bo tròn/gel · chữ humanist)?
- [ ] Dùng token trong `:root`, không hard-code màu mới lẻ tẻ?
- [ ] AA contrast, light + dark, reduced-motion, mobile 360px, print đều ổn?
- [ ] Component mới tái dùng glass panel / gel button thay vì tự chế kiểu khác?
