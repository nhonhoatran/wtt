# Phase 04 — Dữ liệu gốc giải đấu, cấu hình động, upload ảnh, sanitizer

## Context Links

- [Brainstorm §4.2 thực thể, §4.3 cấu hình động](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Site tham chiếu §3.2–3.4, §4 cơ chế giải, §5.2 Event/SubEvent, §7 cấu hình động](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Admin + hạ tầng: B.3 job, D.1 presigned + sharp](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Red team đã phân xử: nhóm 5, 9, 10, 13](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước: [phase-03](./phase-03-admin-auth-rbac-users-and-admin-shell.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: Hoàn thành (chưa deploy staging). ≈8 ngày công (gồm ui-consistency ≈0,5 ngày), làm 2 đợt:
  - **Lát cắt (tuần 4, ≈2 ngày):** model + seed danh mục (nhóm giải, hạng giải, nội dung chuẩn, thể thức trận, luật vòng bảng mặc định), helper list query, giải + nội dung thi đấu tạo tay trong hub (tab Thông tin, Nội dung thi đấu) — chưa có màn danh mục, chưa upload.
  - **Phần còn lại (tuần 7–8, ≈6 ngày):** màn danh mục, địa điểm + bàn, cài đặt hiển thị (AppSetting), tạo nội dung hàng loạt, pipeline upload ảnh, sanitizer rich text + bộ test XSS, ràng buộc xóa.
- Danh mục cấu hình (nhóm giải, hạng giải, nội dung chuẩn, nhóm tuổi/trình độ, thể thức trận, luật vòng bảng), giải, nội dung thi đấu, địa điểm + bàn, AppSetting (chỉ giá trị nghiệp vụ), upload ảnh qua upload-intent + worker mã hóa lại.

## Key Insights

- Tab của trang giải trên site tham chiếu thay đổi theo giải → ở đây tab tự hiện theo dữ liệu (có vòng bảng thì có tab Bảng đấu) + cờ hiển thị trên giải.
- Thể thức trận khác nhau theo vòng (vd vòng loại best of 5, chung kết best of 7) → thể thức gán ở nội dung, ghi đè được theo vòng (phase 06).
- Song ngữ: **quyết định của plan** — mỗi trường nội dung có cặp cột `xxx` (tiếng Việt, bắt buộc) + `xxxEn` (nullable); public đọc `xxxEn ?? xxx`. Lý do: sort/search/index trên cột thường đơn giản hơn JSON; chỉ 2 ngôn ngữ.
- Slug một bản dùng chung cho cả hai ngôn ngữ (sinh từ tên tiếng Việt bỏ dấu, sửa được, unique).
<!-- Red Team: Luồng upload và khả năng truy cập MinIO — 2026-11-11 -->
- Theo reviewer, presigned PUT không ép được dung lượng file → dùng presigned POST có `content-length-range` (MinIO có hỗ trợ hay không: kiểm bằng test trên bản đang chạy) hoặc stream qua API có trần cứng. Không coi là sự thật cho tới khi test chạy.
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
- Sanitizer rich text là kiểm soát bảo mật, không phải tính năng CMS → làm ở đây, **không thuộc danh sách cắt**. Trước khi có sanitizer, `infoBody` lưu/hiển thị dạng text thuần.

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 đã có: khung `/settings` (registry `packages/shared/src/app-setting-registry.ts`, API `GET/PUT/DELETE /api/v1/admin/settings`, trang `apps/admin/src/pages/settings-page.tsx`), `AppSettingsService`. Phase 04 chỉ thêm key nghiệp vụ vào registry, không dựng lại.
- Phân trang admin đã có khung chung: `parsePaginationQuery` (server), `use-list-page-size.ts`, `list-filter-bar.tsx`. Page size mặc định là setting `list.defaultPageSize`; env chỉ là trần.
- ~~Chưa thống nhất: mục "Cài đặt hiển thị" ghi tham số kỹ thuật (upload, import, page size...) ở env theo phase 01, trong khi plan.md yêu cầu tham số vận hành lên `/settings`. Chốt trước khi làm phase 04.~~ **Đã chốt 2026-11-12:** tham số vận hành lên `/settings`, env chỉ làm trần (chi tiết: Kết quả thực hiện).

<!-- Phase 04 sync — 2026-11-14 -->
- ui-consistency: verifying xong, `plans/reports/ui-verifier-261114-phase-04.md` (DONE_WITH_CONCERNS). Kind list và form (Refine `List`/`Create`/`Edit`) chưa hiệu chỉnh; hub tab + modal đã hiệu chỉnh ở phase 07.
- Đăng ký tag revalidate cho mutation của module: `apps/api/src/modules/revalidation/cache-tags.ts` có `event.*` (create, update, publish, unpublish, cancel, uncancel, delete), `subEvent.*` (create, update, delete), `settings.update`, và catalog (`tier.write`, `eventType.write`, `venue.write`, `media.update`, `discipline.write`, `category.write`). Test phủ route: `apps/api/test/cache-tags-coverage.e2e-spec.ts`.
- Chưa làm: deploy + migrate staging (chờ cổng phase 01).

## Requirements

Functional
- CRUD danh mục cấu hình; không xóa được mục đang được dùng → gợi ý "Ẩn" (`isActive=false`).
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Giải: tạo/sửa/công bố/hủy (sao chép giải dời sang giai đoạn sau).
- Nội dung thi đấu: tạo hàng loạt (chọn nhiều nội dung chuẩn × nhóm tuổi/trình độ trong 1 modal).
- Địa điểm + bàn: tạo nhanh N bàn với tiền tố (mặc định lấy từ AppSetting).
- Cài đặt hiển thị: form sinh từ registry key (kiểu, mặc định, mô tả), validate bằng zod. Registry chỉ giữ **giá trị nghiệp vụ**; tham số kỹ thuật (giới hạn upload, loại ảnh, bề rộng biến thể, trần import, thời hạn lưu, page size, host nhúng video) nằm ở env (phase 01). <!-- Sync 2026-11-12: đổi, tham số vận hành lên /settings, env làm trần (xem Kết quả thực hiện) -->.
- Upload ảnh (logo, ảnh nền, banner): upload-intent → upload → worker kiểm + mã hóa lại → admin thấy trạng thái.
<!-- Red Team: Luật vòng bảng cho walkover/bỏ cuộc/rút lui — 2026-11-11 -->
- Luật vòng bảng cấu hình được: điểm thắng/thua/thua walkover/**thua chưa hết trận** (`pointsUnfinishedLoss`); cách tính ván/điểm cho trận không đấu hết (walkover, bỏ cuộc); cách xử lý VĐV rút lui giữa vòng bảng.
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
- Mọi trường URL (`ticketUrl`, `mapUrl`…) chỉ nhận `https:` (kiểm ở server, test).
- `infoBody` dùng rich text qua sanitizer dùng chung; sanitize khi **lưu** và khi **render**.

Non-functional
- Mọi danh sách admin phân trang/lọc/sắp xếp ở server; sort whitelist.
- Upload: giới hạn loại + dung lượng đọc từ env; worker kiểm dung lượng (`HeadObject`) trước khi tải, xác minh loại thật bằng `sharp` metadata.

## Architecture

Model Prisma (migration `add_tournament_master_data`, `add_media_assets`)

<!-- Red Team: Luật vòng bảng cho walkover/bỏ cuộc/rút lui — 2026-11-11 -->
```prisma
model Tier { id String @id @default(uuid()); code String @unique; name String; nameEn String?
  colorHex String; logoMediaId String?; backgroundMediaId String?; order Int @default(0); isActive Boolean @default(true)
  eventTypes EventType[] }
model EventType { id String @id @default(uuid()); tierId String; tier Tier @relation(...); code String @unique
  name String; nameEn String?; colorHex String?; logoMediaId String?; backgroundMediaId String?
  order Int @default(0); isActive Boolean @default(true); events Event[] }   // key of ranking rules
enum CategoryKind { AGE SKILL OPEN }
model Category { id String @id @default(uuid()); kind CategoryKind; code String @unique; name String; nameEn String?
  minAge Int?; maxAge Int?; order Int @default(0); isActive Boolean @default(true) }
enum CompetitorKind { SINGLES DOUBLES }          // TEAM added later
enum GenderRule { MEN WOMEN MIXED OPEN }
model Discipline { id String @id @default(uuid()); code String @unique /* MS, WS, MD, WD, XD */
  name String; nameEn String?; competitorKind CompetitorKind; genderRule GenderRule; order Int; isActive Boolean }
model MatchFormat { id String @id @default(uuid()); name String; nameEn String?; bestOf Int /* 5 */; pointsPerGame Int /* 11 */
  winBy Int /* 2 */; estimatedMinutes Int /* 30 */; isDefault Boolean @default(false) }
enum UnfinishedMatchScoring { COUNT_PLAYED_ONLY AWARD_REMAINING_TO_WINNER }
enum GroupWithdrawalPolicy { KEEP_PLAYED_RESULTS VOID_ALL_RESULTS }
model GroupScoringRule { id String @id @default(uuid()); name String; nameEn String?
  pointsWin Int /* 2 */; pointsLoss Int /* 1 */; pointsWalkoverLoss Int /* 0 */; pointsUnfinishedLoss Int /* 1 */
  unfinishedMatchScoring UnfinishedMatchScoring   // how walkover/retired matches count games and points
  awardedGamePoints Int?                          // points per awarded game when AWARD_REMAINING_TO_WINNER, e.g. 11
  withdrawalPolicy GroupWithdrawalPolicy?         // null = not decided yet: mid-group withdrawal is blocked until set
  tiebreakers Json /* ordered list of TiebreakCriterion */; isDefault Boolean }
model Venue { id String @id @default(uuid()); name String; nameEn String?; address String?; city String?
  mapUrl String?; tables VenueTable[] }
model VenueTable { id String @id @default(uuid()); venueId String; code String /* T01 */; displayName String?
  order Int; isActive Boolean @default(true); @@unique([venueId, code]) }
enum PublishStatus { DRAFT PUBLISHED }
model Event { id String @id @default(uuid()); slug String @unique; name String; nameEn String?; shortName String?
  eventTypeId String; venueId String?; city String?; startDate DateTime @db.Date; endDate DateTime @db.Date
  timezone String; publishStatus PublishStatus @default(DRAFT); isCancelled Boolean @default(false)
  isFeatured Boolean @default(false); ticketUrl String?; showTicket Boolean @default(false); presentedBy String?
  bannerMediaId String?; summary String?; summaryEn String?; infoBody String?; infoBodyEn String?
  showInfoTab Boolean @default(true); subEvents SubEvent[]; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  @@index([startDate]) }
enum SubEventFormat { KNOCKOUT GROUP_KNOCKOUT }
model SubEvent { id String @id @default(uuid()); eventId String; disciplineId String; categoryId String?
  code String /* MS, MS-U15 */; name String?; nameEn String?; format SubEventFormat; hasQualifying Boolean @default(false)
  matchFormatId String; groupScoringRuleId String?; maxEntries Int?; order Int @default(0)
  @@unique([eventId, code]) }
enum MediaStatus { AWAITING_UPLOAD PROCESSING READY FAILED }
model MediaAsset { id String @id @default(uuid()); purpose String; incomingKey String @unique; publicKey String? @unique
  declaredMime String; declaredSize Int; mime String?; size Int?; width Int?; height Int?
  status MediaStatus @default(AWAITING_UPLOAD); failureReason String?; variants Json?; altText String?; altTextEn String?
  createdById String; expiresAt DateTime /* intent expiry */; createdAt DateTime @default(now()) }
```

- Trạng thái vòng đời giải (sắp diễn ra / đang diễn ra / đã kết thúc) **tính từ ngày** + `isCancelled`, không bắt admin đổi tay.
- `rankingListId` của SubEvent thêm ở phase 09. Đổi `endDate`, `eventTypeId`, hủy/bỏ hủy giải là trigger tính lại xếp hạng (phase 09 nối vào service của module này).
- `withdrawalPolicy` để trống cho tới khi BTC trả lời (câu hỏi mở); seed không tự chọn thay.

<!-- Red Team: Luồng upload và khả năng truy cập MinIO — 2026-11-11 -->
Luồng upload (upload-intent; thiết kế (a) hoặc (b) theo kết quả phase 01)

```
admin chọn file → POST /admin/media/intents {purpose, contentType, size}
  → API kiểm loại/dung lượng theo env → tạo MediaAsset AWAITING_UPLOAD, incomingKey = incoming/{purpose}/{uuid}
  → (a) trả {mediaId, presigned POST form với content-length-range + Content-Type cố định, hạn ngắn}
    (b) trả {mediaId, uploadUrl = /api/v1/admin/media/:id/content} — API stream lên MinIO, cắt khi vượt trần
admin upload → POST /admin/media/:id/complete      // chỉ nhận id, không nhận key từ client
  → status PROCESSING → enqueue media:process-image {mediaId}
worker: nạp MediaAsset từ DB (status phải PROCESSING) → HeadObject incomingKey: size > trần → FAILED
  → GetObject → sharp metadata (không phải ảnh → FAILED) → mã hóa lại webp theo MEDIA_IMAGE_VARIANT_WIDTHS
  → PutObject public/{purpose}/{yyyy}/{uuid}-{w}.webp → variants, publicKey, READY
  → luôn DeleteObject incomingKey (đạt hay không); bản gốc không bao giờ được sao sang public/
admin hiển thị preview khi READY (poll GET /admin/media/:id mỗi 2 s, tối đa 30 s)
job dọn định kỳ: intent quá expiresAt vẫn AWAITING_UPLOAD → xóa object incoming (nếu có) + đánh FAILED
```

- Helper `presigned-upload.service.ts` trong module `storage` dùng chung cho ảnh và file import (phase 05) — DRY.
- Queue `media`: job `process-image`, attempts 3, backoff exponential 5 s, `removeOnComplete` giữ 1000, `removeOnFail` giữ 7 ngày; concurrency từ env. Job id `media-{mediaId}` (mỗi ảnh một lần xử lý, không dùng dấu hai chấm); tên queue có tiền tố `QUEUE_PREFIX`.

API (admin, tất cả có `page,pageSize,sort,q,filter[...]`)

| Resource | Path | Ghi chú |
|---|---|---|
| Nhóm giải / hạng giải | `/admin/tiers`, `/admin/event-types?filter[tierId]` | DELETE → 409 nếu đang dùng |
| Nhóm tuổi/trình độ, nội dung chuẩn | `/admin/categories`, `/admin/disciplines` | |
| Thể thức trận, luật vòng bảng | `/admin/match-formats`, `/admin/group-scoring-rules` | 1 bản `isDefault` duy nhất |
| Địa điểm, bàn | `/admin/venues`, `POST /admin/venues/:id/tables/bulk {count, prefix, startAt}` | |
| Giải | `/admin/events?filter[eventTypeId]&filter[year]&filter[lifecycle]`, `POST /admin/events/:id/publish`, `POST /admin/events/:id/cancel` | slug check: `GET /admin/events/slug-available?slug=` |
| Nội dung thi đấu | `/admin/events/:id/sub-events`, `POST .../sub-events/bulk {items:[{disciplineId, categoryId}] , defaults}` | |
| Cài đặt | `GET /admin/settings?group=`, `PUT /admin/settings/:key` | validate theo registry |
| Upload | `POST /admin/media/intents`, `PUT /admin/media/:id/content` (chỉ thiết kế b), `POST /admin/media/:id/complete`, `GET /admin/media/:id` | |

Module Nest: `tiers`, `event-types`, `categories`, `disciplines`, `match-formats`, `group-scoring-rules`, `venues`, `events`, `sub-events`, `app-settings`, `media`, `storage`. Helper chung `common/crud/prisma-list-query.ts` (map pagination/sort/filter whitelist → Prisma `findMany` + `count` trong 1 transaction) để các catalog không lặp code. `common/html/sanitize-rich-html.ts` dùng chung (`Event.infoBody`, tin/trang tĩnh phase 11). `common/validation/https-url.ts` dùng chung cho mọi trường URL. Mutation ghi dữ liệu công khai đăng ký tag trong `cache-tags.ts` (tạo ở lát cắt, phase 07).

Màn admin
- **Cấu hình**: Nhóm giải, Hạng giải, Nội dung chuẩn, Nhóm tuổi/trình độ, Thể thức trận, Luật vòng bảng (sắp thứ tự tiêu chí bằng kéo thả danh sách; chọn cách xử lý rút lui — để trống thì hiện cảnh báo vàng "Chưa chọn cách xử lý rút lui giữa bảng"), Cài đặt hiển thị, Hàng đợi (link bull-board).
- **Giải đấu**: Danh sách giải, Địa điểm & bàn.
- Trang giải dạng "hub" có tab: Thông tin | Nội dung thi đấu | (phase 05) Danh sách | (06) Bốc thăm | (07) Lịch & kết quả | (11) Tài trợ. Mọi thao tác của một giải ở một chỗ.

Luồng tạo giải (góc nhìn người vận hành)
1. Danh sách giải → "Tạo giải" (click 1).
2. Form 3 nhóm: Thông tin chung (tên → slug tự sinh, kiểm trùng ngay khi gõ; hạng giải nhớ lựa chọn lần trước), Thời gian & địa điểm (ngày kết thúc mặc định = ngày bắt đầu + 2, múi giờ mặc định từ AppSetting), Hiển thị (nổi bật, link vé `https:`). "Lưu nháp" (click 2) → vào hub, tab Nội dung thi đấu.
3. Empty state "Chưa có nội dung — Thêm nội dung" (click 3) → modal: tick MS, WS, MD, WD, XD (+ nhóm tuổi nếu có); thể thức trận, luật vòng bảng mặc định = bản `isDefault`; dạng thi đấu mặc định Loại trực tiếp → "Tạo 5 nội dung" (click 4).
4. "Công bố" khi sẵn sàng (xác nhận: "Giải sẽ hiện trên site công khai").

Cố định có chủ đích (không đưa vào cấu hình, kèm lý do)

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
| Mục | Lý do |
|---|---|
| Vai trò + ma trận quyền | Gắn với endpoint trong code; 2 vai trò cho vài nhân viên, editor quyền động là YAGNI |
| Enum trạng thái trận (`SCHEDULED/LIVE/OFFICIAL`), loại kết quả, loại draw (`QUALIFYING/MAIN/GROUP`), `CompetitorKind`, `GenderRule`, loại suất (`DIRECT/WILDCARD/QUALIFIER`) | Điều khiển logic thuật toán; đổi = đổi thiết kế |
| Danh sách tiêu chí phá hòa vòng bảng (từ vựng) | Mỗi tiêu chí là code tính toán; **thứ tự + chọn dùng** là cấu hình (`GroupScoringRule.tiebreakers`) |
| Thuật toán đặt hạt giống, mã vòng (`R64…QF, SF, F`) | Suy ra từ kích thước nhánh; nhãn hiển thị vi/en nằm trong từ điển UI |
| Danh sách ngôn ngữ (vi, en) | Thêm ngôn ngữ cần dịch toàn bộ UI, không phải bật cờ |
| Tên key AppSetting | Code đọc theo key; **giá trị** là cấu hình |
| Tham số kỹ thuật: queue (retry, concurrency), phiên, rate limit, giới hạn upload/import, bề rộng biến thể ảnh, thời hạn lưu, page size, host nhúng video | Không phải giá trị nghiệp vụ → env có mặc định |

Registry AppSetting ban đầu (giá trị là mặc định ví dụ): `event.defaultTimezone` = `Asia/Ho_Chi_Minh`; `venue.tablePrefix` = `T`; `header.resultsStrip.enabled` = false; `home.featuredEventId` = null.

## Related Code Files

Create
- `packages/shared/src/{app-setting-registry.ts (mở rộng),tiebreak-criteria.ts,slugify-vietnamese.ts,lifecycle-from-dates.ts}`
- `packages/db/prisma/schema.prisma` (model trên), migrations `add_tournament_master_data`, `add_media_assets`; `packages/db/prisma/seed/seed-config-defaults.ts` (upsert idempotent danh mục mẫu)
- `apps/api/src/common/crud/prisma-list-query.ts`, `apps/api/src/common/html/sanitize-rich-html.ts`, `apps/api/src/common/validation/https-url.ts`
- `apps/api/src/modules/{tiers,event-types,categories,disciplines,match-formats,group-scoring-rules,venues,events,sub-events,app-settings,media}/` — mỗi module: `*.module.ts`, `admin-*.controller.ts`, `*.service.ts`, `dto/`
- `apps/api/src/modules/storage/presigned-upload.service.ts`
- `apps/worker/src/processors/{media-image-processor.ts,media-intent-cleanup-processor.ts}`
- `apps/admin/src/resources/{tiers,event-types,categories,disciplines,match-formats,group-scoring-rules,venues,events,settings}/*.tsx`
- `apps/admin/src/pages/event-hub/{event-hub-page.tsx,event-info-tab.tsx,sub-events-tab.tsx,bulk-sub-event-modal.tsx}`
- `apps/admin/src/components/{media-upload-field.tsx,slug-input.tsx,confirm-action-button.tsx,rich-text-field.tsx}`
- Test: `apps/api/test/{events.e2e-spec.ts,sub-events.e2e-spec.ts,media-upload.e2e-spec.ts}`, `apps/api/src/common/html/sanitize-rich-html.test.ts` (bộ payload XSS), `apps/api/src/common/validation/https-url.test.ts`, `packages/shared/src/slugify-vietnamese.test.ts`

Modify: `apps/api/src/app.module.ts`, `apps/admin/src/app.tsx` (resource), `apps/admin/src/layout/menu-groups.ts`, `apps/api/src/modules/revalidation/cache-tags.ts` (phần còn lại, sau lát cắt).

## Implementation Steps

Lát cắt (tuần 4)
1. Model + migration `add_tournament_master_data` `--create-only` (review: index, FK `onDelete: Restrict` cho danh mục) → áp dụng DB cục bộ sau khi in host + tên DB.
2. Seed mặc định ví dụ (nhóm giải, hạng giải, MS/WS/MD/WD/XD, thể thức 5 ván 11 điểm cách 2, luật bảng 2/1/0/1) — chạy chỉ khi đã xác nhận target; idempotent theo `code`.
3. `prisma-list-query.ts` + test.
4. Events (CRUD, slug, publish, lifecycle) + sub-events (tạo từng cái); hub tab Thông tin (`infoBody` text thuần) + Nội dung thi đấu.

Phần còn lại (tuần 7–8)
5. `ui-consistency:finding-patterns` → `ui-consistency:planning`: dùng lại mẫu phase 03; bổ sung mẫu "trang hub có tab", "modal tạo hàng loạt", "ô upload ảnh có trạng thái".
6. Sanitizer + test XSS (`<script>`, `onerror=`, `javascript:` URL, `<iframe>`, `style` độc) + `https-url` validator; chuyển `infoBody` sang rich text đã sanitize (lưu + render).
7. Module catalog dùng chung helper; venues/tables bulk; sub-events bulk; luật vòng bảng với các trường mới.
8. AppSetting registry (chỉ giá trị nghiệp vụ) + endpoint đọc/ghi + validate zod.
9. Storage + upload-intent + `media` processor + job dọn intent; migration `add_media_assets`.
10. Màn admin: catalog, danh sách giải (lọc hạng giải, năm, vòng đời; tìm theo tên), hub hoàn chỉnh, địa điểm & bàn, cài đặt.
11. Xóa có ràng buộc: API trả 409 + số bản ghi phụ thuộc; UI đề xuất "Ẩn".
12. Đăng ký mutation (sửa/công bố/hủy giải, sub-event, AppSetting) vào `cache-tags.ts`.
13. `ui-consistency:verifying` cho các màn vừa làm; deploy + migrate staging.

## Todo List

- [x] (Lát cắt) Model + migration `add_tournament_master_data`; seed mặc định (idempotent) — `packages/db/prisma/schema/tournament-catalog.prisma`, `packages/db/prisma/seed/seed-config-defaults.ts`
- [x] (Lát cắt) prisma-list-query helper + test — `apps/api/src/common/crud/prisma-list-query.ts`, `prisma-list-query.test.ts`
- [x] (Lát cắt) Events CRUD/slug/publish; sub-event tạo tay; hub tab Thông tin + Nội dung thi đấu — `apps/api/src/modules/events/`, `apps/api/src/modules/sub-events/`, `apps/admin/src/pages/event-hub/`
- [x] ui-consistency: finding-patterns → planning — checklist trong `./reports/implementation-plan-261112-1304-phase-04-task-breakdown.md` (mục "Checklist giao diện admin")
- [x] Sanitizer + bộ test XSS + validator `https:` (không cắt) — `apps/api/src/common/html/sanitize-rich-html.ts` (+ test), `packages/shared/src/https-url.ts` (+ test)
- [x] Modules catalog (6) + venues/tables bulk + sub-events bulk; luật vòng bảng (unfinished, withdrawal) — `apps/api/src/modules/{tiers,event-types,categories,disciplines,match-formats,group-scoring-rules,venues}/`; hằng số còn lại xem "Việc còn mở" mục 6
- [x] AppSetting registry (chỉ nghiệp vụ) + API + màn cài đặt — `packages/shared/src/tournament-settings.ts`, `apps/admin/src/pages/settings-editors/`
- [x] Upload-intent + worker mã hóa lại + dọn intent; migration `add_media_assets` — `apps/api/src/modules/media/`, `apps/worker/src/processors/media-image-processor.ts`, `media-intent-cleanup-processor.ts`; thiết kế (b), không dùng presigned
- [x] Màn admin: catalog, giải, hub, địa điểm — `apps/admin/src/resources/`, `apps/admin/src/pages/event-hub/`; smoke trình duyệt đã làm cho tạo giải; màn địa điểm/bàn chưa smoke riêng
- [x] Đăng ký tag revalidate cho mutation của module — đã đăng ký 2026-11-14 trong `apps/api/src/modules/revalidation/cache-tags.ts` (event, sub-event, AppSetting, catalog)
- [x] ui-consistency: verifying — `plans/reports/ui-verifier-261114-phase-04.md` (DONE_WITH_CONCERNS; kind list và form chưa hiệu chỉnh)
- [ ] Deploy staging + migrate — chờ cổng phase 01 (chủ hạ tầng)

## Success Criteria

- Tạo giải + 5 nội dung trong ≤ 4 click sau khi điền form.
- Test tích hợp: lọc/sort/paginate trả đúng `total`; sort ngoài whitelist → 400; xóa hạng giải đang dùng → 409.
<!-- Red Team: Luồng upload và khả năng truy cập MinIO — 2026-11-11 -->
- Upload ảnh 3 MB jpeg → `READY` có 3 biến thể webp trong ≤ 10 s ở máy dev; object `incoming/` đã bị xóa; không có bản gốc trong `public/`.
- Test upload: file vượt trần → bị chặn ở bước upload (thiết kế a: MinIO từ chối theo `content-length-range`, đã kiểm trên bản chạy thật; thiết kế b: API cắt) hoặc worker đánh `FAILED` qua `HeadObject`; sai Content-Type → từ chối; `complete` với id lạ/của người khác → 404; file giả mạo (text đổi đuôi .jpg) → `FAILED`.
- Đổi `MEDIA_IMAGE_VARIANT_WIDTHS` trong env → ảnh upload sau dùng kích thước mới, không sửa code.
- Bộ test XSS xanh; `ticketUrl = "javascript:..."` hoặc `http://...` → 422 kèm lỗi theo field `ticketUrl` (đã chốt 2026-11-12: theo quy ước dự án, `parseBody` lỗi dữ liệu body trả 422; 400 chỉ dành cho query sai như sort/filter ngoài whitelist).

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| MinIO không hỗ trợ `content-length-range` cho presigned POST | Trung bình × Trung bình | Thiết kế (b) stream qua API có trần; worker vẫn kiểm `HeadObject` |
| Trình duyệt không tới được MinIO | Trung bình × Cao | Đã chọn thiết kế ở phase 01 |
| Mô hình danh mục thiếu trường cho giải Kamito thật | Trung bình × Trung bình | Danh mục nhỏ, thêm cột bằng migration bổ sung (chỉ cộng thêm) |
| Ảnh lớn làm worker hết RAM | Thấp × Trung bình | Kiểm dung lượng trước khi tải + `sharp` `limitInputPixels`; concurrency thấp |

Rollback: migrations chỉ thêm bảng; revert app về phase 03; MediaAsset/ảnh trên MinIO không ảnh hưởng chức năng cũ.

## Security Considerations

- Quyền: catalog + giải + upload = `ADMIN`.
- URL ký hạn ngắn (env, mặc định ví dụ 5 phút); key do server sinh; client chỉ gửi `mediaId`.
- Không phục vụ SVG upload (tránh XSS) trong bản đầu; chỉ bản mã hóa lại mới công khai.
- Sanitize rich text khi lưu và khi render; trường URL chỉ `https:`.

## Next Steps

- Lát cắt tiếp tục ở phase 05 (thêm entry tay). Phần còn lại: phase 05 dùng helper upload cho file import; phase 06 dùng `MatchFormat`, `GroupScoringRule`.

## Kết quả thực hiện

**Trạng thái (2026-11-12, sync 2026-11-14):** Hoàn thành (chưa deploy staging). Còn mở: bước 13 (deploy + migrate staging). Đã đóng 2026-11-14: đăng ký tag revalidate cho mutation giải/sub-event/AppSetting; verifying UI.

**Cách làm:** làm trọn phase trong một đợt, không tách lát cắt. Kế hoạch và quyết định kèm theo: `./reports/implementation-plan-261112-1304-phase-04-task-breakdown.md`.

**Kiểm chứng** (số liệu ghi nhận 2026-11-12, không chạy lại khi sync):
- Typecheck 10/10, lint 7/7, build 7/7.
- Test: api 185/185 (30 file, gồm e2e); shared 52; worker 20; ui-tokens 3.
- Migration trên DB local `localhost:5433/kamito_tt_dev`: `add_tournament_master_data`, `add_media_assets`, `add_single_default_partial_indexes`. `prisma migrate diff` sau đó không ra thay đổi.
- Seed `packages/db/prisma/seed/seed-config-defaults.ts` đã chạy, idempotent.
- Smoke trình duyệt: tạo giải + 5 nội dung trong 4 click; slug tự sinh và báo trùng; `ticketUrl` `javascript:` bị từ chối bằng lỗi gắn field; editor mới ở `/settings` hiển thị.
- Review `./reports/code-reviewer-261112-1329-phase-04-review.md`, đối chiếu trong code: H1 (`apps/api/src/common/http/json-body-limit.ts`), H2 (`media-intent-cleanup-processor.ts`, nhánh PROCESSING quá hạn), M1 (`events-query.service.ts`, `distinctTimezones`), M2 (migration `add_single_default_partial_indexes`), M3 (`common/crud/ready-media.ts`), M4 (page size lấy từ setting), M5 (entrypoint admin ghi `client_max_body_size` từ env). M6 còn một phần.

**Quyết định đã chốt 2026-11-12:**
- Upload thiết kế (b): API nhận stream, có trần cứng; không dùng presigned. Lưu theo `STORAGE_DRIVER`: `local` (dev, `apps/api/uploads/`) hoặc `s3` (production). Không có `presigned-upload.service.ts` như plan ghi; helper thực tế: `apps/api/src/modules/media/media-upload-stream.ts`, `apps/api/src/modules/storage/object-storage.provider.ts`.
- Tham số vận hành lên `/settings`, env làm trần: `media.maxImageMegabytes`, `media.intentTtlMinutes`, `media.processingTimeoutMinutes`, `event.defaultTimezone`, `event.defaultDurationDays`, `venue.tablePrefix`, `header.resultsStrip.enabled`, `home.featuredEventId` (`packages/shared/src/tournament-settings.ts`).
- Slug khóa khi giải đã công bố.
- Xóa sub-event của giải đã công bố bị chặn: 409 `EVENT_PUBLISHED`.
- `ticketUrl` không hợp lệ trả 422 kèm lỗi theo field (quy ước dự án). Spec ghi 400; đã đổi theo quy ước, ghi nhận là sai lệch so với spec. Sort/filter ngoài whitelist vẫn 400.
- Production bucket public toàn bộ: bucket `incoming/` riêng, private, là tùy chọn qua `S3_INCOMING_BUCKET`; đã ghi trong `docs/deployment-guide.md`.

**Sai lệch so với plan:**
- Không dùng presigned; xem trên.
- Đăng ký tag revalidate (bước 12) dời sang phase 07.
- Mục "Cài đặt hiển thị": env đổi thành `/settings` (xem trên).
- Editor rich text dùng TipTap; sanitizer `sanitize-html` chạy ở API.

**Việc còn mở:**
1. Deploy staging + migrate (bước 13). Cổng ra phase 01 chưa đạt (xem phase 03), chưa làm.
2. ~~Đăng ký tag revalidate cho mutation giải, sub-event, AppSetting~~ **Đã đóng 2026-11-14** (`cache-tags.ts`).
3. Driver `s3` chưa test với MinIO thật. Chưa xác nhận `content-length-range` và `HeadObject` trên đường S3 (`s3-object-storage.ts` chưa có test tích hợp).
4. Native crash `0xC0000409` (exit 3221226505) xảy ra 1 trên 3 lần chạy full api, ở `must-change-password.e2e-spec.ts`. Chưa tái hiện; nghi `sharp` (chưa xác minh). Lần crash đó để lại 2 user `@test.kamito.local` trong DB dev; chưa dọn, cần chủ repo xác nhận trước khi xóa.
5. Review Low chưa làm: L1, L2, L3, L4, L5, L6, L8, L9, L10, L11, L13. L7 (sanitizer cho phép `img`/`table` mà editor không tạo được) cần quyết định khi phase 11.
6. M6 còn hằng số chưa đưa lên `/settings` hoặc chưa ghi lý do giữ env: `MAX_BULK_ITEMS` = 50 và `MAX_ENTRIES` = 10 000 (`apps/api/src/modules/sub-events/sub-event-dtos.ts`); tối đa 100 bàn mỗi lần (`apps/api/src/modules/venues/venue-dtos.ts`); chất lượng WebP 82 (`apps/worker/src/processors/media-image-processor.ts`); attempts/backoff của queue media (`apps/api/src/modules/media/media-queue.ts`). Chờ chủ repo quyết: chuyển hay giữ env.
7. `@RequireStepUp` chưa gắn route admin nào (`apps/api/src/modules/auth/auth-decorators.ts`). Phase 03 dự kiến gắn ở phase 05, 07, 09; review đề xuất gắn sớm cho `PUT/DELETE /admin/settings/:key`. Chờ chủ repo quyết.
8. Admin UI chưa có test tự động (`apps/admin` chưa có runner). Báo cáo `ui-consistency:verifying` đã có (2026-11-14, `plans/reports/ui-verifier-261114-phase-04.md`; kind list và form chưa hiệu chỉnh). Tiêu chí "≤ 4 click" chỉ kiểm bằng tay.
9. Bundle admin khoảng 2,5 MB (JS chunk, cảnh báo Vite > 500 kB). Không chặn; cần code-split khi tối ưu.
