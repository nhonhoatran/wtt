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

- Một ban tổ chức, nhiều giải; đơn + đôi; loại trực tiếp hoặc vòng bảng → loại trực tiếp; tỷ số nhập theo ván; xếp hạng tích điểm có hạn; client vi/en, admin tiếng Việt.
- Stack: pnpm + Turborepo; `apps/client` Next.js; `apps/admin` Refine 5 + antd 5; `apps/api` NestJS + Prisma 7.10.x; `apps/worker` BullMQ; PostgreSQL/Redis/S3 có sẵn; deploy docker-compose trên Dokploy (staging + production).
- Lịch: 19 tuần làm việc (95 ngày công) + 1 tuần Tết. Phạm vi 80 ngày công + dự phòng 15. **Ngày bắt đầu: chờ xác nhận.**

## Phases

Phase 04–08 làm 2 đợt: lát cắt dọc (tuần 4–6) rồi phần còn lại. Sync phase 03: 2026-11-12.

| Phase | Name | Tuần | Ngày công | Status |
|-------|------|------|-----------|--------|
| 1 | [Nền móng: monorepo, compose, Dokploy, staging, design token](./phase-01-foundation-monorepo-compose-dokploy-design-tokens.md) | 1–2 | 6 | In progress (code xong; chờ hạ tầng; chưa qua cổng ra) |
| 2 | [Spike: Refine + antd 5, Better Auth, phát hành Dokploy, revalidate Next.js](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md) | 1–2 | 3,5 | In progress (B/C/E đạt; D chờ staging) |
| 3 | [Đăng nhập admin, RBAC, người dùng, khung admin](./phase-03-admin-auth-rbac-users-and-admin-shell.md) | 2–3 | 5,5 | Hoàn thành (chưa deploy staging) |
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
| Cổng ra phase 01 | cuối tuần 2 | Staging chạy; Redis riêng `noeviction`; thiết kế upload; chủ sở hữu sao lưu + RPO. Phase 03 đã code trước cổng (sai lệch, xem phase 03) |
| **G1a** (cứng) | cuối tuần 3 | BTC xác nhận mẫu hạt giống loại trực tiếp; chưa có → lát cắt chỉ chạy dữ liệu thử |
| **M1 — lát cắt dọc** | cuối tuần 6 | Trên staging: 1 giải, 1 nội dung loại trực tiếp, entry nhập tay, bốc thăm, nhập tỷ số, 1 trang nhánh công khai |
| Diễn tập khôi phục sao lưu | trước tuần 9 | Trước lần nạp dữ liệu thật đầu tiên |
| **Pilot BTC** | tuần 9 | Nạp giải cũ bằng import, bốc thăm, nhập tỷ số, xem trang công khai; thu phản hồi |
| **G1b** (cứng) | trước tuần 10 | BTC trả lời chia bảng, phá hòa, rút lui giữa bảng → mới làm phần còn lại phase 06 |
| M2 — lõi giải đấu đủ | cuối tuần 13 | Phase 04–08 xong trên staging |
| **G2** (cứng) | trước tuần 14 | BTC trả lời quy chế điểm → mới làm phase 09 |
| Ra mắt | cuối tuần 19 (mục tiêu) | Sớm hơn nếu không dùng hết dự phòng |

## Phụ thuộc

- Chuỗi (1 người): 1 ∥ 2 → 3 → lát cắt (4 → 5 → 6 → 7 → 8) → M1 → 4 → 5 → pilot → [G1b] 6 → 7 → 8 → M2 → [G2] 9 → 10 → 11 → 12. Spike E quyết định revalidate ở 7, 8, 10.
- Phase 03 code trước khi cổng phase 01 đạt: chờ chủ repo chốt tiếp tục hay dừng deploy (xem phase 03).
- Điều kiện ngoài: chủ repo chốt tài khoản GitHub, email, tên repo; chủ hạ tầng trả lời preflight; tên miền; brand + logo vector; BTC trả lời G1a/G1b/G2; ngày bắt đầu + lịch Tết.

## Ràng buộc cứng (áp dụng mọi phase)

- Schema chỉ đổi qua `prisma migrate dev` hoặc `--create-only` → review SQL → `migrate deploy`. Không bao giờ `prisma db push`.
- Migration tương thích ngược; bước phá hủy lùi sang bản sau. Không lấy giá trị từ dòng `.env` đã comment; lệnh đụng DB in host + tên DB và xin xác nhận.
- Giá trị nghiệp vụ là cấu hình động; tham số vận hành chỉnh trên `/settings` (bảng `AppSetting`, khung có từ phase 03); env chỉ cho secret, kết nối, thứ cần lúc boot và trần/sàn an toàn. Danh sách cố ý fix cứng: phase 04.
- `QUEUE_PREFIX` bắt buộc cho mọi queue và khóa Redis; payload job chỉ chứa id.
- Lọc/sắp xếp/phân trang ở server. RBAC enforce ở NestJS guard (deny-by-default); admin chỉ ẩn/hiện UI.
- Comment ít, tiếng Anh; commit tiếng Anh conventional, không nhắc AI; file < 200 dòng, kebab-case. Site tham chiếu chỉ học cấu trúc, không dùng asset/chữ/dữ liệu.

## Ngoài phạm vi và cắt

- Để giai đoạn sau: thi đấu đồng đội; chấm từng điểm; VĐV tự đăng ký; nối Kamito Member; tài khoản người hâm mộ; tìm kiếm toàn cục; xem trực tiếp; kho tài liệu; tiền thưởng theo vòng; xếp hạng theo cặp; cache handler dùng chung; vai trò mới khi có người thật cần.
- Cắt khi trễ (theo thứ tự): video; hẹn giờ đăng tin; trang tĩnh; lịch dạng tháng; dải kết quả header; `/players`; export lịch/kết quả; export đăng ký; sao chép cột ma trận; tạo nhanh N bàn. Không cắt: sanitizer/XSS, auth hardening, hardening ra mắt.
- Dời từ red team: tự xếp lịch; trạng thái Entry PENDING/WAITLIST; import PLAYERS riêng; export qua queue; sao chép giải; bestResultsCount; thống kê mùa VĐV; link xem trước có token; tự lưu nháp; CRUD video/liên hệ; sắp khối trang chủ; vai trò tài trợ dạng danh mục; gắn tin/video với VĐV; số người đi tiếp > 2.
- Red team 2026-11-11: 15 finding, nhận 15 ([chi tiết](./reports/red-team-261111-1614-adjudicated-findings.md)). Câu hỏi chưa giải quyết: cuối [phase 12](./phase-12-english-seo-hardening-and-launch.md#câu-hỏi-chưa-giải-quyết) và "Việc còn mở" trong [phase 03](./phase-03-admin-auth-rbac-users-and-admin-shell.md).
