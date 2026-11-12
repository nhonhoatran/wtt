# Phase 02 — Spike: Refine + antd 5, Better Auth trên NestJS, phát hành/rollback Dokploy, revalidate Next.js

## Context Links

- [Brainstorm §4.1, §6 rủi ro, §8](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Admin + hạ tầng: A.4, D.2, D.5](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Red team đã phân xử: nhóm 4, 6, 7](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước/song song: [phase-01](./phase-01-foundation-monorepo-compose-dokploy-design-tokens.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: pending. Tuần 1–2 (≈3,5 ngày công, xen phase 01).
- Bốn spike có tiêu chí đạt/trượt rõ và phương án dự phòng chốt sẵn: **B** Refine 5 + antd 5, **C** Better Auth trên NestJS, **D** quy trình phát hành + rollback trên Dokploy compose, **E** revalidate theo tag của Next.js.
- Engine nhánh đấu tự viết ở phase 06 (đã chốt), không có spike thư viện nhánh đấu.
- Mọi điều sau đây là **chưa kiểm chứng** cho tới khi spike chạy: Refine 5 với antd 5, mặc định và cách mount Better Auth, cách Dokploy xử lý `depends_on`/rollback, ngữ nghĩa API cache của bản Next.js đã ghim.
- Code spike là code bỏ đi: nằm trong `spikes/<tên>/` (ngoài `pnpm-workspace.yaml`), xóa sau khi ghi kết quả. Không merge vào app.

## Key Insights

- `@refinedev/antd` 6.0.3 khai peer `antd ^5.23` → dùng antd 5.x. RBAC của Refine chỉ ẩn UI.
- Better Auth 1.7.x có admin plugin (role, ban); cách mount vào NestJS chưa kiểm chứng; CLI của nó sinh schema → phải chép vào `schema.prisma` rồi `prisma migrate dev`, không dùng lệnh migrate/push của Better Auth.
<!-- Red Team: Auth/bull-board ngoài guard + vòng đời phiên — 2026-11-11 -->
- Handler Better Auth mount vào Express nằm **ngoài** guard Nest → mọi endpoint nó tự mở (sign-up, admin plugin, impersonation…) phải được kiểm tường minh. Reviewer nêu các mặc định này theo hiểu biết, chưa kiểm trên bản sẽ cài → là tiêu chí của Spike C, không phải sự thật.
<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
- Reviewer dẫn docs Next.js: `revalidateTag` một tham số bị deprecated, dạng khuyến nghị là stale-while-revalidate (request đầu sau khi vô hiệu vẫn có thể nhận HTML cũ), cần dạng hết hạn ngay; `middleware.ts` đổi tên thành `proxy.ts`. Chưa kiểm trên bản đã ghim → Spike E.
<!-- Red Team: Deploy/migrate/staging/sao lưu — 2026-11-11 -->
- Migrate phải là bước bắt buộc trước khi app chạy; Dokploy có tôn trọng `depends_on: condition: service_completed_successfully` hay không chưa kiểm chứng → Spike D.

## Requirements

- Mỗi spike ≤ thời lượng ghi bên dưới; quá giờ mà chưa đạt = trượt → áp dụng dự phòng.
- Kết quả ghi vào mục "Kết quả spike" cuối file này: đạt/trượt từng tiêu chí, bằng chứng (lệnh, output, phiên bản), quyết định.
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
- Trước lần cài đầu mỗi thư viện: ghi license (đọc từ tarball) + ngày phát hành gần nhất + tình trạng bảo trì.

## Architecture

- Spike B, C chạy trên khung phase 01 (Postgres/Redis cục bộ của `docker-compose.dev.yml`).
- Spike D, E chạy trên bản "hello" phase 01 đã deploy lên **staging** Dokploy (không dùng production).
- Kết quả spike quyết định: cách làm auth (phase 03), admin kit (phase 03–05), quy trình phát hành (mọi phase), cách làm mới trang công khai (phase 07, 08, 10).

## Related Code Files

Create (tạm, xóa sau spike): `spikes/refine-antd/`, `spikes/better-auth-nest/`, `spikes/dokploy-release/NOTES.md`, `spikes/next-revalidate/`.
Modify: file này (mục Kết quả spike); `docs/deployment-guide.md` (quy trình phát hành chốt ở Spike D).

## Implementation Steps

### Spike B — Refine 5 + @refinedev/antd + antd 5 (1 ngày)

1. Vite + React + `@refinedev/core@5`, `@refinedev/antd@6.0.x`, `antd@5.x` (≥ 5.23), `@tanstack/react-query@5`.
2. Data provider tự viết nhỏ (≤ 120 dòng) map `pagination`/`sorters`/`filters` của Refine sang hợp đồng API `page,pageSize,sort,q,filter[...]` → `{data,total}`; chạy với một endpoint NestJS stub có dữ liệu thật trong Postgres cục bộ (200 dòng seed).
3. Kiểm: bảng antd phân trang/sắp xếp/lọc phía server (request thay đổi theo thao tác, không tải hết); `ConfigProvider locale={viVN}`; theme từ `packages/ui-tokens/antd-theme.ts`; `accessControlProvider` ẩn menu theo role; `Upload` với `customRequest` gửi lên URL ký sẵn (dạng theo thiết kế upload chốt ở phase 01); form validate inline + map lỗi field từ API.
4. `pnpm build` không lỗi, ghi peer warning, đo kích thước bundle gzip.

Tiêu chí đạt: tất cả mục 3 chạy; build sạch lỗi; không cần antd 6.
Trượt → Ant Design ProComponents + antd 5 + TanStack Query/Router (hạng 2 nghiên cứu), ước +4–5 ngày ở phase 03–05, lấy từ dự phòng + danh sách cắt.

<!-- Red Team: Auth/bull-board ngoài guard + vòng đời phiên — 2026-11-11 -->
### Spike C — Better Auth trên NestJS (1,25 ngày)

1. Tra doc Better Auth (skill `docs-seeker`) về tích hợp Express/NestJS; mount handler dưới `/api/v1/auth/*` trước body parser theo doc.
2. Email + mật khẩu, admin plugin (role, ban), adapter Prisma với Prisma 7.10; sinh schema bằng CLI Better Auth → chép model vào `schema.prisma` → `prisma migrate dev --create-only` → review → áp dụng (DB cục bộ, in host + tên DB trước).
3. Guard Nest đọc session từ cookie → nạp `User` từ DB mỗi request (không tin role trong session) → gắn `req.user { id, role }`; test login / logout / session hết hạn / user bị ban / sai mật khẩu nhiều lần.
4. Chạy sau proxy nginx của admin (cùng origin) → cookie set đúng.
5. Kiểm từng endpoint Better Auth tự mở (liệt kê bằng cách duyệt router Express sau khi mount):
   - sign-up tắt → `POST .../sign-up/*` trả 404;
   - endpoint admin-plugin tắt, hoặc chỉ gọi được khi role = `ADMIN`;
   - impersonation tắt;
   - rate limit hoạt động **trên handler đã mount** (gửi > ngưỡng → 429), đếm theo IP thật đi qua `trust proxy` của phase 01;
   - ánh xạ model `User` + trường `role` của dự án (2 giá trị `ADMIN`, `RESULTS_OPERATOR`);
   - luồng mật khẩu tạm: admin đặt mật khẩu tạm → user đăng nhập → bị buộc đổi;
   - thu hồi toàn bộ phiên của 1 user bằng API của thư viện.
6. Thử bọc Better Auth sau controller Nest tường minh (`login`, `logout`, `me`, `change-password`) gọi API phía server của thư viện, chỉ mount handler gốc cho đường dẫn bắt buộc (nếu có). Ghi khả thi hay không.

Tiêu chí đạt: mục 1–5 đúng hết; schema đi qua `prisma migrate`; không xung đột body parser/global prefix; hash mật khẩu an toàn mặc định; danh sách đường dẫn không cần đăng nhập ghi ra được (làm allowlist cho test e2e phase 03).
Trượt → Passport local + phiên trong DB: bảng `UserSession` (token hash, expiresAt, lastSeenAt, ip, userAgent), cookie `HttpOnly` mang token ngẫu nhiên, hash mật khẩu `argon2`, ước +2 ngày ở phase 03 (lấy từ dự phòng).

<!-- Red Team: Deploy/migrate/staging/sao lưu — 2026-11-11 -->
### Spike D — Dokploy compose: phát hành có migrate trước, rollback (0,75 ngày)

1. Dùng bản hello của phase 01 trên **staging**. Diễn tập đúng quy trình phát hành phase 01: build → `pg_dump` DB staging về nơi dự án kiểm soát → service `migrate` (in host + tên DB, chạy khi `MIGRATE_CONFIRM_TARGET` khớp) → api/worker chỉ khởi động sau khi `migrate` thoát mã 0.
2. Kiểm Dokploy có tôn trọng `depends_on: { migrate: { condition: service_completed_successfully } }` không: cho migration lỗi cố ý → api/worker **không** được khởi động bản mới. Không tôn trọng → dự phòng: chạy tay `docker compose --profile tools run --rm migrate` trước khi redeploy (kiểm chạy được container profile tools từ thư mục compose của Dokploy).
3. Kiểm API dừng khi `_prisma_migrations` chậm hơn bộ migration đi kèm image.
4. Đổi code → redeploy; đo thời gian gián đoạn (curl vòng lặp 1 req/s).
5. Tìm chức năng rollback trong UI/doc Dokploy cho compose; thử quay về bản trước trên schema đã migrate (migration chỉ cộng thêm).
6. Diễn tập `prisma migrate resolve` cho một migration lỗi giữa chừng (DB staging).
7. Kiểm env đổi trong UI có tới container qua `${VAR}`; healthcheck `/health/live` fail có chặn chuyển traffic không; có tự deploy khi push không.

Kết quả chấp nhận được cả hai hướng: có rollback → ghi quy trình; không có → deploy lại commit/tag trước (Dokploy build từ nhánh/tag), dựa vào quy tắc migration tương thích ngược. Downtime > 30 s mỗi lần deploy → ghi rủi ro, lên lịch deploy ngoài giờ thi đấu.

<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
### Spike E — Revalidate theo tag trên bản Next.js đã ghim (0,5 ngày)

1. Ghim bản Next.js (phase 01). Tra doc đúng bản đó (skill `docs-seeker`): API vô hiệu tag hiện hành, dạng hết hạn ngay (không stale-while-revalidate), tên file `middleware.ts` hay `proxy.ts`, cách làm `sitemap` sinh lúc chạy.
2. Dựng 1 trang Server Component fetch API có tag `match-{id}` + 1 route handler nội bộ `/api/revalidate` nhận danh sách tag → vô hiệu tag.
3. Đo: cập nhật dữ liệu → gọi revalidate → **request đầu tiên** sau đó nhận HTML mới (không phải lần thứ hai). Ghi thời gian từ lúc chốt tới khi có HTML mới.
4. Khởi động lại container client → trang vẫn đúng (không trả bản cache cũ trước khi vô hiệu).
5. Chiến lược tag khai báo được **trước khi có response** (tag dựng từ slug/mã trong URL, hoặc từ id trả về của request nhẹ trước) — chọn một, ghi lại.
6. Kiểm cách chặn `/api/revalidate` trên domain công khai: rule Traefik/Dokploy theo path, hoặc route kiểm `Host` nội bộ + secret.

Tiêu chí đạt: request đầu tiên sau revalidate có HTML mới; chịu được restart; chặn được route trên domain công khai. Trượt → trang ngày thi đấu dùng TTL ngắn đồng nhất (`MATCHDAY_REVALIDATE_SECONDS`) làm cơ chế chính, revalidate theo tag chỉ là tăng tốc; tiêu chí "≤ 5 s" đổi thành "≤ TTL".

## Todo List

- [ ] Spike B: data provider + bảng server-side + locale + theme + RBAC UI + upload + build → đạt/trượt
- [ ] Spike C: mount, plugin admin, schema qua migrate, guard đọc role từ DB, cookie qua proxy, sign-up/impersonation/rate limit/mật khẩu tạm/thu hồi phiên, thử bọc controller → đạt/trượt
- [ ] Spike D: migrate trước start, pg_dump, migration lỗi chặn bản mới, `migrate resolve`, downtime, rollback, env → quy trình phát hành
- [ ] Spike E: tag → revalidate → HTML mới ở request đầu, restart, chặn route công khai → đạt/trượt
- [ ] Ghi "Kết quả spike", xóa `spikes/`, cập nhật Key Insights của phase 03, 07, 08 nếu đổi hướng

## Success Criteria

- Bốn quyết định được ghi kèm bằng chứng (phiên bản đã cài, lệnh, output); không còn mục "chưa kiểm chứng" nào trong 4 chủ đề.
- Danh sách đường dẫn không cần đăng nhập (allowlist) ghi được, dùng cho test e2e phase 03.
- Quy trình phát hành + rollback ghi vào `docs/deployment-guide.md`, đã diễn tập trên staging.
- Thư mục `spikes/` đã xóa, không có dependency spike lọt vào app.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Spike kéo dài | Trung bình × Cao | Timebox cứng; hết giờ = trượt → dự phòng |
| Spike B trượt → admin tốn thêm 1 tuần | Thấp × Trung bình | Lấy từ dự phòng; áp danh sách cắt trong plan.md |
| Better Auth mở endpoint không tắt được | Trung bình × Cao | Dự phòng Passport + phiên DB |
| Better Auth đổi API giữa bản | Trung bình × Thấp | Pin bản patch; bọc sau `AuthService` để đổi được |
| Dokploy bỏ qua `depends_on` | Trung bình × Cao | Migrate tay theo profile tools trước redeploy; checklist phát hành |
| Revalidate tag không cho HTML mới ở request đầu | Trung bình × Trung bình | TTL ngắn đồng nhất cho trang ngày thi đấu |

Rollback: spike không vào code chính → không có gì để revert ngoài xóa thư mục.

## Security Considerations

- Spike C phải kiểm: cookie `HttpOnly`, `Secure`, `SameSite=Lax`; rate limit trên handler thật; thông báo lỗi đăng nhập không lộ email tồn tại hay không; không endpoint nào ngoài allowlist trả 2xx khi chưa đăng nhập.
- Không dùng tài khoản/secret thật trong spike; DB cục bộ (B, C) hoặc DB staging riêng (D, E).

## Next Steps

- Phase 03 dùng kết quả B + C; phase 07, 08 dùng kết quả E; mọi phase deploy staging theo quy trình D.

## Kết quả spike

(Điền sau khi chạy — mỗi spike: phiên bản đã cài, đạt/trượt từng tiêu chí, bằng chứng, quyết định, ngày.)
