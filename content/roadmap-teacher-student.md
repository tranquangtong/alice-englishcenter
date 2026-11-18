# Lộ trình xây nền tảng học Teacher – Student

Mục tiêu: từ trang tài liệu tĩnh hiện tại, tiến dần lên một nền tảng nơi **mentor (teacher)** giao bài,
chấm, nhận xét và **học viên (student)** làm bài, nộp Writing/Speaking, theo dõi tiến độ.

## 1. Lộ trình 4 giai đoạn

| Giai đoạn | Thời gian gợi ý | Kết quả | Hạ tầng |
|---|---|---|---|
| **0. Tài liệu tĩnh** (hiện tại) | Đã xong | Cấu trúc đề + đề cương 4 kỹ năng | GitHub Pages (repo public) |
| **1. Đăng nhập & lớp học** | 2–3 tuần | Tài khoản, vai trò, lớp, giao bài, nộp bài Writing (text) | Static frontend + **Supabase** (Auth, Postgres, Storage) |
| **2. Luyện tập & chấm** | 3–4 tuần | Quiz Reading/Listening tự chấm, nộp Speaking (ghi âm), chấm theo 4 tiêu chí, bảng tiến độ | Như trên + AI hỗ trợ chấm sơ bộ |
| **3. Riêng tư & mở rộng** | khi cần | Repo private, domain riêng, mock test full 4 kỹ năng có giờ, thông báo | Cloudflare Pages hoặc Vercel (miễn phí cho repo private) |

> GitHub Pages với **repo private** cần gói GitHub trả phí. Khi chuyển private, nên chuyển hosting sang
> **Cloudflare Pages** hoặc **Vercel** (đều kết nối repo private miễn phí, có preview cho từng nhánh).

## 2. Kiến trúc đề xuất

- **Frontend:** giữ HTML/JS hiện tại cho giai đoạn 1; khi tính năng tương tác nhiều lên (giai đoạn 2),
  chuyển sang một framework có component và routing (ví dụ **Next.js** hoặc **SvelteKit**).
- **Backend:** **Supabase**: đăng nhập (email/Google), cơ sở dữ liệu Postgres, lưu file ghi âm,
  và **Row Level Security (RLS)** để phân quyền ngay trong database, nên frontend tĩnh vẫn an toàn.
  Phương án khác: Firebase (NoSQL, khó truy vấn báo cáo hơn).
- **AI hỗ trợ chấm (tùy chọn):** một serverless function gọi LLM để chấm nháp Writing theo 4 tiêu chí
  và chuyển giọng nói → văn bản cho Speaking. **Mentor duyệt trước khi học viên thấy điểm.**

```
Trình duyệt (teacher / student)
   │  đăng nhập, đọc/ghi dữ liệu (RLS kiểm quyền)
   ▼
Supabase: Auth · Postgres · Storage (audio)
   │  trigger khi có bài nộp mới
   ▼
Edge Function → LLM / Speech-to-text → điểm nháp → mentor duyệt
```

## 3. Vai trò & tính năng

| Tính năng | Student | Teacher | Admin |
|---|---|---|---|
| Đọc tài liệu, đề cương | ✅ | ✅ | ✅ |
| Tham gia lớp bằng mã lớp | ✅ | | |
| Tạo lớp, mời học viên | | ✅ | ✅ |
| Giao bài (deadline, kỹ năng, đề) | | ✅ | |
| Làm quiz Reading/Listening (tự chấm) | ✅ | xem kết quả | |
| Nộp Writing (gõ, có đếm từ & giờ) | ✅ | chấm + nhận xét trên dòng | |
| Nộp Speaking (ghi âm trên trình duyệt) | ✅ | nghe, chấm 4 tiêu chí | |
| Bảng tiến độ (band theo tuần, bài còn thiếu) | của mình | cả lớp | toàn hệ thống |
| Hỏi đáp / bình luận theo bài | ✅ | ✅ | |
| Quản lý tài khoản, vai trò | | | ✅ |

## 4. Mô hình dữ liệu (rút gọn)

| Bảng | Cột chính |
|---|---|
| `profiles` | id (= auth user), full_name, role (`student`/`teacher`/`admin`), target_band |
| `classes` | id, name, teacher_id, join_code, exam_date |
| `class_members` | class_id, student_id, joined_at |
| `assignments` | id, class_id, skill (`L`/`R`/`W`/`S`), title, content_ref, due_at |
| `questions` | id, assignment_id, type, prompt, options (json), answer_key |
| `submissions` | id, assignment_id, student_id, answers (json), text, audio_path, auto_score, status |
| `feedback` | submission_id, teacher_id, band_ta, band_cc, band_lr, band_gra, overall, comments (json) |

Quy tắc RLS tiêu biểu:
- Student chỉ đọc/ghi `submissions` của chính mình; chỉ đọc `assignments` của lớp mình tham gia.
- Teacher đọc mọi `submissions` của lớp mình phụ trách; chỉ teacher được ghi `feedback`.
- `answer_key` không trả về cho student trước khi nộp (dùng view hoặc function riêng).

## 5. Các bước làm giai đoạn 1 (checklist)

1. Tạo project Supabase (free), bật Email + Google login.
2. Tạo các bảng ở mục 4 + chính sách RLS; seed 1 lớp thử.
3. Thêm trang `login`, `dashboard` (student: bài được giao; teacher: lớp + bài nộp).
4. Trang nộp Writing: textarea + đếm từ + đồng hồ (giống giao diện thi thật).
5. Trang chấm: teacher nhập band 4 tiêu chí + nhận xét → student xem.
6. Kiểm thử phân quyền: tài khoản student không xem được bài người khác.

## 6. Lưu ý

- **Dữ liệu cá nhân:** chỉ thu thập tối thiểu (tên, email); tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ
  dữ liệu cá nhân; có trang quyền riêng tư, cho phép xóa tài khoản.
- **Bản quyền đề:** không đưa đề của ielts.app/Cambridge lên nền tảng; tự soạn đề hoặc dùng tài liệu
  được phép chia sẻ.
- **Chi phí:** Supabase / Cloudflare Pages / Vercel đều có gói miễn phí đủ cho vài chục học viên;
  chi phí chính (nếu có) là AI chấm nháp, nên giới hạn số lượt/tuần.
