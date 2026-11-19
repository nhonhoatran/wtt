# Phase 11 — CMS: tin tức, video nhúng, nhà tài trợ, trang tĩnh, liên hệ, trang chủ

## Context Links

- [Site tham chiếu §3.1 trang chủ, §3.9 tin, §3.10 video, §3.12 trang phụ + liên hệ, §5.2 Article/Video/sponsor/static page](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md) + ảnh `01, 14, 15`
- [Admin + hạ tầng: B.3 hẹn giờ đăng (delayed job)](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Brainstorm §5 — phần cắt được nếu trễ](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Red team đã phân xử: nhóm 5, 10, 14, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- [QA public với API mock](../reports/tester-261119-phase-11-cms-mock-ui.md), [QA admin với API mock](../reports/tester-261119-phase-11-admin-mock-ui.md), [review mã CMS](../reports/code-reviewer-261119-phase-11-cms.md) — 2026-11-19

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P2. Status: in-progress (**10/13 checkbox**). Code, kiểm tra tĩnh/unit và giao diện 1440/390 với API mock đã đạt; guard Back/Forward đã kiểm trên ứng dụng admin thật với API mock. Còn áp dụng migration, chạy API tích hợp/Playwright với dịch vụ thật và deploy staging.
- CMS gọn **6 model**: `Article` (1 trường chuyên mục), `ArticleEvent`, `Video`, `Sponsor` (link giải tùy chọn + thứ tự), `StaticPage`, `ContactMessage`. Trang chủ hoàn chỉnh.
- Dời giai đoạn sau: link xem trước có token, tự lưu nháp 30 s, CRUD chuyên mục video/liên hệ, sắp thứ tự khối trang chủ, vai trò tài trợ dạng danh mục, gắn tin/video với VĐV.
- Thứ tự cắt khi trễ nằm trong danh sách chung ở plan.md; hardening (phase 12) không bị cắt trước phase này.

## Key Insights

- Trình soạn thảo rich text tích hợp TipTap core (MIT); admin đang ghim `@tiptap/react` 3.33.1, tương thích React 19 trong cấu hình hiện tại và typecheck đạt. Ngày 2026-11-19, npm ghi 3.34.0 là bản mới nhất. Dùng API headless hiện có; không dùng Tiptap UI Components, tài liệu chính thức còn cảnh báo hỗ trợ React 19 của bộ UI chưa đầy đủ. Nguồn: [npm @tiptap/react](https://www.npmjs.com/package/%40tiptap/react), [Tiptap React install](https://tiptap.dev/docs/editor/getting-started/install/react), [Tiptap UI compatibility](https://tiptap.dev/docs/ui-components/getting-started/overview).
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
- Sanitizer rich text và bộ test XSS đã có từ phase 04 → dùng lại, không viết mới.
- Video chỉ nhúng: lưu URL, server tách `provider` + `embedId`; host hợp lệ là allowlist trong env/code (`VIDEO_EMBED_HOSTS`), không phải AppSetting; trang công khai dùng ảnh thu nhỏ + bấm mới tải iframe (nhẹ trang).
- Hẹn giờ đăng: delayed job BullMQ + job quét định kỳ làm lưới an toàn (job delayed bị mất vẫn được đăng).
- Tái dùng mẫu code hiện có: Refine/antd, `MediaUploadField`, `RichTextField`, bộ chọn giải tìm phía server và `useUnsavedGuard` của admin; `FilterForm`, `PaginationLinks`, `pageMetadata`, dictionary và design token của site công khai. Không có skill `ui-consistency` trong bộ skill hiện tại; finding/planning được đối chiếu theo mẫu code, còn kiểm tra trực quan có ảnh và báo cáo QA mock riêng.
- Editor dùng bố cục responsive hai cột, tab vi/en, cảnh báo bản dịch thiếu, lưu nháp/đăng ngay/hẹn giờ. Dán ảnh đi qua upload-intent và chỉ chèn ảnh `READY` có URL HTTPS; môi trường local cần `MEDIA_PUBLIC_BASE_URL` HTTPS để dùng luồng này.
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- Form liên hệ đi Browser → Next (Server Action) → API; API chỉ thấy IP container → rate limit theo IP thật đặt ở Next/Traefik.

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 đã có khung `/settings` (registry + API + trang). Các key `news.categories`, `home.sections` cùng page size, contact rate/retention, số mục trang chủ và chu kỳ sweep được đăng ký qua AppSetting ở phase 11. Resource `content` trong ma trận quyền chỉ ADMIN.

## Requirements

Functional
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Tin: tiêu đề/sapo/nội dung vi + en, slug, ảnh bìa, chuyên mục (chọn từ danh sách trong AppSetting `news.categories`), tác giả, nổi bật, gắn giải (nhiều-nhiều), trạng thái `DRAFT/SCHEDULED/PUBLISHED/ARCHIVED`, `publishAt`.
- Video: URL (`https:`, host trong allowlist), tiêu đề vi/en, gắn 1 giải (tùy chọn), nổi bật.
- Nhà tài trợ: tên, logo sáng/tối, link (`https:`), nhãn vai trò vi/en dạng text (vd "Bóng thi đấu chính thức"), giải (trống = toàn site), thứ tự.
- Trang tĩnh: slug, tiêu đề/nội dung vi/en, hiện ở footer (nhóm cột footer + thứ tự).
- Liên hệ: form công khai (tên, email, SĐT tùy chọn, tổ chức, nội dung); hộp thư admin (mới/đã đọc/lưu trữ, lọc, tìm).
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- `ContactMessage` xóa tự động sau số ngày lưu cấu hình ở `contact.retentionDays` (job dọn định kỳ).
- Trang chủ: các khối giải nổi bật (hero) → giải sắp tới/đang diễn ra → tin nổi bật → video mới → top BXH → nhà tài trợ; thứ tự cố định, bật/tắt từng khối bằng AppSetting `home.sections`.
- Trang giải tab Tổng quan: tin/video liên quan; nhà tài trợ của giải.

Non-functional
- HTML bài viết qua sanitizer dùng chung (phase 04): whitelist thẻ/thuộc tính; iframe chỉ từ host trong allowlist; sanitize khi lưu và khi render.
- `/news` danh sách phân trang server; số bài/trang lấy từ setting `news.pageSize`.

## Architecture

Model (migration gộp `20261119090000_add_content_cms`; SQL được tạo và rà soát offline, chưa áp dụng DB)

```prisma
enum ContentStatus { DRAFT SCHEDULED PUBLISHED ARCHIVED }
model Article { id String @id @default(uuid()); slug String @unique; title String; titleEn String?
  summary String?; summaryEn String?; body String /* sanitized HTML */; bodyEn String?
  coverMediaId String?; category String? /* code from AppSetting news.categories */; authorName String?
  isFeatured Boolean @default(false); status ContentStatus @default(DRAFT); publishAt DateTime?; publishedAt DateTime?
  events ArticleEvent[]; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  @@index([status, publishedAt]) }
model ArticleEvent { articleId String; eventId String; @@id([articleId, eventId]) }
model Video { id String @id @default(uuid()); slug String @unique; title String; titleEn String?; url String
  provider String /* youtube | facebook, validated against VIDEO_EMBED_HOSTS */; embedId String
  thumbnailUrl String?; durationText String?; eventId String?; isFeatured Boolean @default(false)
  status ContentStatus @default(DRAFT); publishedAt DateTime? }
model Sponsor { id String @id @default(uuid()); name String; logoMediaId String?; logoDarkMediaId String?
  url String?; roleLabel String?; roleLabelEn String?; eventId String? /* null = site-wide */
  order Int @default(0); isActive Boolean @default(true) }
model StaticPage { id String @id @default(uuid()); slug String @unique; title String; titleEn String?
  body String; bodyEn String?; status ContentStatus @default(DRAFT); footerGroup String?; footerOrder Int? }
enum ContactStatus { NEW READ ARCHIVED }
model ContactMessage { id String @id @default(uuid()); name String; email String
  phone String?; organization String?; message String; status ContactStatus @default(NEW)
  ipHash String; createdAt DateTime @default(now()); @@index([status, createdAt]) }
```

Hẹn giờ đăng (queue `publishing`, tiền tố `QUEUE_PREFIX`)

```
save article with status SCHEDULED and publishAt > now:
  add job publish-article {articleId} delay = publishAt - now, jobId "art-{id}-{epoch(publishAt)}"   // unique per schedule
processor publish-article: reload from DB; if status SCHEDULED and publishAt <= now → PUBLISHED, publishedAt = now
  revalidate ["articles", "article-{slug}", "home"]
repeatable job publishing-sweep every configured interval: publish SCHEDULED with publishAt <= now
attempts 5, backoff exponential 10 s
```

- Đổi lịch đăng: job cũ vẫn có thể chạy nhưng processor nạp lại từ DB và bỏ qua nếu `publishAt` chưa tới → không cần lưu job id.

API

| Method | Path |
|---|---|
| CRUD | `/admin/articles`, `/admin/videos`, `/admin/sponsors?filter[eventId]`, `/admin/static-pages` (list, get-one, create, update, delete) |
| POST | `/admin/sponsors/reorder` (`eventId`, `orderedIds` của trang hiện tại; sắp lại trong transaction, giữ vị trí tương đối của các dòng ngoài trang) |
| GET/PATCH | `/admin/contact-messages?filter[status]&q&page`, `PATCH .../:id {status}` |
| GET | `/public/articles?category&event&page`, `/public/articles/:slug`, `/public/videos?page`, `/public/videos/:slug`, `/public/pages/:slug`, `/public/footer`, `/public/sponsors?eventSlug`, `/public/home` |
| POST | `/public/contact` (chỉ nhận từ Server Action của Next qua `SSR_INTERNAL_SECRET`, kèm IP thật do Next chuyển; honeypot, validate) |

Module Nest triển khai tại `modules/content/` và `modules/public-content/`; parser ở `modules/videos/video-url-parser.ts`. Mutation CMS và audit metadata trước/sau nằm trong cùng transaction; enqueue/cache refresh chạy sau commit và trả cảnh báo khi thất bại. Reorder tài trợ khóa theo phạm vi giải/toàn site và ghi audit trong transaction. Worker dùng `publishing-worker.ts` và `processors/publishing-processors.ts` cho đăng bài, sweep và dọn liên hệ.

Route client: `news/page.tsx` (`?category&page`), `news/[slug]/page.tsx`, `videos/page.tsx`, `videos/[slug]/page.tsx`, `pages/[slug]/page.tsx`, `contact/page.tsx` (form gửi qua Server Action → API; rate limit theo IP thật ở Server Action/biên; thông báo thành công/lỗi tại field), `page.tsx` (trang chủ). Tag: `articles`, `article-{slug}`, `videos`, `pages`, `sponsors`, `home`, `settings`.

Màn admin
- **Nội dung**: Tin tức, Video, Trang tĩnh, Hộp thư liên hệ (badge số tin mới). **Nhà tài trợ**: Nhà tài trợ. Hub giải → tab **Tài trợ** (danh sách nhà tài trợ lọc theo giải).
- Viết tin: "Viết bài" (1) → tiêu đề (slug tự sinh), nội dung (dán ảnh → upload qua upload-intent phase 04 tự động), cột phải: chuyên mục (nhớ lần trước), ảnh bìa, gắn giải (ô tìm), nổi bật; tab "English" cạnh "Tiếng Việt" (thiếu bản en chỉ là cảnh báo vàng, không chặn). Nút chính "Đăng ngay" (2, xác nhận) hoặc mũi tên cạnh nút → "Hẹn giờ" chọn ngày giờ. "Lưu nháp" bằng tay; rời trang khi có thay đổi chưa lưu → hỏi xác nhận.
- Thêm video: dán URL (1) → server tự lấy `embedId` + ảnh thu nhỏ; tiêu đề điền gợi ý nếu lấy được → "Đăng" (2).
- Tài trợ cho giải: tab Tài trợ → "Thêm" → chọn/tạo nhà tài trợ, nhập nhãn vai trò → kéo thả thứ tự.
- Admin đã chuyển sang data router (`createBrowserRouter`) và `useBlocker`; guard bảo vệ liên kết trong app, native Back/Forward và đóng tab. Browser mock đã kiểm hủy/xác nhận Back/Forward, giữ nháp và lưu thành công không xuất hiện xác nhận thừa; wrapper parser giữ ID của route cũ.

## Related Code Files

Đã triển khai
- Model trong `packages/db/prisma/schema/content.prisma`, bản SQL offline tại `packages/db/prisma/migrations/20261119090000_add_content_cms/migration.sql`; validate schema và rà diff đạt. Một migration gộp thay cho bốn file dự kiến; chưa áp dụng DB.
- API tại `apps/api/src/modules/content/`, `public-content/` và `videos/video-url-parser.ts`; worker tại `apps/worker/src/publishing-worker.ts` và `processors/publishing-processors.ts`.
- Admin tại `apps/admin/src/resources/content/`, `resources/sponsors/`, editor JSON setting, `components/rich-text-image-upload.ts` và `pages/event-hub/sponsors-tab.tsx`.
- Client tại `apps/client/src/app/[locale]/{news,videos,pages,contact}/`, component nội dung dùng chung và tích hợp trang chủ/footer/trang giải/sitemap.
- Unit test bao phủ sanitizer, JSON-LD, parser video, DTO, audit/mutation, reorder tài trợ, race đăng bài, chọn giải trang chủ, image policy và trạng thái TipTap thật. Spec tích hợp CMS tại `apps/api/test/articles.e2e-spec.ts`, `cms-resources.e2e-spec.ts`; spec trình duyệt tại `apps/client/tests/e2e/content-{pages,home,contact}.spec.ts`. Các spec cần DB thật chưa chạy; browser mock chạy ứng dụng thật đã được kiểm riêng.

Modify: `apps/client/src/app/[locale]/page.tsx`, `events/[slug]/page.tsx` (tin/video/tài trợ), `site-footer.tsx` (trang tĩnh + nhà tài trợ toàn site), `menu-groups.ts`, `event-hub-page.tsx`, `packages/shared/src/app-setting-registry.ts` (`news.categories`, `home.sections`), `apps/api/src/modules/revalidation/cache-tags.ts`, `apps/client/src/app/sitemap.ts`.

## Implementation Steps

1. Đã kiểm chứng TipTap core, giấy phép, phiên bản mới nhất, React 19 và tích hợp hiện có; kết quả ở Key Insights.
2. Đã đối chiếu và tái dùng mẫu code admin/public nêu ở Key Insights. Không có quy trình skill `ui-consistency`; kiểm tra giao diện có ảnh 1440/390 với API mock, giới hạn ghi tại báo cáo QA.
3. Đã tạo migration SQL offline và rà diff/schema. Target được in là `localhost:5433/kamito_tt_dev`; đang chờ xác nhận rõ target trước khi áp dụng migration.
4. Đã có parser URL video + unit test; dùng sanitizer/HTTPS validator của phase 04.
5. Đã có modules admin/public, queue `publishing`, job quét lịch đăng và dọn liên hệ, audit atomic và cảnh báo enqueue/revalidation; chưa kiểm thử tích hợp với DB.
6. Đã có editor bài responsive/tab/action/dán ảnh, màn admin và kéo thả tài trợ bằng chuột/bàn phím trong hub giải; endpoint reorder xử lý phân trang trong transaction.
7. Đã có route công khai, trang chủ, footer, sitemap, cache tags và JSON-LD `NewsArticle`/`VideoObject`.
8. Đã bổ sung/typecheck 16 ca API tích hợp và liệt kê 18 ca Playwright CMS; chưa chạy các ca này. Cần kiểm tra hẹn giờ đăng, hộp thư liên hệ, bật/tắt khối trang chủ qua AppSetting trên DB đã migrate.
9. Đã kiểm giao diện public/admin ở 1440/390 bằng ứng dụng thật nối API mock và kiểm guard native Back/Forward; chưa deploy staging, còn chờ blocker hạ tầng phase 01. Kiểm tra mock không thay cho DB/Redis/storage thật.

## Todo List

- [x] Kiểm chứng rich text editor (TipTap core MIT, bản 3.33.1 đang cài; npm hiện ghi 3.34.0 mới nhất; API headless hiện có typecheck với React 19. UI Components chưa dùng vì tài liệu cảnh báo hỗ trợ React 19 chưa đầy đủ)
- [x] Đối chiếu/tái dùng mẫu code admin và public (finding-patterns → planning ở mức code; không có skill `ui-consistency`)
- [x] Tạo 6 model và migration SQL; schema/diff đã kiểm offline, chưa áp dụng DB
- [ ] Xác nhận target `localhost:5433/kamito_tt_dev`, áp dụng migration và kiểm tra DB
- [x] Video URL parser + unit test; dùng sanitizer phase 04
- [x] API admin/public + queue publishing (delayed + sweep) + dọn liên hệ
- [x] Màn admin Nội dung, Nhà tài trợ, tab Tài trợ
- [x] Trang công khai tin/video/trang tĩnh/liên hệ/trang chủ (phạm vi code)
- [x] Metadata structured `NewsArticle`/`VideoObject` + unit test
- [ ] Chạy 16 ca API tích hợp + 18 ca Playwright CMS (đã bổ sung/typecheck/liệt kê, chưa thực thi)
- [x] Guard dữ liệu chưa lưu cho Browser Back/Forward, liên kết trong app và đóng tab; browser mock kiểm hủy/xác nhận, giữ nháp và lưu không báo nhầm
- [x] Kiểm tra trực quan thủ công ở 1440 + 390 trên ứng dụng public/admin thật với API mock; có ảnh, chưa xác nhận dịch vụ thật/staging
- [ ] Deploy staging — chờ cổng phase 01

## Kiểm chứng cục bộ — 2026-11-19

- Prisma validate và kiểm tra schema/SQL offline đạt; API typecheck đạt sau khi `pnpm install --frozen-lockfile` sửa symlink Better Auth. Typecheck/lint/build shared, DB, API, worker, admin và client đạt; bản sửa nhãn CMS admin cuối cũng đã qua typecheck/lint/build.
- Các suite đạt **383/383 ca**: API dưới `src` **177/177**, shared **101/101**, worker **44/44**, client **50/50**, admin **11/11** (Windows: 3 image policy + 3 trạng thái TipTap thật; WSL: 5 entrypoint). Các số liệu ngày 2026-11-17 trong plan tổng là ảnh chụp lịch sử.
- Public: bản Next production thật nối API fixture bộ nhớ, **7 route × 2 viewport = 14/14 lượt đạt**, 7 nhóm tương tác đạt ở cả 1440/390; không `pageerror` hoặc tràn ngang ở lượt cuối, đã mở ảnh kiểm trực quan. Bốn lỗi ảnh tin, grid/hero trang chủ, filter tin và thumbnail video đã được sửa và kiểm lại.
- Admin: ứng dụng Vite thật với API/media mock, **8/8 ca browser + 4/4 kiểm payload/form đạt**; đã xem ảnh editor 1440/390. Bao phủ Back/Forward/menu, ID route cũ, body vi/en, ba form sửa, hợp đồng bộ chọn giải và dán ảnh HTTPS/READY/chặn lưu/từ chối URL tương đối.
- Đã đóng lỗi TipTap `setEditable` phát update làm rỗng body, defaults ghi đè dữ liệu Refine và bộ chọn video/tài trợ gửi `filter[isActive]` không được API hỗ trợ. Review không còn Critical/P1/P2 trong phạm vi mã đã rà; xem báo cáo để biết giới hạn.
- **16 ca API tích hợp và 18 ca Playwright DB E2E chưa thực thi**; mới kiểm tra type và danh sách ca. Migration SQL vẫn là bản offline, chưa áp dụng; không truy vấn/seed PostgreSQL trong các lượt browser mock. Chưa xác nhận pipeline DB–Redis/BullMQ–storage thật hoặc staging.

## Success Criteria

- Payload XSS (`<script>`, `onerror=`, `javascript:` URL, iframe host lạ) bị loại khỏi HTML lưu DB (bộ test phase 04 chạy trên body tin/trang tĩnh).
- Bài hẹn giờ đăng đúng giờ ± 1 phút, kể cả khi xóa job delayed thủ công (sweep bắt lại).
- Gửi liên hệ vượt giới hạn trong cửa sổ thời gian cấu hình → 429 ở Next/biên; honeypot có giá trị → bỏ qua im lặng; tin nhắn quá `contact.retentionDays` bị xóa. Giới hạn và cửa sổ thời gian lấy từ AppSetting.
- Đăng 1 bài: 2 click sau khi soạn; thêm 1 video: dán URL + 1 click; URL video ngoài allowlist → lỗi tại field.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Trễ tiến độ dồn về phase này | Cao × Trung bình | Danh sách cắt chung trong plan.md; CMS đã gọn |
| Editor không hợp antd/React | Thấp × Trung bình | Kiểm ở bước 1; ứng viên thay thế |
| Hồi quy guard khi đổi router/route cũ | Thấp × Trung bình | Data router + `useBlocker`; browser mock đã kiểm native Back/Forward, menu, lưu và ID route cũ; tiếp tục hồi quy ở E2E dịch vụ thật |
| Dán ảnh local không có URL HTTPS công khai | Trung bình × Thấp | Chỉ chèn ảnh READY/HTTPS; cấu hình `MEDIA_PUBLIC_BASE_URL` HTTPS rồi kiểm E2E |
| Spam form liên hệ | Trung bình × Thấp | Rate limit theo IP thật + honeypot; captcha để sau |

Rollback: bảng mới; tắt khối trang chủ bằng AppSetting; revert app.

## Security Considerations

- Sanitize khi **lưu** và khi render (không tin client); CSP report-only từ phase 08, enforce ở phase 12; iframe `sandbox` + `referrerpolicy`.
- Liên hệ: lưu `ipHash` (hash + `IP_HASH_SALT` từ env), không lưu IP thô; chỉ `ADMIN` đọc hộp thư; xóa sau thời hạn lưu.
- Mọi trường URL (`Sponsor.url`, `Video.url`) chỉ `https:`.

## Next Steps

- Xác nhận target `localhost:5433/kamito_tt_dev` trước khi áp dụng migration; chạy API tích hợp/Playwright CMS sau khi DB sẵn sàng.
- Chạy lại luồng CMS trên DB/Redis/storage thật sau khi migrate; staging phụ thuộc blocker hạ tầng phase 01. Kết quả mock và ảnh 1440/390 đã có không thay cho cổng này.
- Phase 12: hoàn thiện bản en, SEO, hardening, ra mắt.
