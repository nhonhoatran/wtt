# Báo cáo docs-manager: cập nhật docs sau phase 04

Ngày: 2026-11-12. Phạm vi: `docs/` (6 file). Không sửa code, không commit. Nguồn: code trong working tree tại thời điểm đọc, không dựa vào kế hoạch.

## 1. Đánh giá hiện trạng

- Docs phase 03 trước khi sửa có 4 chỗ sai so với code: `s3-client.provider.ts` đã bị xóa; worker ghi "chưa có processor, chưa dùng BullMQ" (sai, đã có media worker); "Chưa chọn thiết kế upload"; `code-standards` ghi "chưa commit" cho code phase 03 (`git log` đã có commit `60af9ef`, `a6fc71f`, `0e62234`).
- `auth-and-rbac.md` lệch code ở danh sách resource (thiếu `media`) và bảng setting (thiếu 8 key phase 04). Không nằm trong danh sách file được giao, nhưng là mâu thuẫn trực tiếp nên đã sửa tối thiểu.
- Mọi file sau khi sửa dưới 800 dòng: system-architecture 465, code-standards 419, deployment-guide 372, auth-and-rbac 277, changelog 99, roadmap 52.

## 2. Thay đổi đã làm

| File | Thay đổi chính |
|---|---|
| `docs/system-architecture.md` | Viết lại. Thêm: 5 migration, 7 schema file, bảng danh mục, giải và nội dung thi đấu, `MediaAsset`, partial unique index. Mục mới "Upload ảnh (phase 04)" (luồng 5 bước, dọn dẹp, storage `s3`/`local`, phục vụ `public/`, ba lớp trần, bảng mã lỗi, `failureReason`). Admin menu và module. Worker khởi động với BullMQ. Nginx: route `/api/v1/media/*`, upload limit. Quyết định 18–23. Sửa thành phần đã lỗi thời (S3 service, "chưa processor") |
| `docs/code-standards.md` | Viết lại. Thêm: danh sách `prismaListQuery` (whitelist, filter converter, `total` cùng transaction), `CatalogCrudService` có ví dụ `TiersService` rút gọn, bảng 409 `IN_USE`/`IS_DEFAULT`/`EVENT_PUBLISHED`/`DEFAULT_CHANGED`, mặc định duy nhất, mã 400/409/422, `httpsUrlSchema`, `sanitizeRichHtml` (allowlist), phân loại settings-vs-env với bảng hằng số giữ trong code (retry/backoff, WebP 82, trần pixel, bulk 50/100, `JSON_BODY_LIMIT`) và lý do. Sửa mục "BullMQ chưa là dependency" và "chưa commit" |
| `docs/deployment-guide.md` | Cập nhật bảng env: `STORAGE_DRIVER`, `UPLOAD_LOCAL_DIR`, `MEDIA_PUBLIC_BASE_URL`, `MEDIA_WORKER_CONCURRENCY`, `MEDIA_CLEANUP_INTERVAL_MINUTES`; `S3_*` chuyển thành "bắt buộc khi `s3`"; `S3_PRESIGN_ENDPOINT`/`S3_PUBLIC_BASE_URL` ghi là không dùng. Mục mới: giới hạn upload ảnh, seed danh mục (`MIGRATE_CONFIRM_TARGET=... pnpm --filter @kamito/db seed:config`, build trước vì seed import từ `dist/`). Thêm 2 dòng kiểm tra sau deploy và 8 dòng xử lý sự cố ảnh. Việc còn mở: đóng mục thiết kế upload, thêm 3 migration, sharp trên Alpine, thử S3 thật. Giữ nguyên mục "Bucket công khai" |
| `docs/project-changelog.md` | Thêm mục phase 04 (2026-11-12): Thêm, Thay đổi, Breaking và lưu ý cấu hình, Kiểm chứng, Chưa xong |
| `docs/development-roadmap.md` | Viết lại. Phase 04: "Xong (code, chưa commit). Chờ deploy staging". Phase 07 nhận `cache-tags.ts`. Thay "việc kế tiếp cho phase 03" bằng việc kế tiếp cho phase 04/05 |
| `docs/auth-and-rbac.md` | (Ngoài danh sách giao) Thêm `media` vào resource và dòng ma trận. Thêm 8 key setting phase 04 vào bảng |

## 3. Kiểm chứng đã làm

- Đối chiếu bằng code: schema Prisma và SQL migration (tên index), `permissions.ts`, `tournament-settings.ts`, `object-storage/*`, `media-*`, worker processors, `nginx` + `entrypoint`, `.env.example`, `docker-compose.yml`, service `catalog-crud`, `events.service`, `sub-events.service`.
- Mã HTTP và `code` lấy từ dòng `throw` trong code (422 cho `SLUG_TAKEN`, `DUPLICATE`, `SLUG_LOCKED`; 409 cho `IN_USE`, `IS_DEFAULT`, `INTENT_EXPIRED`...).
- Hành vi sanitize-html: đọc README đúng phiên bản đã cài `apps/api/node_modules/sanitize-html` (2.18.1): `discard` giữ nội dung trong thẻ bỏ đi.
- Token uppercase trong docs đối chiếu với `.env.example` và source: không còn tên env sai. Bốn token không có trong code đều là chủ ý (hai biến đã bỏ, lệnh Redis `PING`, `SHADOW_DATABASE_URL` có sẵn từ trước).
- Anchor nội bộ: script kiểm tra riêng, 0 link hỏng.
- `validate-docs.cjs`: chạy được với `--src` giới hạn (chạy mặc định quá 120 giây do quét `node_modules`). Kết quả là cảnh báo, không chặn. Phần lớn cảnh báo là false positive (mã lỗi, tên Prisma, tên DB). Không có cảnh báo env thật.

## 4. Khoảng trống còn lại

- Chưa đối chiếu lại trong giao diện: hành vi nút "Ẩn" khi `IN_USE`, mục M6 của review (còn một phần).
- Chưa kiểm chứng: sharp trên Alpine, `STORAGE_DRIVER=s3` với bucket thật, `create-admin` trong container, lock của mặc định duy nhất (M2 phần advisory lock).
- Worker chưa kiểm migration lúc boot (ghi đúng trong doc, chưa sửa code).
- `codebase-summary.md` và `repomix` không chạy: không nằm trong danh sách giao việc này. Cần chạy riêng nếu muốn.
- Các agent api-*, admin-*, phase04-fixes còn đang chạy. Docs chụp lại snapshot ở thời điểm đọc code. Nếu code đổi thêm, cần đồng bộ lại.

## 5. Khuyến nghị (theo thứ tự ưu tiên)

1. Chạy lại tester và code-reviewer trên code hiện tại trước khi commit (báo cáo tester là 13:29, code đã đổi sau đó).
2. Chốt F2: lỗi URL và slug trùng là 422 (docs đang theo 422) hay 400 theo spec gốc. Nếu đổi thành 400, sửa `code-standards.md` mục "Mã HTTP theo loại lỗi" và changelog.
3. Sau deploy staging: chạy `seed:config`, thử upload ảnh với `STORAGE_DRIVER=s3`, build image sharp trên Alpine, cập nhật mục "Việc còn mở" 12 và 13 trong deployment guide.
4. Dọn env: gỡ `S3_PRESIGN_ENDPOINT`, `S3_PUBLIC_BASE_URL` khỏi `env-schema.ts`, compose, `.env.example`. Khi làm, cập nhật system-architecture (mục "Chưa xây dựng").
5. Thêm kiểm tra migration lúc boot cho worker, hoặc ghi lý do không làm.

## 6. Số liệu

| Chỉ số | Giá trị |
|---|---|
| File docs cập nhật | 6 (5 theo giao việc + `auth-and-rbac.md`) |
| Dòng docs sau cập nhật | 1684 tổng |
| File vượt 800 dòng | 0 |
| Link nội bộ hỏng | 0 |
| Token env không có trong code (không chủ ý) | 0 |
| Cảnh báo validator thật | 0 (còn lại là false positive) |
| Commit | 0 |

## Câu hỏi còn mở

1. F2: 422 hay 400 cho lỗi URL và slug trùng?
2. Ai dọn user test còn sót trong DB dev (F3)? Dùng lệnh nào, và xác nhận trước khi xóa.
3. Action audit: nên giữ `subEvent.update` (camelCase, theo `auditPrefix`) hay đổi theo mẫu `<entity>.<hành động>` trong code-standards? Hiện docs ghi rõ cả hai.
4. `S3_PRESIGN_ENDPOINT`, `S3_PUBLIC_BASE_URL`: gỡ luôn trong lần này hay để lần dọn env?
5. Phase 04 đánh dấu "Xong (code, chưa commit)" trong roadmap theo yêu cầu, trong khi M2 (lock) và M6 còn mở. Chủ repo xác nhận cách ghi này.

**Status:** DONE_WITH_CONCERNS

**Summary:** Đã cập nhật 6 file trong `docs/` theo code phase 04 (system-architecture, code-standards, deployment-guide, project-changelog, development-roadmap, và sửa tối thiểu auth-and-rbac cho khớp resource `media` và 8 setting). Mọi file dưới 800 dòng, link và anchor hợp lệ, không có xưng hô cá nhân trong docs, không commit.

**Concerns/Blockers:**
- Báo cáo tester (13:29) đã cũ so với code. Cần chạy lại tester và code-reviewer trước khi commit.
- Roadmap ghi phase 04 "Xong" theo yêu cầu, nhưng M2 (phần lock) và M6 còn mở, và chưa kiểm sharp trên Alpine hoặc S3 thật.
- Chưa đối chiếu lại trong giao diện: nút Ẩn khi `IN_USE`.
- Chưa tạo `codebase-summary.md` (repomix), vì không nằm trong giao việc này.
- Có sửa `auth-and-rbac.md` ngoài danh sách giao để tránh mâu thuẫn.
- Quyết định F2 (422 hay 400) cần chủ repo xác nhận. Docs hiện theo 422.
