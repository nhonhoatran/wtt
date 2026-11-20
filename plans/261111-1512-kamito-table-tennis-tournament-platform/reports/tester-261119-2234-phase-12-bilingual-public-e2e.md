# Phase 12 — Kiểm chứng song ngữ và E2E công khai với DB thật

- Thời điểm: 2026-11-19, lượt Playwright bắt đầu 22:30:48 ICT và kết thúc sau 66,4 giây.
- Phạm vi: bổ sung các trường tiếng Anh còn thiếu của CMS; hồi quy client; ba bộ Playwright công khai với API, PostgreSQL và Redis thật.
- Trạng thái: kiểm chứng local đạt. Không nghiệm thu staging, Lighthouse, axe, tải, hạ tầng nhiều replica hoặc toàn bộ luồng vận hành giải.
- Báo cáo này bổ sung cho lượt kiểm client trước đó trong `tester-261119-2154-phase-12-client-seo.md`; số mới nhất của client là 19 file / 72 test.

## Thay đổi sau audit ngôn ngữ

| Nội dung | Thay đổi và bằng chứng |
|---|---|
| Chuyên mục tin trên card/detail | Thêm `Article.categoryEn`; schema tại `packages/db/prisma/schema/content.prisma:26`, public contract tại `packages/shared/src/public-content-contract.ts:12`, editor tại `apps/admin/src/resources/content/content-form-fields.tsx:82`. Renderer chọn EN và dự phòng VI. |
| Nhãn bộ lọc chuyên mục | Setting động `news.categoryLabelsEn` tại `packages/shared/src/content-settings.ts:31`; API chỉ xuất nhãn của các category đang cấu hình. Giá trị gửi lên server giữ nguyên, chỉ label được dịch (`apps/client/src/app/[locale]/news/page.tsx:35`). |
| Nhãn thời lượng video | Thêm `Video.durationTextEn`; schema dòng 61, contract dòng 32, editor dòng 113. Card và detail dùng nhãn EN với dự phòng VI. |
| Tên nhóm footer | Thêm `StaticPage.footerGroupEn`; schema dòng 103, editor dòng 130. API footer chỉ chọn trường công khai và xuất `groupEn`; renderer chọn EN với dự phòng VI. |
| Summary chỉ có bản Anh | Detail kiểm tra summary đã resolve, thay cho kiểm tra riêng cột VI; không còn ẩn summary khi `summary = null` và `summaryEn` có nội dung (`apps/client/src/app/[locale]/news/[slug]/page.tsx:37,64`). |
| Key chuyên mục đặc biệt | API và client đều kiểm `Object.hasOwn` và kiểu chuỗi trước lookup; `__proto__` / `constructor` không đọc thuộc tính kế thừa. Có renderer regression và API integration regression. |

Migration `packages/db/prisma/migrations/20261119151407_add_content_english_fields/migration.sql` được tạo bằng `prisma migrate dev --create-only --name add_content_english_fields`, review trước khi áp dụng. SQL chỉ thêm ba cột `TEXT` nullable; dữ liệu cũ giữ nguyên và nhận `null`. Không dùng `db push`, không chạy migration lên DB dev. Agent API đã áp migration thứ 18 lên DB test riêng trước lượt tích hợp; lượt Playwright dùng đúng schema đó.

Audit và danh sách trường trung lập được ghi tại `apps/client/src/i18n/pick-localized.ts:3`: các tên/nội dung giải, nội dung thi đấu, bảng xếp hạng, hồ sơ, CMS, vai trò nhà tài trợ và alt ảnh dùng cột EN khi có. Các identifier/code, số/điểm, thời gian định dạng theo locale, URL, mã quốc gia và tên riêng được giữ nguyên theo chính sách đã khai báo; không coi các nhãn CMS vừa bổ sung là trường trung lập.

## Cô lập môi trường và dữ liệu

- Đọc cấu hình hoạt động bằng `process.loadEnvFile`, không đọc dòng comment và không sửa `.env`.
- DB duy nhất dùng cho migrate/fixture trong đợt này: `localhost:5433/kamito_tt_phase12_test`. DB nguồn `kamito_tt_dev` không được migrate hoặc seed.
- Runner kế thừa URL đang hoạt động rồi đổi pathname sang DB test riêng; chỉ truyền `DATABASE_URL`, `MIGRATE_CONFIRM_TARGET`, `APP_ENV=test`, `QUEUE_PREFIX=kamito-tt:test` qua môi trường của process con. Không in credentials.
- `confirmedTestDatabaseUrl` tại `apps/client/tests/e2e/support/test-database-target.ts` chặn host không phải loopback, tên DB không kết thúc `_test`, protocol sai và confirmation không khớp. Guard được gọi trước cả global API seed lẫn fixture CMS; bỏ target dev hardcode cũ.
- API integration và Playwright dùng DB theo lượt, không chạy đồng thời các fixture thay đổi `AppSetting`. Playwright chạy `--workers=1`.
- API chạy port 3313, client port 3314, production build local (`E2E_API_MODE=dist`, `E2E_NEXT_MODE=start`). Server tạm đã dừng sau teardown. WSL PostgreSQL/Redis hiện có được giữ nguyên.

## Lệnh kiểm chứng và kết quả

Các lệnh pnpm chạy với Node tại `C:\nvm4w\nodejs`. Admin shell tests cần Git `bin`/`usr\bin` có trong PATH của process.

| Lệnh | Kết quả |
|---|---|
| `pnpm --filter @kamito/shared build` | Đạt sau khi thêm setting/contract. |
| `pnpm --filter @kamito/db build` | Đạt; generate Prisma và TypeScript, gồm bản sửa default Prisma log `[]`. |
| `pnpm --filter @kamito/api typecheck` | Đạt trên nguồn cuối, gồm bản sửa logger Better Auth và own-key label. |
| `pnpm --filter @kamito/api lint` | Đạt. |
| `pnpm --filter @kamito/api build` | Đạt trước khi chạy Playwright qua dist. |
| `pnpm --filter @kamito/client test` | 19 file / 72 test đạt, gồm 4 renderer localization và 2 DB-target guard. |
| `pnpm --filter @kamito/client typecheck` | Đạt. |
| `pnpm --filter @kamito/client lint` | Đạt. |
| `pnpm --filter @kamito/client build` | Đạt; Next.js 16.4.5, có `/sitemap.xml` và `/sitemap/[id]`. |
| `pnpm --filter @kamito/admin test` | 11/11 đạt sau khi bổ sung shell đã cài vào PATH của process. |
| `pnpm --filter @kamito/admin typecheck` | Đạt. |
| `pnpm --filter @kamito/admin lint` | Đạt. |
| `pnpm --filter @kamito/admin build` | Đạt; còn cảnh báo bundle lớn hiện hữu. |
| `pnpm --filter @kamito/client exec playwright test site-chrome-and-seo.spec.ts content-pages.spec.ts rankings-and-players.spec.ts --workers=1 --reporter=list,json` | 55 đạt / 5 bỏ qua có chủ đích / 0 lỗi / 0 flaky. |

API integration do agent kiểm API chạy trên cùng DB test: 7 spec / 32 ca duy nhất đạt. Bằng chứng JSON: `test-results/phase12-api-sitemap.json` (10), `phase12-api-cms-permissions.json` (21, gồm bản articles 4 ca cũ), `phase12-api-articles-final.json` (5 ca articles mới thay cho 4 ca cũ). Không cộng trùng các lượt rerun.

Log local: `test-results/phase12-client-final.log`, `phase12-db-api-final.log`, `phase12-admin-final.log`, `phase12-public-playwright.log`. JSON Playwright tại `test-results/phase12-public-playwright.json`: `expected=55`, `skipped=5`, `unexpected=0`, `flaky=0`, `duration=66393.837ms`.

### Phạm vi Playwright đã chạy thật

- Card/detail tin, video và trang tĩnh, chặn draft, rich HTML đã sanitize, nhãn EN mới, summary chỉ có EN và footer EN.
- Lọc/phân trang SSR, hoạt động khi tắt JavaScript, giao diện desktop/mobile không tràn ngang.
- Locale negotiation, chuyển locale giữ query, lỗi 404 EN, canonical/hreflang/Twitter/SportsEvent, sitemap và robots.
- Header bảo mật và CSP report collector; collector log chỉ giữ origin của URL theo bản sửa privacy.
- Bảng xếp hạng đã công bố, tìm không dấu, lọc CLB, hồ sơ riêng tư/noindex, redirect slug cũ và merged profile.
- Luồng admin publish thật → BullMQ worker namespace riêng → SSR ranking cache refresh: hai viewport đều đạt trong 10 giây. Artifact lượt cuối `apps/api/test-results/public-ranking-publish-refresh.json` ghi 212ms, một revalidation job hoàn thành.
- Global seed và cleanup API đều đạt; fixture CMS tự dọn các row riêng của lượt chạy.

Năm ca bỏ qua đúng thiết kế: desktop bỏ ba kiểm layout 390px; mobile bỏ desktop navigation semantics và print bracket. Không có test retry hoặc flaky.

YouTube iframe được thay bằng trang provider fixture để không lệ thuộc uptime bên thứ ba. API ứng dụng, PostgreSQL, Redis và worker probe vẫn chạy thật. Không dùng kết quả này để tuyên bố CDN/S3, YouTube thật hay luồng quản trị giải toàn bộ đã nghiệm thu.

Ảnh của lượt chạy được giữ tại `reports/screenshots-261119-phase-12-public/` cạnh báo cáo này; đã đọc trực quan `rankings-list-390.png` và `player-profile-1440.png`, nội dung nằm trong viewport và không thấy chồng nhãn. Test trước đó ghi vào đường dẫn ảnh lịch sử phase 10: đã chuyển đủ tám ảnh mới sang phase 12 rồi phục hồi chính xác tám ảnh lịch sử từ HEAD theo baseline sạch. Test hiện nhận `E2E_SCREENSHOT_DIR`, mặc định dùng `testInfo.outputPath('screenshots')`, nên không tiếp tục ghi đè ảnh lịch sử. Thay đổi đường dẫn đã qua client typecheck sau lượt Playwright; không thay đổi logic kiểm giao diện. Print evidence: `apps/client/test-results/artifacts/site-chrome-and-seo-print--5a22f-bracket-without-site-chrome-desktop/draws-ms-print.png`.

## Lỗi môi trường đã xử lý và giới hạn

- Lượt admin test đầu trên PowerShell thiếu `sh` trong PATH: 7 đạt / 4 rớt `spawnSync sh ENOENT`. Git shell đã cài sẵn; thêm đường dẫn vào môi trường process rồi rerun đủ 11/11 đạt, không sửa test để bỏ qua.
- `next start` local cảnh báo project cấu hình `output: standalone`; suite vẫn phục vụ production build và đạt. Lượt này không kiểm container standalone entrypoint.
- Có warning `NO_COLOR`/`FORCE_COLOR` và cảnh báo deprecation của pg khi seed; không có test lỗi. Không mở rộng scope để thay đổi phụ thuộc trong đợt này.
- CSP vẫn `Content-Security-Policy-Report-Only` theo gate yêu cầu thu report staging sạch. Chưa có bằng chứng staging để chuyển sang enforce.
- Lighthouse/axe/tải nhẹ, E2E toàn luồng trên staging, staging report CSP sạch và nghiệm thu hạ tầng thật vẫn là phần việc mở.
