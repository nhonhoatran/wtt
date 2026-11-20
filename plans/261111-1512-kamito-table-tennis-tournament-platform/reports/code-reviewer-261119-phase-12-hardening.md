# Rà soát phase 12 — SEO và hardening

Ngày kiểm: 2026-11-19; cập nhật xác nhận cuối lúc 22:30 (Asia/Saigon). Phạm vi: thay đổi đang làm trong working tree cho SEO, sitemap, header, Helmet, log không chứa dữ liệu cá nhân, trường nội dung song ngữ và script tải. Không commit hoặc triển khai.

## Kết quả trong phạm vi đã rà

Không còn phát hiện Critical/P1/P2 chưa xử lý trong phạm vi mã nguồn đã rà. Đã rà tiếp delta schema/admin/API/client song ngữ và các đường ghi log API/worker/thư viện xác thực. Các cổng staging/ra mắt vẫn mở; review mã nguồn không thay nghiệm thu vận hành.

| Phát hiện | Phán quyết và xử lý | Bằng chứng |
|---|---|---|
| Helmet mặc định trả CORP `same-origin`, chặn ảnh public khi nhúng khác origin | Đã sửa có phạm vi: chỉ controller ảnh public xuất `cross-origin`; API thường vẫn giữ mặc định | `apps/api/src/modules/media/media-public-files.controller.ts:21`; `media-public-files.controller.test.ts`; `api-security-headers.test.ts` |
| Sitemap đơn có thể vượt giới hạn số URL/dung lượng | Đã thay bằng XML runtime, tự sinh index khi cần; tách theo cả số `loc` lẫn byte UTF-8 sau escape, không cắt URL | `apps/client/src/lib/sitemap-xml.ts:8,23,50`; root `app/sitemap.xml/route.ts`; chunk `app/sitemap/[id]/route.ts` |
| Chunk sitemap mới đi vòng qua rate limit, ID chunk bất kỳ chạy toàn bộ truy vấn và dựng XML trước 404 | Đã sửa: matcher tường minh luôn chạy kể cả giả header prefetch; giữ ngoài thương lượng locale nhưng tính vào ngân sách search hiện có. ID vượt giới hạn index bị loại trước upstream; ID chắc chắn không thể tồn tại bị loại trước cấp phát XML; 404 và 429 đều `no-store` | `apps/client/src/proxy.ts:10,18,64`; `app/sitemap/[id]/route.ts:5-14`; regression `proxy.test.ts`, `sitemap.test.ts` |
| CSP report có thể ghi URL chứa thông tin đăng nhập, đường dẫn hoặc tham số cá nhân | Đã sửa: chỉ ghi origin HTTP(S), marker/scheme cố định; directive lấy token trong allowlist, dữ liệu không hợp lệ được che | `apps/client/src/app/api/csp-report/route.ts:25,35,84-86`; `tests/unit/csp-report.test.ts` |
| Pino HTTP mặc định ghi URL/query/IP/header; exception/Redis/worker có thể ghi message và stack chứa dữ liệu cá nhân | Đã sửa: request chỉ còn ID đã kiểm tra và method; response chỉ còn status; route dùng mẫu route đã khớp. Lỗi chỉ giữ loại/mã kỹ thuật trong allowlist. Các sink API/worker giữ thông điệp cố định và ID tương quan, không ghi raw error | `apps/api/src/common/logger/logger.module.ts:32-51`; `packages/shared/src/safe-error-summary.ts:18`; `logger-privacy.test.ts`; sink trong filter/auth/queue/revalidation/ranking/publishing và `apps/worker/src/` |
| Prisma và Better Auth tự ghi lỗi trước lớp log ứng dụng | Đã sửa: factory Prisma mặc định `log: []`, vẫn cho phép opt-in rõ ràng; Better Auth dùng hook log với ngữ cảnh cố định, mức log hợp lệ và tóm tắt lỗi an toàn. Không thay đổi hành vi xác thực hay kiểm tra health | `packages/db/src/prisma-client-factory.ts:12`; `apps/api/src/modules/auth/auth-instance.ts:48-58`; `auth-log-privacy.test.ts` dùng logger thật của Better Auth đã cài |
| Thiếu bản dịch category/duration/footer group; summary chỉ có tiếng Anh bị ẩn; map nhãn kế thừa `__proto__`/`constructor` có thể làm hỏng trang EN | Đã thêm ba cột nullable qua migration, DTO/admin/public contract và renderer; nhãn bộ lọc dùng setting động và giữ nguyên mã gửi lên. Lookup map chỉ nhận own string property ở API và client, có regression cho khóa đặc biệt | `packages/db/prisma/schema/content.prisma:26,61,103`; migration `20261119151407_add_content_english_fields`; `public-content.controller.ts:65-68`; `content-localization.test.ts` |

## Các giả định đã đối chiếu

- Query sitemap dùng `publicScope` cho giải/draw/trận; trận phải `OFFICIAL`, không void/BYE. Tin và video phải công bố, có ngày công bố đã tới; không trả ID/hồ sơ VĐV. Năng lực tab tương ứng với query event-detail hiện có.
- Sitemap xuất cả URL `vi`/`en` và alternate `vi`/`en`/`x-default`, chỉ xuất tab có nội dung; URL vòng loại giữ `?draw=qualifying` đúng canonical của route. XML escape ký tự trong text/attribute. Chunk không hợp lệ không chuyển sang route locale.
- Upstream không thành công hoặc timeout được `publicGet` ném lỗi; không có nhánh bắt lỗi để trả sitemap trống giả thành công. API sitemap đọc không cache; bảng xếp hạng dùng loader/cache sẵn có.
- Bộ chia sắp xếp URL trước khi phân file. Mỗi lần đọc vẫn dựng discovery từ toàn bộ dữ liệu công khai; chưa có bằng chứng đo RAM/tải staging ở tập lớn. Ngân sách request đã áp dụng, nhưng kết quả local không thay cổng đo hiệu năng.
- Các giá trị 50.000 URL/50 MiB là giới hạn giao thức; ngưỡng request lấy cấu hình động hiện có. Giới hạn input/log CSP là hàng rào kỹ thuật. Script k6 không có target mặc định; tải/rate/thời gian là biến môi trường có mặc định theo plan.
- CSP vẫn report-only; chưa có nonce và chưa có báo cáo staging sạch. Header riêng HSTS/nosniff/referrer/frame-deny có trong mã. Không coi report-only là CSP đã enforce.
- Trường EN mới không buộc backfill và không thay mã category hiện có. `news.categoryLabelsEn` có schema/settings editor, chỉ xuất khóa đang được cấu hình trong `news.categories`; không thêm truy vấn từng bài. Dữ liệu lọc/phân trang vẫn do server xử lý.
- Đã đọc source/type đã cài của `pino-http`, `nestjs-pino`, Better Auth 1.7.21 trước khi chọn serializer/hook. Tóm tắt lỗi có tính idempotent để qua nhiều lớp logger; loại/mã tùy ý, message, stack, metadata, cause bị loại. CLI tạo admin giữ nguyên bước xác nhận và thông báo thành công có email; chỉ thay sink lỗi cuối. Các response health/queue warning được giữ nguyên, không suy rằng báo cáo log đã kiểm định mọi response riêng tư.
- Fixture trình duyệt CMS kiểm tra PostgreSQL local có hậu tố `_test` và chuỗi xác nhận khớp trước seed; không đổi cấu hình ứng dụng hay tự trỏ DB. Kiểm tra đơn vị của guard bao gồm DB dev, host từ xa, sai protocol và thiếu xác nhận.

## Kiểm tra độc lập đã chạy

| Lệnh | Kết quả |
|---|---|
| Client Vitest: `sitemap-xml`, `sitemap`, `page-metadata`, `json-ld`, `i18n-keys` | 5 file / 11 test đạt trước lần bổ sung rate-budget |
| API Vitest: `api-security-headers`, `media-public-files.controller` | 2 file / 2 test đạt; HTTP thật trên Express/Nest và filesystem local, không mock DB |
| Regression rate-budget/bounds trước sửa | 3 test thất bại đúng lỗi đã nêu: matcher bỏ qua sitemap, proxy 307 thay vì 429, 404 không có `no-store` |
| Client Vitest sau sửa: `proxy`, `sitemap`, `sitemap-xml` | 3 file / 16 test đạt |
| `pnpm --filter @kamito/client typecheck` và `lint` sau sửa | Đạt; lỗi typing ở dữ liệu test đã được sửa trước lượt xác nhận cuối |
| Client Vitest `csp-report.test.ts` | Lượt xác nhận cuối 22:12 giờ địa phương: 1 file / 7 test đạt. Giữ 5 test cũ về body cap/stream/malformed/window, bổ sung 2 test privacy; lượt 2 test trước đó không phải coverage cuối |
| API `typecheck`, `lint`; `vitest run src` sau bản sửa log cuối | Đạt; 32 file / 182 test. Bao gồm HTTP Express + `pino-http` thật với sentinel URL/query/auth/cookie/IP/error; Better Auth `$context.logger` thật; các assertion queue warning/timeout vẫn giữ hành vi cũ |
| Worker `typecheck`, `lint`, toàn bộ Vitest sau đổi sink log | Đạt; 8 file / 44 test |
| Shared `build`, `typecheck`, `test` sau helper an toàn | Đạt; lượt test cuối 23 file / 104 test; 3 test helper phủ lỗi Prisma/Redis, input tùy ý/getter ném lỗi và idempotence |
| Client Vitest xác nhận cuối `content-localization`, `test-database-target`, `csp-report` | 3 file / 13 test đạt (4 renderer, 2 fixture guard, 7 CSP); gồm EN-only summary, fallback, mã lọc giữ nguyên và khóa prototype |
| `node --check tests/load/event-page-smoke-test.js` | Cú pháp đạt; không phải đã thực thi k6 |
| `git diff --check` | Đạt; chỉ cảnh báo chuẩn hóa CRLF có sẵn |

Không cộng các nhóm test trùng nhau thành tổng test duy nhất. Lượt review này không trực tiếp chạy DB, tải thực hoặc thao tác deploy. Các lượt tích hợp Postgres/Redis và Playwright do tester riêng thực hiện, cần dùng báo cáo tester cuối. Probe lỗi SQL Prisma với sentinel đang chờ DB dist mới tại thời điểm cập nhật này; chưa tính là bằng chứng đã đạt.

## Các cổng không được đánh dấu đạt từ review

- CSP enforce và nguồn iframe/media theo cấu hình đã kiểm bằng trình duyệt/báo cáo vi phạm.
- Chốt bằng chứng tích hợp Postgres/Redis/storage và E2E toàn luồng theo dữ liệu thử được xác nhận; các lượt local đã chạy không tự thay thế staging.
- Lighthouse, axe và smoke tải 5 request/giây trong 120 giây trên staging; script k6 chỉ là công cụ chuẩn bị.
- Quyền đồng ý công khai hồ sơ VĐV: tiếp tục giữ điều kiện privacy/noindex; không thêm `Person` hoặc URL hồ sơ vào sitemap.
- TLS/Traefik, kiểm edge không lộ API, diễn tập rollback và khôi phục sao lưu có ghi thời gian.

## Kết luận phạm vi

Delta song ngữ và logging đã qua lượt rà mã cuối, không còn vấn đề vật chất chưa xử lý trong phạm vi này. Chờ báo cáo tester tổng, probe Prisma và đồng bộ tài liệu/trạng thái plan; không tự chuyển phase sang hoàn thành khi các cổng vận hành còn mở.
