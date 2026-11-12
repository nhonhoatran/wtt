# Phase 11 — CMS: tin tức, video nhúng, nhà tài trợ, trang tĩnh, liên hệ, trang chủ

## Context Links

- [Site tham chiếu §3.1 trang chủ, §3.9 tin, §3.10 video, §3.12 trang phụ + liên hệ, §5.2 Article/Video/sponsor/static page](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md) + ảnh `01, 14, 15`
- [Admin + hạ tầng: B.3 hẹn giờ đăng (delayed job)](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Brainstorm §5 — phần cắt được nếu trễ](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Red team đã phân xử: nhóm 5, 10, 14, 15](./reports/red-team-261111-1614-adjudicated-findings.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P2. Status: pending. Tuần 16–17 (≈5 ngày công, gồm ui-consistency ≈0,5 ngày).
- CMS gọn **6 model**: `Article` (1 trường chuyên mục), `ArticleEvent`, `Video`, `Sponsor` (link giải tùy chọn + thứ tự), `StaticPage`, `ContactMessage`. Trang chủ hoàn chỉnh.
- Dời giai đoạn sau: link xem trước có token, tự lưu nháp 30 s, CRUD chuyên mục video/liên hệ, sắp thứ tự khối trang chủ, vai trò tài trợ dạng danh mục, gắn tin/video với VĐV.
- Thứ tự cắt khi trễ nằm trong danh sách chung ở plan.md; hardening (phase 12) không bị cắt trước phase này.

## Key Insights

- Trình soạn thảo rich text là "chức năng có sẵn" → tích hợp thư viện, không tự viết. Ứng viên: TipTap (core MIT) — giấy phép, bản mới nhất, mức tích hợp với antd **chưa kiểm chứng**; kiểm ở bước 1.
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
- Sanitizer rich text và bộ test XSS đã có từ phase 04 → dùng lại, không viết mới.
- Video chỉ nhúng: lưu URL, server tách `provider` + `embedId`; host hợp lệ là allowlist trong env/code (`VIDEO_EMBED_HOSTS`), không phải AppSetting; trang công khai dùng ảnh thu nhỏ + bấm mới tải iframe (nhẹ trang).
- Hẹn giờ đăng: delayed job BullMQ + job quét định kỳ làm lưới an toàn (job delayed bị mất vẫn được đăng).
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- Form liên hệ đi Browser → Next (Server Action) → API; API chỉ thấy IP container → rate limit theo IP thật đặt ở Next/Traefik.

## Requirements

Functional
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Tin: tiêu đề/sapo/nội dung vi + en, slug, ảnh bìa, chuyên mục (chọn từ danh sách trong AppSetting `news.categories`), tác giả, nổi bật, gắn giải (nhiều-nhiều), trạng thái `DRAFT/SCHEDULED/PUBLISHED/ARCHIVED`, `publishAt`.
- Video: URL (`https:`, host trong allowlist), tiêu đề vi/en, gắn 1 giải (tùy chọn), nổi bật.
- Nhà tài trợ: tên, logo sáng/tối, link (`https:`), nhãn vai trò vi/en dạng text (vd "Bóng thi đấu chính thức"), giải (trống = toàn site), thứ tự.
- Trang tĩnh: slug, tiêu đề/nội dung vi/en, hiện ở footer (nhóm cột footer + thứ tự).
- Liên hệ: form công khai (tên, email, SĐT tùy chọn, tổ chức, nội dung); hộp thư admin (mới/đã đọc/lưu trữ, lọc, tìm).
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- `ContactMessage` xóa tự động sau `CONTACT_RETENTION_DAYS` (job dọn định kỳ).
- Trang chủ: các khối giải nổi bật (hero) → giải sắp tới/đang diễn ra → tin nổi bật → video mới → top BXH → nhà tài trợ; thứ tự cố định, bật/tắt từng khối bằng AppSetting `home.sections`.
- Trang giải tab Tổng quan: tin/video liên quan; nhà tài trợ của giải.

Non-functional
- HTML bài viết qua sanitizer dùng chung (phase 04): whitelist thẻ/thuộc tính; iframe chỉ từ host trong allowlist; sanitize khi lưu và khi render.
- `/news` danh sách phân trang server, `NEWS_PAGE_SIZE` bài/trang (env, mặc định ví dụ 12).

## Architecture

Model (migrations `add_articles`, `add_videos`, `add_sponsors`, `add_static_pages_and_contact`)

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
repeatable job publishing-sweep every N minutes (env, default example 5): publish SCHEDULED with publishAt <= now
attempts 5, backoff exponential 10 s
```

- Đổi lịch đăng: job cũ vẫn có thể chạy nhưng processor nạp lại từ DB và bỏ qua nếu `publishAt` chưa tới → không cần lưu job id.

API

| Method | Path |
|---|---|
| CRUD | `/admin/articles?filter[status]&filter[category]&filter[eventId]&q&page&sort`, `/admin/videos`, `/admin/sponsors?filter[eventId]`, `/admin/static-pages` |
| GET/PATCH | `/admin/contact-messages?filter[status]&q&page`, `PATCH .../:id {status}` |
| GET | `/public/articles?category&event&page`, `/public/articles/:slug`, `/public/videos?page`, `/public/videos/:slug`, `/public/pages/:slug`, `/public/footer`, `/public/sponsors?eventSlug`, `/public/home` |
| POST | `/public/contact` (chỉ nhận từ Server Action của Next qua `SSR_INTERNAL_SECRET`, kèm IP thật do Next chuyển; honeypot, validate) |

Module Nest: `articles`, `videos`, `sponsors`, `static-pages`, `contact`, `publishing` (enqueue), `public-content`, `public-home`; dùng `common/html/sanitize-rich-html.ts` và `common/validation/https-url.ts` của phase 04. Worker: `publish-article-processor.ts`, `publishing-sweep-processor.ts`, `contact-retention-processor.ts`.

Route client: `news/page.tsx` (`?category&page`), `news/[slug]/page.tsx`, `videos/page.tsx`, `videos/[slug]/page.tsx`, `pages/[slug]/page.tsx`, `contact/page.tsx` (form gửi qua Server Action → API; rate limit theo IP thật ở Server Action/biên; thông báo thành công/lỗi tại field), `page.tsx` (trang chủ). Tag: `articles`, `article-{slug}`, `videos`, `pages`, `sponsors`, `home`, `settings`.

Màn admin
- **Nội dung**: Tin tức, Video, Trang tĩnh, Hộp thư liên hệ (badge số tin mới). **Nhà tài trợ**: Nhà tài trợ. Hub giải → tab **Tài trợ** (danh sách nhà tài trợ lọc theo giải).
- Viết tin: "Viết bài" (1) → tiêu đề (slug tự sinh), nội dung (dán ảnh → upload qua upload-intent phase 04 tự động), cột phải: chuyên mục (nhớ lần trước), ảnh bìa, gắn giải (ô tìm), nổi bật; tab "English" cạnh "Tiếng Việt" (thiếu bản en chỉ là cảnh báo vàng, không chặn). Nút chính "Đăng ngay" (2, xác nhận) hoặc mũi tên cạnh nút → "Hẹn giờ" chọn ngày giờ. "Lưu nháp" bằng tay; rời trang khi có thay đổi chưa lưu → hỏi xác nhận.
- Thêm video: dán URL (1) → server tự lấy `embedId` + ảnh thu nhỏ; tiêu đề điền gợi ý nếu lấy được → "Đăng" (2).
- Tài trợ cho giải: tab Tài trợ → "Thêm" → chọn/tạo nhà tài trợ, nhập nhãn vai trò → kéo thả thứ tự.

## Related Code Files

Create
- `packages/db/prisma/schema.prisma` + 4 migrations
- `apps/api/src/modules/{articles,videos,sponsors,static-pages,contact,publishing,public-content,public-home}/*`, `apps/api/src/modules/videos/video-url-parser.ts` + test
- `apps/worker/src/processors/{publish-article-processor.ts,publishing-sweep-processor.ts,contact-retention-processor.ts}`
- `apps/admin/src/resources/{articles,videos,sponsors,static-pages,contact-messages}/*`, `apps/admin/src/components/{rich-text-editor.tsx,related-events-picker.tsx,publish-button-group.tsx}`, `apps/admin/src/pages/event-hub/sponsors-tab.tsx`
- `apps/client/src/app/[locale]/{news,videos,pages,contact}/...`, `apps/client/src/components/content/{article-card.tsx,article-body.tsx,video-card.tsx,video-embed-facade.tsx,sponsor-strip.tsx,contact-form.tsx}`, `apps/client/src/components/home/*-section.tsx`
- Test: `apps/api/test/{articles.e2e-spec.ts,publishing.e2e-spec.ts,contact.e2e-spec.ts}`, `apps/client/tests/e2e/content-pages.spec.ts`

Modify: `apps/client/src/app/[locale]/page.tsx`, `events/[slug]/page.tsx` (tin/video/tài trợ), `site-footer.tsx` (trang tĩnh + nhà tài trợ toàn site), `menu-groups.ts`, `event-hub-page.tsx`, `packages/shared/src/app-setting-registry.ts` (`news.categories`, `home.sections`), `apps/api/src/modules/revalidation/cache-tags.ts`, `apps/client/src/app/sitemap.ts`.

## Implementation Steps

1. Kiểm chứng TipTap (hoặc ứng viên khác): giấy phép, bản mới nhất, bảo trì, tương thích React 18/19; ghi kết quả vào file này.
2. `ui-consistency:finding-patterns` → `ui-consistency:planning`: admin (form soạn bài 2 cột, nút đăng có tùy chọn); public (thẻ tin, trang bài, thẻ video, dải nhà tài trợ, form liên hệ) tái dùng mẫu phase 08.
3. Migrations → áp dụng DB cục bộ (in host + tên DB).
4. Parser URL video (allowlist host từ env) + test; nối sanitizer/https-url của phase 04.
5. Modules admin + public + queue `publishing` + job dọn liên hệ.
6. Màn admin; tab Tài trợ trong hub giải.
7. Trang công khai + trang chủ + footer; metadata `article`/`video`; sitemap thêm tin/trang tĩnh; đăng ký tag trong `cache-tags.ts`.
8. Playwright e2e: hẹn giờ 1 bài 1 phút → tự hiện; gửi liên hệ → có trong hộp thư; trang chủ bật/tắt khối theo AppSetting.
9. `ui-consistency:verifying` (admin + public, 1440 + 390); deploy staging.

## Todo List

- [ ] Kiểm chứng rich text editor
- [ ] ui-consistency: finding-patterns → planning
- [ ] Migrations articles, videos, sponsors, static pages + contact (6 model)
- [ ] Video URL parser (allowlist env) + test; dùng sanitizer phase 04
- [ ] API admin/public + queue publishing (delayed + sweep) + dọn liên hệ
- [ ] Màn admin Nội dung, Nhà tài trợ, tab Tài trợ
- [ ] Trang công khai tin/video/trang tĩnh/liên hệ/trang chủ
- [ ] Playwright e2e
- [ ] ui-consistency: verifying; deploy staging

## Success Criteria

- Payload XSS (`<script>`, `onerror=`, `javascript:` URL, iframe host lạ) bị loại khỏi HTML lưu DB (bộ test phase 04 chạy trên body tin/trang tĩnh).
- Bài hẹn giờ đăng đúng giờ ± 1 phút, kể cả khi xóa job delayed thủ công (sweep bắt lại).
- Gửi liên hệ lần 4 trong 1 phút từ cùng IP thật → 429 ở Next/biên; honeypot có giá trị → bỏ qua im lặng; tin nhắn quá `CONTACT_RETENTION_DAYS` bị xóa.
- Đăng 1 bài: 2 click sau khi soạn; thêm 1 video: dán URL + 1 click; URL video ngoài allowlist → lỗi tại field.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Trễ tiến độ dồn về phase này | Cao × Trung bình | Danh sách cắt chung trong plan.md; CMS đã gọn |
| Editor không hợp antd/React | Thấp × Trung bình | Kiểm ở bước 1; ứng viên thay thế |
| Spam form liên hệ | Trung bình × Thấp | Rate limit theo IP thật + honeypot; captcha để sau |

Rollback: bảng mới; tắt khối trang chủ bằng AppSetting; revert app.

## Security Considerations

- Sanitize khi **lưu** và khi render (không tin client); CSP report-only từ phase 08, enforce ở phase 12; iframe `sandbox` + `referrerpolicy`.
- Liên hệ: lưu `ipHash` (hash + `IP_HASH_SALT` từ env), không lưu IP thô; chỉ `ADMIN` đọc hộp thư; xóa sau thời hạn lưu.
- Mọi trường URL (`Sponsor.url`, `Video.url`) chỉ `https:`.

## Next Steps

- Phase 12: hoàn thiện bản en, SEO, hardening, ra mắt.
