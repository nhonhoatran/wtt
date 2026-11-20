---
date: 2026-11-19
phase: 12
status: in-progress
---

# Phase 12 — Tiếng Anh, SEO và hardening

## Bối cảnh

Triển khai phần local của phase 12 theo kế hoạch hiện có. Hạ tầng staging, consent hồ sơ VĐV và các cổng ra mắt vẫn chưa đủ bằng chứng để nghiệm thu.

## Thay đổi

- Khóa parity từ điển vi/en; bổ sung `categoryEn`, `durationTextEn`, `footerGroupEn` từ schema đến admin/API/SSR, nhãn chuyên mục động và fallback vi. Sửa tóm tắt chỉ có tiếng Anh và lookup key kế thừa của object.
- Sitemap runtime có index/chunk theo giới hạn URL/byte, public scope, hai locale và ngân sách search động. Thêm Twitter và `SportsEvent`; tiếp tục loại hồ sơ VĐV khỏi sitemap/`Person`.
- Thêm Helmet và header client; giữ ngoại lệ CORP đúng route ảnh public. Log HTTP, Better Auth, API và worker chỉ giữ ngữ cảnh cho phép; lỗi dùng loại/mã kỹ thuật. Prisma mặc định `log: []`, CSP report bỏ đường dẫn/query/credentials.
- Migration 18 chỉ thêm ba cột `TEXT` nullable. Tạo bằng `migrate dev --create-only`, áp dụng cùng 17 migration trước vào DB test riêng `localhost:5433/kamito_tt_phase12_test`; không áp hai migration mới vào dev/staging.

## Kiểm chứng

| Phạm vi | Kết quả cuối |
|---|---|
| API nguồn / shared / worker / client | 182 / 104 / 44 / 72 ca đạt, báo cáo riêng từng suite; không cộng lượt rerun |
| Admin | 11 ca đạt theo các nhóm kiểm Windows/WSL đã ghi trong QA |
| API PostgreSQL/Redis thật | 32 ca duy nhất / 7 file đạt |
| Public Playwright production local | 55 đạt, 5 bỏ qua có chủ đích theo viewport, 0 lỗi |
| Prisma privacy | Probe SQL lỗi chỉ đọc có negative control đạt; factory mặc định không in sentinel |
| Phụ thuộc | Audit không còn high/critical; còn 2 moderate. Helmet 8.3.0 đối chiếu nguồn `MIT`/`helmetjs/helmet` |

Typecheck, lint và build liên quan đã đạt; k6 chỉ được kiểm cú pháp/inspect, chưa phát tải staging. Các lượt thiếu seed, mất dịch vụ hoặc crash native Windows được ghi là thất bại rồi chạy lại; không tính thành đạt. Ảnh hồi quy mới được giữ ở thư mục báo cáo phase 12; tám ảnh lịch sử phase 10 đã khôi phục đúng `HEAD`.

## Quyết định và giới hạn

- Dùng DB `*_test` local và env process-only với target xác nhận; không sửa `.env` trong các lệnh đã chạy. Không có hash nền để kết luận byte-identical chỉ từ Git.
- CSP tiếp tục report-only cho tới khi có nonce/policy hợp lệ và báo cáo staging sạch. Kết quả header/unit không thay được cổng enforce.
- Kiểm public không phải toàn bộ luồng vận hành giải tám bước; chưa nghiệm thu toàn site admin/public, Lighthouse, axe, tải, S3/CDN, TLS/Traefik, rollback hoặc khôi phục sao lưu.
- HTTP server thử đã dừng; container/volume và DB test được giữ. Sau khi helper WSL kết thúc, PostgreSQL/Redis ở trạng thái `Exited (0)` trong read-back; không có lệnh stop/remove container hoặc xóa dữ liệu.
- Chưa stage, commit, push hoặc deploy trong đợt này.

## Việc tiếp theo

Giữ phase 12 `in-progress`; triển khai và đo trên staging sau khi cổng hạ tầng được giải quyết. Cần xác nhận consent, chạy đầy đủ E2E vận hành, CSP enforce và diễn tập rollback/restore có thời gian.

Nguồn: [QA API thật](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261119-phase-12-real-api.md), [QA public](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261119-2234-phase-12-bilingual-public-e2e.md), [review](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/code-reviewer-261119-phase-12-hardening.md), [đồng bộ kế hoạch](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/pm-261119-phase-12-sync.md).
