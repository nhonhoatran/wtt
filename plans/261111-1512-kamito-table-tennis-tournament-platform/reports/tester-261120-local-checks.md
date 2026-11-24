# Kiểm chứng local độc lập — phase 08–12

- Ngày: 2026-11-20.
- Phạm vi: hồi quy admin, API `src`, worker, shared, client; kiểm wiring công cụ axe/Lighthouse.
- Không chạy migration/seed/truy vấn PostgreSQL hoặc fixture CMS/Playwright cần PostgreSQL trong các lệnh thuộc báo cáo này. Hai suite cache/rate-limit của client dùng Redis thật, namespace ngẫu nhiên của fixture.

## Kết quả xác nhận

| Nhóm | Kết quả | Bằng chứng |
|---|---|---|
| Admin đầy đủ, PATH có Git shell | 29/29 đạt; 0 lỗi/bỏ qua; lượt cuối sau frozen install: 3.532,9341 ms | `test-results/261120-phase0812-admin-unit-final.log`; gồm đủ 5 entrypoint, 18 ranking, 3 TipTap, 3 image policy |
| State ma trận điểm | 18/18 đạt; 100% line/branch/function của module mới | Nằm trong 29 admin ở trên, không cộng trùng; Node coverage 280,73 ms |
| API `src` | 32 file / 182 ca đạt; lượt cuối sau frozen install: 58,21 giây | `test-results/261120-phase0812-api-unit-final.log`; lượt trước 79,92 giây giữ riêng ở `*-api-unit.log` |
| Worker | 8 file / 44 ca đạt; lượt cuối sau frozen install: 3,70 giây | `test-results/261120-phase0812-worker-unit-final.log`; giữ riêng lượt đầu 13,32 giây |
| Shared | 23 file / 104 ca đạt; lượt cuối sau frozen install: 1,42 giây | `test-results/261120-phase0812-shared-unit-final.log`; giữ riêng lượt đầu 5,97 giây |
| Client không cần Redis | 17 file / 65 ca đạt; 1,11 giây | `test-results/261120-phase0812-client-pure-unit.log`; loại trừ có khai báo hai suite Redis, không dùng lượt này để nhận đủ 72 |
| Client đầy đủ sau Redis healthy | 19 file / 72 ca đạt; lượt muộn nhất sau bản sửa EventHero: 1,17 giây | `test-results/261120-phase0812-late-client-unit.log`; giữ riêng các lượt trước 4,99 và 1,36 giây |
| Client TypeScript sau sửa skip callback và EventHero | PASS, exit 0 | `test-results/261120-phase0812-late-client-typecheck.log` |
| Client ESLint `src` và accessibility spec | PASS, exit 0 sau bản sửa EventHero | `test-results/261120-phase0812-late-client-lint.log` |
| Lighthouse runner kiểm cú pháp + `--help` | PASS, exit 0 | `test-results/261120-phase0812-lighthouse-help.log` |
| Playwright accessibility `--list` | 4 ca được phát hiện: vi/en × desktop/mobile; chưa thực thi | `test-results/261120-phase0812-accessibility-list.log` |
| Client production build | PASS, exit 0 sau frozen install và bản sửa EventHero cuối; Next.js 16.4.5 | `test-results/261120-phase0812-late-client-build.log`; giữ đủ các route động, sitemap index/chunk và proxy |
| Prisma validate | PASS, exit 0 sau frozen install | `test-results/261120-phase0812-prisma-validate.log`; không query DB |
| DB build | PASS, exit 0: Prisma Client 7.10.1 generate + TypeScript | `test-results/261120-phase0812-db-build.log`; không migrate/query/seed |
| API typecheck + build | PASS, cả hai exit 0 sau frozen install và DB generate | `test-results/261120-phase0812-api-typecheck-final.log`, `*-api-build-final.log` |
| Worker typecheck + build | PASS, cả hai exit 0 sau frozen install và DB generate | `test-results/261120-phase0812-worker-typecheck-final.log`, `*-worker-build-final.log` |
| Audit dependency cuối | 0 high / 0 critical / 2 moderate; exit 1 do moderate | Reviewer chạy, tester đọc lại raw `test-results/261120-phase0812-audit-review-final.json`: uuid/minimatch còn moderate; override `@prisma/config>effect` ghim 3.22.1 |

Không cộng nhóm 18 ranking riêng với 29 admin. Số của từng package là các lượt riêng; không suy thành toàn bộ ma trận tích hợp của monorepo.

Lượt kiểm muộn sau khi phase 08 đưa `EventShell`/`EventHero` thật vào fixture đã giữ lại phát hiện baseline A4 6 trang và bản sửa print-only tương ứng. Sau khi tác giả nhường lease `.next`, tester độc lập chạy lại **client TypeScript, ESLint, production build đều exit 0; unit 72/72 đạt** trên source cuối (`data-event-hero`, `data-bracket-title` và CSS ẩn hero/tiêu đề chỉ khi in nhánh đã tách trang). Bằng chứng PDF 9 ca offline và tám file kiểm bằng pypdf thuộc [báo cáo phase 08](../../reports/tester-261120-phase08-print64-desktop1440.md), không gọi là lượt Playwright toàn ứng dụng có DB của tester này. Không chạy API/worker build lại vì delta muộn chỉ ở client.

## Lệnh đã chạy

Node/pnpm có sẵn tại `C:\nvm4w\nodejs`, chạy ngoài sandbox khi runtime không resolve trong sandbox. Các lệnh xuất log vào root `test-results/` (gitignored).

```text
node --experimental-test-coverage --test test/ranking-rules-state.test.mjs
pnpm --filter @kamito/admin test
pnpm --filter @kamito/api exec vitest run src
pnpm --filter @kamito/worker test
pnpm --filter @kamito/shared test
pnpm --filter @kamito/client test
pnpm --filter @kamito/client exec vitest run --exclude tests/unit/public-response-cache.test.ts --exclude tests/unit/public-shared-rate-limit.test.ts
pnpm --filter @kamito/client typecheck
pnpm --filter @kamito/client exec eslint src tests/e2e/accessibility.spec.ts
node --check apps/client/tests/performance/lighthouse-audit.mjs
node apps/client/tests/performance/lighthouse-audit.mjs --help
pnpm --filter @kamito/client exec playwright test accessibility.spec.ts --list
pnpm --filter @kamito/client build
pnpm --filter @kamito/db exec prisma validate
pnpm --filter @kamito/db build
pnpm --filter @kamito/api typecheck
pnpm --filter @kamito/api build
pnpm --filter @kamito/worker typecheck
pnpm --filter @kamito/worker build
pnpm audit --json
```

## Lượt lỗi được giữ nguyên

1. Client TypeScript đầu tiên báo TS2769/TS7006 do ba callback `test.skip` dùng tham số thứ hai `testInfo`. Tác giả phase 08 chuyển kiểm điều kiện sang fixture `isMobile`; rerun TypeScript exit 0. Chi tiết lỗi ban đầu ở `tester-261120-independent-checks.md`.
2. Lighthouse `--help` đầu tiên bị parse thành URL, báo `TypeError: Invalid URL`. Root bổ sung nhánh help trước parse; kiểm lại cú pháp và help đều đạt. Không chạy URL để kiểm help.
3. Client full đầu tiên: 17 file đạt, 2 file Redis lỗi hook vì `ECONNREFUSED`; 65 ca đạt / 7 ca không chạy. Log gốc `test-results/261120-phase0812-client-unit.log` giữ nguyên. Root bật **riêng Redis** existing container qua compose, giữ volume. `docker ps` xác nhận Redis `127.0.0.1:6380→6379` healthy, không có PostgreSQL Kamito đang chạy; rerun đầy đủ 72/72 đạt. Không sửa test để bỏ Redis.
4. Audit đầu sau cài công cụ phát hiện **1 high / 2 moderate / 0 critical**: `effect@3.20.0`, GHSA-7589-6fvf-x4pw, đường dẫn qua `@prisma/config`; advisory ghi bản vá `>=3.22.1`. Raw `test-results/261120-phase0812-audit.json`. Root thêm override có phạm vi `@prisma/config>effect: 3.22.1`, cập nhật lockfile rồi frozen install thành công sau khi phục hồi các symlink virtual-store cũ từ WSL. Reviewer kiểm runtime/why và audit cuối; tester đọc lại raw thấy **0 high/critical, 2 moderate**, không dùng snapshot 19/11 thay lượt mới. Các build/validate/unit sau install ở bảng trên đều đạt.

API unit có warning Redis endpoint cố ý không tồn tại của `revalidation-enqueue.service.test.ts`; 182 ca vẫn đạt. Raw log qua PowerShell có phần bọc `NativeCommandError` cho dòng script phát stderr; mã thoát và summary của từng lệnh được kiểm riêng, không suy thất bại từ wrapper này.

## Chưa nghiệm thu

- Audit cuối đã đọc raw; hai moderate uuid/minimatch vẫn tồn tại, không gọi là audit sạch hoàn toàn. Build/typecheck/validate và các suite unit ở bảng trên đã xác nhận sau frozen install.
- Chưa chạy 5 ca publishing thật, các suite CMS/home/contact còn thiếu, axe audit 36 trang, Lighthouse trên ứng dụng chạy thật hoặc full tournament UI E2E 8 bước.
- Chưa kiểm staging/Dokploy, SEO container phát hành, CSP enforce, tải nhẹ staging, rollback/restore, MinIO/S3 hoặc điều kiện G1/G2/consent.
