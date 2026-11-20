# Bàn giao Git phase 12 — 2026-11-19

## Kết quả

Chỉ kiểm tra và ghi tài liệu bàn giao; không stage, commit, push hoặc đổi remote. `main` đồng bộ `origin/main` (`git rev-list --left-right --count origin/main...HEAD`: `0 0`); index và danh sách conflict đều rỗng.

Sau khi thêm chính báo cáo này, working tree có **114 đường dẫn thay đổi: 75 tracked (74 sửa, 1 xóa có chủ đích), 39 untracked**. Tám ảnh phase 12 là bằng chứng mới được giữ riêng; không tính là thay đổi ảnh lịch sử.

| Nhóm | Đường dẫn |
|---|---:|
| `apps/` | 76 |
| `docs/` | 7 |
| `packages/` | 9 |
| `plans/` | 18 |
| Lockfile/workspace config | 2 |
| `tests/load/` | 2 |

Phạm vi tương ứng SEO/sitemap, song ngữ CMS, privacy logging, kiểm thử, phụ thuộc và tài liệu của phase. File `apps/client/src/app/sitemap.ts` bị xóa có chủ đích để thay bằng route runtime `sitemap.xml/route.ts` và `sitemap/[id]/route.ts`, giữ URL gốc `/sitemap.xml`.

## Kiểm tra an toàn

- Quét toàn bộ file text thay đổi/untracked: không phát hiện xưng hô riêng tư, marker private key/AWS key hoặc conflict marker.
- So khớp nguyên giá trị của ba secret dài đang hoạt động trong `.env` với các file text bàn giao: không có match. Chỉ báo tên file/key nếu phát hiện; không in giá trị secret. Đây là kiểm tra bàn giao có phạm vi, không thay chứng nhận bảo mật toàn hệ thống hoặc gitleaks CI.
- `.env` được gitignore; Git không chứng minh file này byte-identical. Các runner đã đọc dùng `process.loadEnvFile` và ghi override vào env của process con; không thấy lệnh sửa `.env`. Kết quả test chỉ áp migration/seed vào DB local `*_test`, không vào DB dev/staging.
- Không có file tạm `%l...` do lệnh chẩn đoán trước đó để lại. Log, runner và JSON test nằm trong thư mục gitignored `test-results/`.
- Tám PNG lịch sử dưới `plans/reports/screenshots-261117-phase-10/` đã được khôi phục đúng `HEAD`; `git diff --exit-code -- <thư mục>` trả 0. Ảnh mới nằm ở `reports/screenshots-261119-phase-12-public/`. Harness mặc định dùng artifact của Playwright, chỉ xuất ra thư mục khác khi đặt `E2E_SCREENSHOT_DIR`.
- `git diff --check` đạt. Cảnh báo CRLF → LF phù hợp `.gitattributes` (`text=auto eol=lf`); không normalize hàng loạt file không liên quan.

## Migration và phụ thuộc

- Migration `20261119151407_add_content_english_fields` chỉ có ba `ALTER TABLE ... ADD COLUMN ... TEXT`, tương ứng ba trường `String?`; không drop, update, backfill hoặc thêm `NOT NULL`. Kiểu thay đổi cộng thêm không thay thế một lượt diễn tập rollback thật.
- Báo cáo QA ghi migration tạo bằng `migrate dev --create-only`, sau đó `migrate deploy` trên test DB. Trong các thay đổi chỉ có nhắc `prisma db push` để cấm sử dụng, không thêm lệnh thực thi đó.
- Lockfile chỉ thêm Helmet 8.3.0 và override có phạm vi `@ant-design/pro-layout>path-to-regexp` sang 8.4.2; không thấy nâng hàng loạt phụ thuộc ngoài mục tiêu.
- Lượt xác nhận cuối `pnpm audit --audit-level=high`: exit 0, **0 high/critical, còn 2 moderate**.

## Tài liệu và giới hạn

Đã đọc lại/sửa có phạm vi `docs/code-standards.md`, `docs/system-architecture.md`; ghi [nhật ký kỹ thuật](../../../docs/journals/261119-phase-12-english-seo-hardening.md). Quy định test `*_test`, ngân sách sitemap, log allowlist và trạng thái remote hiện tại đã thống nhất; phát biểu remote ngày 2026-11-12 được giữ làm lịch sử, không suy ra tài khoản hiện tại.

Phase 12 vẫn `in-progress`. CSP enforce/nonce, toàn site UI, SEO validator/container, Lighthouse/axe/load, luồng UI giải tám bước, staging/Traefik, S3/CDN, rollback và khôi phục sao lưu chưa được nghiệm thu. Không dùng test local hoặc diff sạch để đóng những cổng này. Nguồn: [PM sync](./pm-261119-phase-12-sync.md), [API thật](./tester-261119-phase-12-real-api.md), [public E2E](./tester-261119-2234-phase-12-bilingual-public-e2e.md), [review](./code-reviewer-261119-phase-12-hardening.md).
