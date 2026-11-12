---
type: brainstorm
date: 2026-11-11
status: approved
slug: kamito-table-tennis-tournament-platform
---

# Brainstorm: web giải đấu bóng bàn Kamito

## 1. Tóm tắt

- Mục tiêu: web giải đấu bóng bàn cho Kamito (thuộc Midomax), bố cục tham khảo worldtabletennis.com, nhận diện theo brand Kamito.
- Hướng đã chốt: "gọn mà chắc" — Next.js client, admin Refine + Ant Design 5, NestJS + Prisma, BullMQ, không Kafka, không Socket.IO.
- Lộ trình: 16 tuần, 1 người + AI, 5 giai đoạn.
- Chỉ tham khảo cấu trúc/chức năng của site gốc; không dùng logo, ảnh, nội dung, dữ liệu của họ.

## 2. Yêu cầu đã chốt

| Hạng mục | Quyết định |
|---|---|
| Mô hình | Một ban tổ chức (Kamito), nhiều giải. Chỉ nhân viên tạo/quản giải trong admin |
| Môn | Bóng bàn |
| Nội dung thi đấu bản đầu | Đơn + đôi. Đồng đội dời giai đoạn sau |
| Thể thức | Admin chọn theo từng nội dung: loại trực tiếp (có vòng loại + nhánh chính), hoặc vòng bảng → loại trực tiếp |
| Tỷ số | Nhập sau trận, theo ván. Chưa chấm trực tiếp từng điểm |
| Đăng ký | Admin nhập/import Excel. VĐV chưa tự đăng ký |
| Xếp hạng | Tích điểm qua nhiều giải, có ngay bản đầu |
| Ngôn ngữ client | Tiếng Việt + tiếng Anh. Admin: tiếng Việt |
| Hạ tầng có sẵn | PostgreSQL, Redis, MinIO (URL có sẵn). Deploy docker-compose trên Dokploy |

## 3. Phương án đã cân nhắc

| | A. Gọn mà chắc (chọn) | B. Tự do tối đa | C. Đủ nguyên đề bài |
|---|---|---|---|
| Admin | Refine + antd 5 | shadcn + TanStack tự ráp | như A |
| Nhánh đấu | `brackets-manager.js` + UI tự style | tự code toàn bộ | như A |
| Hàng đợi | BullMQ | BullMQ | BullMQ + Kafka + Socket.IO |
| Ưu | Nhanh, admin có sẵn bảng/form/menu, locale vi_VN | Tùy biến admin cao nhất | Khớp danh sách ban đầu |
| Nhược | Admin mang dáng antd | Ước thêm 4–6 tuần | Thêm server + vận hành, không thêm giá trị ở bản đầu |

### Kafka: loại

- Mọi xử lý sau khi chốt kết quả (đẩy nhánh, tính bảng, ghi sổ điểm, làm mới trang) nằm trong một API; không có hệ thống ngoài nào tiêu thụ sự kiện.
- Tải ước lượng (chưa đo): dưới 1 sự kiện/phút khi nhập sau trận; khoảng 2 sự kiện/giây nếu sau này chấm trực tiếp 20 bàn.
- Chi phí Kafka theo báo cáo nghiên cứu (doc Confluent, npm): RAM tối thiểu ~4 GB/node, khuyến nghị 3 controller cho production; `kafkajs` không cập nhật từ 2023-02.
- Kafka không thay BullMQ (không có sẵn delayed job, retry từng job).
- Điều kiện xem xét lại: công ty có sẵn cụm Kafka; từ 2–3 hệ thống khác cần nghe sự kiện giải đấu (Kamito Member, app, BI); cần replay sự kiện nhiều tháng.
- Không làm trước bảng outbox/`domain_event` (YAGNI).

### Realtime: chưa cần

- Site gốc dùng polling JSON ~10 s ở Match Centre, không thấy WebSocket.
- Bản đầu: trang công khai render server-side, làm mới theo cache ngắn/revalidate sau khi chốt kết quả.

## 4. Giải pháp đã chốt

### 4.1 Kiến trúc

```
[Client Next.js]   [Admin React SPA + Refine + antd 5]
        \                /
        [API NestJS + Prisma] ---- [Worker BullMQ]
           |         |        |
      PostgreSQL   Redis    MinIO (qua S3 API)
```

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | apps: client, admin, api, worker; package dùng chung cho type |
| Client | Next.js (SSR/ISR), UI tự làm theo brand | List/lọc/phân trang phía server; slug + meta + sitemap |
| i18n client | Việt/Anh | Trường nội dung song ngữ; thiếu bản Anh thì dùng bản Việt |
| Admin | Refine 5 + @refinedev/antd + antd 5.x | Bảng server-side; phân quyền enforce ở NestJS guard (Refine chỉ ẩn/hiện UI) |
| API | NestJS (Express) + Prisma 7.10.x | Migration trong git, không schema push |
| Queue | BullMQ + @nestjs/bullmq, dashboard bull-board | Job: xử lý ảnh, tính xếp hạng, hẹn giờ đăng bài, import/export |
| Storage | MinIO có sẵn, gọi bằng `@aws-sdk` (presigned URL) | Không dùng MinIO SDK để dễ đổi kho |
| Engine nhánh đấu | `brackets-manager.js` + adapter Prisma | Cần spike tuần đầu; dự phòng tự viết |
| UI nhánh đấu | Component tự style theo brand (xem xét `react-brackets`) | Mobile: cuộn ngang trong khung |
| Auth | Chỉ tài khoản admin ở bản đầu | Better Auth nếu spike mount NestJS ổn; dự phòng Passport + JWT |
| Deploy | docker-compose trên Dokploy | Env phải khai báo qua `env_file`/`${VAR}` cho từng service |

### 4.2 Thực thể chính

`Tier` → `EventType` → `Event` → `SubEvent` → `Draw (qualifying/main/group)` → `Round` → `Match` → `Game`; `Player`, `Pair`, `Entry (seed, trạng thái, suất)`, `Venue`, `Table`, `Session`, `GroupStanding`, `RankingPointsRule`, `RankingPointsEarned (có hạn)`, `RankingSnapshot`, `Article`, `Video`, `Sponsor`, `StaticPage`, `AppSetting`, `User`.

- Bên thi đấu trong `Entry`/`Match` thiết kế dạng "competitor" (VĐV hoặc cặp) để sau thêm đội không phải làm lại.

### 4.3 Cấu hình động (không fix cứng)

- Nhóm giải, hạng giải (tên, màu, logo, ảnh nền).
- Điểm xếp hạng theo hạng giải × vòng đấu; thời hạn hiệu lực của điểm.
- Thể thức trận theo nội dung: số ván (3/5, 4/7), điểm mỗi ván, cách biệt.
- Cách tính điểm và tiêu chí xếp hạng vòng bảng.
- Nhóm tuổi/trình độ của nội dung thi đấu.
- Cờ hiển thị: dải kết quả trên header, giải nổi bật, link vé ngoài.
- Mốc điểm kiểu 1000/400/125 chỉ là giá trị mặc định ví dụ (nguồn mới từ Wikipedia, chưa đối chiếu ITTF).

### 4.4 Giao diện

- Client: Kamito chủ đạo — đỏ `#EC1E24` cho hành động/điểm nhấn, đen `#0A0A0A`, font Archivo; navy cho khu nhiều số liệu (xếp hạng, lịch đấu). Chờ đối chiếu brand guideline chính thức.
- Bố cục học theo site gốc: dải kết quả + nav, hero giải, tab chi tiết giải (Tổng quan, Trận đấu, Nhánh đấu, Bảng đấu, Danh sách VĐV, Thông tin), trang trận, bảng xếp hạng, hồ sơ VĐV, tin tức, video.
- Tránh điểm yếu của site gốc: không SEO, lọc phía client trên payload lớn, 1 request/VĐV, header mobile cao ~206 px.
- Admin menu: Giải đấu, Vận động viên, Xếp hạng, Nội dung (tin, video, trang tĩnh), Nhà tài trợ, Cấu hình, Người dùng.

### 4.5 Xếp hạng

- Chốt kết quả → job ghi `RankingPointsEarned` theo quy tắc của hạng giải + vòng đạt được, kèm ngày hết hạn.
- Admin chốt bảng theo kỳ → sinh `RankingSnapshot` (hạng hiện tại, hạng trước, chênh lệch).
- Bảng riêng cho đơn và đôi.

## 5. Phạm vi và lộ trình

| Giai đoạn | Tuần | Nội dung |
|---|---|---|
| 0. Nền móng | 1–2 | Monorepo, docker-compose, Dokploy, đăng nhập admin, design token; spike `brackets-manager`, Refine + antd 5, Better Auth |
| 1. Giải đấu | 3–6 | Nhóm/hạng giải, giải, nội dung thi đấu, VĐV, cặp đôi, import Excel, địa điểm, bàn |
| 2. Thi đấu | 7–10 | Bốc thăm, hạt giống, BYE, vòng bảng, nhánh đấu, lịch theo ngày/session/bàn, nhập tỷ số, trang giải công khai |
| 3. Xếp hạng | 11–13 | Quy tắc điểm, sổ điểm, chốt bảng, trang xếp hạng, hồ sơ VĐV |
| 4. Nội dung | 14–16 | Tin tức, video nhúng, nhà tài trợ, trang tĩnh, liên hệ, tiếng Anh, SEO, hoàn thiện |

Để giai đoạn sau: thi đấu đồng đội; chấm trực tiếp từng điểm + commentary + thống kê trận; VĐV tự đăng ký; nối Kamito Member; tài khoản người hâm mộ/yêu thích; tìm kiếm toàn cục; xem trực tiếp; kho tài liệu kỹ thuật; tiền thưởng theo vòng.

## 6. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| `brackets-manager.js` chưa cài chạy thử; chưa rõ độ khớp vòng loại + nhánh chính, vòng bảng → loại trực tiếp | Spike tuần 1; không khớp thì tự viết engine (chỉ cần loại trực tiếp + vòng tròn) |
| `@refinedev/antd` khai báo peer `antd ^5.23`, chưa khai báo antd 6 | Dùng antd 5.x; build thử ở giai đoạn 0 |
| MinIO community đã archive (2026-04-25), không còn vá lỗi | Gọi qua S3 API; cô lập mạng; có kế hoạch đổi kho |
| Redis dùng chung có eviction làm mất job BullMQ | Xác nhận `maxmemory-policy noeviction`; nếu không thì dùng Redis riêng |
| Màu đỏ Kamito có 4 mã đang dùng; không có logo vector công khai | Xin brand guideline + logo gốc; mặc định `#EC1E24` |
| Dokploy: rollback/zero-downtime cho compose chưa kiểm chứng | Kiểm tra ở giai đoạn 0 |
| 1 người, 16 tuần, phạm vi rộng | Giữ thứ tự giai đoạn; nội dung (GĐ 4) là phần cắt được nếu trễ |

## 7. Tiêu chí thành công

- Admin tạo được một giải hoàn chỉnh (nội dung, danh sách, bốc thăm, lịch, kết quả) không cần can thiệp DB.
- Nhập kết quả xong, trang công khai và nhánh đấu cập nhật trong vài giây.
- Bảng xếp hạng tự tính đúng theo quy tắc điểm cấu hình trên admin.
- Trang công khai render server-side, có slug/meta/sitemap, dùng tốt trên mobile 390 px.
- Đổi quy tắc điểm, thể thức trận, hạng giải không cần sửa code.

## 8. Bước tiếp theo

1. Lập kế hoạch chi tiết theo 5 giai đoạn.
2. Giai đoạn 0: ba spike (engine nhánh đấu, Refine + antd 5, Better Auth trên NestJS).
3. Thu thập: brand guideline + logo, cấu hình Redis hiện tại, thông tin server Dokploy.

## 9. Báo cáo nguồn

- `researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md` (+ `wtt-screenshots/`)
- `researcher-261111-1450-midomax-kamito-brand-identity-analysis.md`
- `researcher-261111-1450-tournament-engine-bracket-libs-and-site-capture-tools.md`
- `researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md`

## 10. Câu hỏi chưa giải quyết

1. Brand guideline chính thức và logo vector của Kamito?
2. Redis có sẵn đang đặt `maxmemory-policy` gì, có dùng chung làm cache không?
3. Cấu hình server Dokploy (RAM/CPU), có môi trường staging riêng không?
4. Tên miền của web giải đấu?
5. Chu kỳ chốt bảng xếp hạng (tuần/tháng/sau mỗi giải) và thời hạn điểm mặc định?
6. Nhóm tuổi/trình độ thực tế của giải Kamito?
7. Điều khoản sử dụng của worldtabletennis.com chưa đọc được; giới hạn ở tham khảo cấu trúc.
8. Better Auth mount vào NestJS chưa kiểm chứng.
