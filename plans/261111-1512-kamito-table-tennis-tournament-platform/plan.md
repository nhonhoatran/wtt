---
title: "Web giải đấu bóng bàn Kamito"
description: "Nền tảng quản lý và công bố giải bóng bàn Kamito: admin tạo giải, bốc thăm, xếp lịch, nhập tỷ số, xếp hạng tích điểm; site công khai song ngữ render server-side."
status: in-progress
priority: P1
effort: 20w
branch: n/a
tags: [feature, frontend, backend, database, api, infra]
blockedBy: []
blocks: []
created: 2026-11-11
---

# Web giải đấu bóng bàn Kamito

## Overview

- Một ban tổ chức (Kamito), nhiều giải; đơn + đôi; loại trực tiếp (vòng loại + nhánh chính) hoặc vòng bảng → loại trực tiếp; tỷ số nhập sau trận theo ván; xếp hạng tích điểm có hạn; client vi/en, admin tiếng Việt.
- Stack đã chốt: pnpm + Turborepo; `apps/client` Next.js (Server Components), `apps/admin` Refine 5 + antd 5, `apps/api` NestJS + Prisma 7.10.x, `apps/worker` BullMQ; engine nhánh đấu tự viết; PostgreSQL/Redis/MinIO có sẵn (URL qua env); deploy docker-compose trên Dokploy (staging + production). Admin mở ra internet; 2 vai trò `ADMIN`, `RESULTS_OPERATOR`.
- Không Kafka, không WebSocket/Socket.IO, không bảng outbox (dấu `SubEvent.rankingDirtyAt` được phép). Trang công khai làm mới bằng revalidate theo tag (cách dùng chốt ở Spike E) + TTL ngắn ngày thi đấu.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Lịch: 20 tuần lịch = 19 tuần làm việc (95 ngày công) + 1 tuần Tết (không đánh số). Phạm vi 80 ngày công + dự phòng 15 ngày. **Ngày bắt đầu: chờ xác nhận.** Tuần trong plan là tuần làm việc thứ n.
- Nguồn quyết định: [Brainstorm đã duyệt](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md), [Red team đã phân xử](./reports/red-team-261111-1614-adjudicated-findings.md). Nghiên cứu: [site tham chiếu](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md), [engine nhánh đấu](../reports/researcher-261111-1450-tournament-engine-bracket-libs-and-site-capture-tools.md), [admin + hạ tầng](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md), [brand](../reports/researcher-261111-1450-midomax-kamito-brand-identity-analysis.md).

## Phases

Phase 04–08 làm 2 đợt: phần **lát cắt dọc** (tuần 4–6) rồi phần còn lại.

| Phase | Name | Tuần | Ngày công | Status |
|-------|------|------|-----------|--------|
| 1 | [Nền móng: monorepo, compose, Dokploy, staging, design token](./phase-01-foundation-monorepo-compose-dokploy-design-tokens.md) | 1–2 | 6 | In progress (code xong, chờ hạ tầng) |
| 2 | [Spike: Refine + antd 5, Better Auth, phát hành Dokploy, revalidate Next.js](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md) | 1–2 | 3,5 | In progress (B/C/E đạt; D chờ staging) |
| 3 | [Đăng nhập admin, RBAC, người dùng, khung admin](./phase-03-admin-auth-rbac-users-and-admin-shell.md) | 2–3 | 5,5 | Pending |
| 4 | [Dữ liệu gốc giải đấu + cấu hình + upload ảnh + sanitizer](./phase-04-tournament-master-data-config-and-media-upload.md) | 4 · 7–8 | 2 + 6 | Pending |
| 5 | [VĐV, cặp đôi, đăng ký, import Excel, gộp VĐV](./phase-05-players-pairs-entries-and-excel-import.md) | 4 · 8–9 | 1,5 + 6,5 | Pending |
| 6 | [Bốc thăm, hạt giống, vòng bảng, sinh nhánh, thao tác sau công bố](./phase-06-draws-seeding-groups-and-bracket-generation.md) | 4–5 · 10–11 | 4 + 6 | Pending |
| 7 | [Xếp lịch session/bàn, nhập, chốt, sửa tỷ số](./phase-07-scheduling-sessions-tables-and-result-entry.md) | 5–6 · 11–12 | 3,5 + 5,5 | Pending |
| 8 | [Site công khai: khung, trang giải, nhánh đấu, trận, bản in](./phase-08-public-site-shell-event-pages-and-bracket-ui.md) | 6 · 12–13 | 4 + 5 | Pending |
| 9 | [Quy tắc điểm, sổ điểm, chốt bảng xếp hạng](./phase-09-ranking-rules-points-ledger-and-snapshots.md) | 14–15 | 7 | Pending |
| 10 | [Trang xếp hạng, danh sách và hồ sơ VĐV](./phase-10-public-rankings-players-list-and-profiles.md) | 15–16 | 3,5 | Pending |
| 11 | [CMS: tin, video, nhà tài trợ, trang tĩnh, liên hệ, trang chủ](./phase-11-cms-news-videos-sponsors-static-pages-contact.md) | 16–17 | 5 | Pending |
| 12 | [Tiếng Anh, SEO, hardening, ra mắt](./phase-12-english-seo-hardening-and-launch.md) | 17 | 4,5 | Pending |
| — | Pilot với BTC trên dữ liệu một giải cũ (staging) | 9 | 1 | Pending |
| | **Phạm vi** | | **80** | |
| | **Dự phòng**: tuần 9 (1,5) · tuần 13 (3,5) · tuần 18–19 (10) | | **15** | |

## Mốc và cổng

| Mốc / cổng | Hạn | Điều kiện |
|---|---|---|
| Gửi câu hỏi quy chế cho BTC | tuần 1 | Câu hỏi G1a, G1b, G2 ở cuối phase 12 |
| Cổng ra phase 01 | cuối tuần 2 | Staging chạy; Redis riêng/`noeviction`; thiết kế upload; chủ sở hữu sao lưu + RPO |
| **G1a** (cứng) | cuối tuần 3 | BTC xác nhận mẫu hạt giống loại trực tiếp; chưa có → lát cắt chỉ chạy dữ liệu thử |
| **M1 — lát cắt dọc** | cuối tuần 6 | Trên staging: 1 giải, 1 nội dung loại trực tiếp, entry nhập tay, bốc thăm, nhập tỷ số, 1 trang nhánh công khai |
| Diễn tập khôi phục sao lưu | trước tuần 9 | Trước lần nạp dữ liệu thật đầu tiên |
| **Pilot BTC** | tuần 9 | Nạp giải cũ bằng import, bốc thăm, nhập tỷ số, xem trang công khai; thu phản hồi |
| **G1b** (cứng) | trước tuần 10 | BTC trả lời chia bảng, phá hòa, rút lui giữa bảng → mới làm phần còn lại phase 06 |
| M2 — lõi giải đấu đủ | cuối tuần 13 | Phase 04–08 xong trên staging |
| **G2** (cứng) | trước tuần 14 | BTC trả lời quy chế điểm → mới làm phase 09 |
| Ra mắt | cuối tuần 19 (mục tiêu) | Sớm hơn nếu không dùng hết dự phòng |

## Dependencies

- Chuỗi (1 người): 1 ∥ 2 → 3 → lát cắt (4 → 5 → 6 → 7 → 8) → M1 → 4 → 5 → pilot → [G1b] 6 → 7 → 8 → M2 → [G2] 9 → 10 → 11 → 12. Spike B, C quyết định cách làm phase 3 (auth), 3–5 (admin kit); Spike D quyết định quy trình phát hành; Spike E quyết định revalidate ở 7, 8, 10.
- Không có phase song song ngoài 1 ∥ 2 (spike nằm trong `spikes/`, không chung file) → không xung đột sở hữu file; phase sau được sửa file của phase trước (ghi rõ trong mục Related Code Files).
- Điều kiện bên ngoài: chủ repo chốt tài khoản GitHub/email/tên repo (cổng ở phase 1); chủ hạ tầng trả lời preflight; tên miền; brand guideline + logo vector; BTC trả lời G1a/G1b/G2; ngày bắt đầu + lịch nghỉ Tết.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Cắt khi trễ (theo thứ tự, trước khi đụng dự phòng tuần 18–19): (1) video [11]; (2) hẹn giờ đăng tin [11]; (3) trang tĩnh ngoài Giới thiệu/Điều khoản/Quyền riêng tư [11]; (4) lịch giải dạng tháng [8]; (5) dải kết quả trên header [8]; (6) danh sách `/players` (giữ hồ sơ) [10]; (7) export lịch/kết quả [7]; (8) export đăng ký + sheet "VĐV đã có" trong mẫu import [5]; (9) sao chép cột + xem phiên bản cũ trên ma trận quy tắc [9]; (10) tạo nhanh N bàn, tạo nội dung hàng loạt [4]. Không cắt: sanitizer/XSS, auth hardening, hardening ra mắt (phase 12 không bị cắt trước CMS).

## Ràng buộc cứng (áp dụng mọi phase)

- Schema chỉ đổi qua `prisma migrate dev --name ...` hoặc `--create-only` → review SQL → `migrate deploy`. Không bao giờ `prisma db push`.
<!-- Red Team: Deploy/migrate/staging/sao lưu — 2026-11-11 -->
- Migration tương thích ngược: chạy được **trước** code cần nó, chỉ cộng thêm; bước phá hủy (xóa/đổi tên cột, NOT NULL không default) lùi sang bản phát hành sau. Migrate là bước bắt buộc trước khi app chạy; app dừng nếu thiếu migration.
- Không lấy giá trị từ dòng `.env` đã comment; lệnh đụng DB phải in host + tên DB và được xác nhận trước khi chạy.
<!-- Red Team: Hạ tầng dùng chung không cách ly — 2026-11-11 -->
- `QUEUE_PREFIX` bắt buộc (vd `kamito-tt:{env}`) cho mọi queue và khóa Redis, kiểm lúc khởi động, khác nhau giữa môi trường. Payload job chỉ chứa id; worker nạp lại từ DB.
- Mọi giá trị nghiệp vụ là cấu hình động (DB/admin); tham số kỹ thuật (giới hạn upload/import, page size, thời hạn lưu, host nhúng video, phiên…) ở env; số trong plan chỉ là mặc định ví dụ. Danh sách thứ cố ý fix cứng: phase 4, mục "Cố định có chủ đích".
- Lọc/sắp xếp/phân trang luôn ở server. RBAC enforce ở NestJS guard (deny-by-default); admin chỉ ẩn/hiện UI.
- Comment ít, tiếng Anh; commit tiếng Anh conventional, không nhắc AI. File code < 200 dòng, tên kebab-case.
- Site tham chiếu chỉ dùng cấu trúc/chức năng; không dùng asset, chữ, logo, dữ liệu của worldtabletennis.com.

## Để giai đoạn sau (ngoài phạm vi)

Thi đấu đồng đội; chấm trực tiếp từng điểm + commentary + thống kê trận; VĐV tự đăng ký; nối Kamito Member; tài khoản người hâm mộ/yêu thích; tìm kiếm toàn cục; xem trực tiếp; kho tài liệu kỹ thuật; tiền thưởng theo vòng; xếp hạng theo cặp; cache handler dùng chung cho nhiều instance client; thêm vai trò khi có người thật cần.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
Dời từ red team: tự xếp lịch + nhân bản ngày; trạng thái Entry `PENDING/WAITLIST`; loại import `PLAYERS` riêng; export qua queue; sao chép giải; số kết quả tốt nhất (`bestResultsCount`); thống kê mùa của VĐV; công cụ "thiếu bản tiếng Anh"; tải thử 50 req/s; link xem trước có token; tự lưu nháp 30 s; CRUD chuyên mục video/liên hệ; sắp thứ tự khối trang chủ; vai trò tài trợ dạng danh mục; gắn tin/video với VĐV; số người đi tiếp mỗi bảng > 2.

## Red Team Review

### Session — 2026-11-11
**Findings:** 15 (15 accepted, 0 rejected) — 4 ý con bị bác, xem báo cáo
**Severity breakdown:** 6 Critical, 9 High

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Không sửa được draw sau công bố | Critical | Accepted | 05, 06, 08, 10 |
| 2 | Sửa kết quả và toàn vẹn khi chốt đồng thời | Critical | Accepted | 06, 07, 12 |
| 3 | Job ID cố định làm rơi lần tính lại xếp hạng | Critical | Accepted | 07, 09 |
| 4 | Auth và bull-board ngoài guard; vòng đời phiên | Critical | Accepted | 02, 03 |
| 5 | Lịch không dự phòng, thiếu lát cắt sớm, thiếu chức năng ngày thi đấu | Critical | Accepted | plan, 01–12 |
| 6 | Revalidate Next.js chưa kiểm chứng | Critical | Accepted | 01, 02, 07, 08, 10, 12 |
| 7 | Thứ tự deploy/migrate, staging, sao lưu | High | Accepted | plan, 01, 02, 12 |
| 8 | Hạ tầng dùng chung không cách ly | High | Accepted | plan, 01 |
| 9 | Luồng upload và khả năng truy cập MinIO | High | Accepted | 01, 04 |
| 10 | Kiểm soát bảo mật làm quá trễ | High | Accepted | 01, 02, 04, 08, 11, 12 |
| 11 | Import Excel và danh tính VĐV | High | Accepted | 05 |
| 12 | Xếp hạng không tái lập được | High | Accepted | 05, 06, 09, 10 |
| 13 | Luật vòng bảng cho walkover/bỏ cuộc/rút lui | High | Accepted | 04, 06, 07 |
| 14 | Tô-pô mạng, IP thật, rate limit, health | High | Accepted | 01, 03, 08, 10, 11 |
| 15 | Audit trail, phạm vi công khai, VĐV nhỏ tuổi, song ngữ | High | Accepted | 01, 03, 05, 06, 07, 08, 10, 11, 12 |

Chi tiết + ý bị bác: [red-team-261111-1614-adjudicated-findings.md](./reports/red-team-261111-1614-adjudicated-findings.md).

## Câu hỏi chưa giải quyết

Danh sách đầy đủ ở cuối [phase 12](./phase-12-english-seo-hardening-and-launch.md#câu-hỏi-chưa-giải-quyết).
