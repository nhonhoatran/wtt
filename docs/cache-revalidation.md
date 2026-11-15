# Revalidate cache công khai

> Cập nhật: 2026-11-14 · Trạng thái: đã commit (`dba2f2f`, `fc73052`, `6a91d27`, `4cdfa23`, `07f2500`, `8173f28`, `856cac9`, `d0b8e8a`), chưa deploy staging.
> Nguồn đối chiếu: `apps/api/src/modules/revalidation/` (`cache-tags.ts`, `route-tag-coverage.ts`, `revalidation-enqueue.service.ts`), `apps/api/test/cache-tags-coverage.e2e-spec.ts`, `packages/shared/src/{public-cache-tags,public-cache-tag-sets,revalidate-job-options,with-timeout}.ts`, `apps/worker/src/{revalidate-worker,processors/revalidate-processor}.ts`, `apps/worker/src/import/import-revalidate-tags.ts`, `apps/admin/src/api/write-warnings.ts`.
> Tổng quan kiến trúc: [system-architecture](./system-architecture.md#nhập-lịch-và-revalidate-phase-07). Cách thêm route mới: [code-standards](./code-standards.md#route-ghi-admin-mới-phải-đăng-ký-tag).

## Contents
- [Luồng](#luồng)
- [Quy tắc phủ route](#quy-tắc-phủ-route)
- [Tag công khai](#tag-công-khai)
- [Mutation và tag](#mutation-và-tag)
- [Bảng phủ route](#bảng-phủ-route)
- [Hàng đợi và thử lại](#hàng-đợi-và-thử-lại)
- [Cảnh báo hiện cho admin](#cảnh-báo-hiện-cho-admin)
- [Khe hở đã biết](#khe-hở-đã-biết)

## Luồng

```
api (sau commit)  ──> queue `revalidate`, job `revalidate-tags` {tags}, jobId `reval-<uuid>`
worker            ──> POST {CLIENT_INTERNAL_URL}/api/revalidate, header x-revalidate-secret
client            ──> kiểm Host, secret, body; vô hiệu tag trong Redis response cache dùng chung
```

- Tag gửi **sau commit**, ngoài transaction. Lỗi enqueue không rollback thao tác đã ghi. Response mang `warnings: ["PUBLIC_REFRESH_DELAYED"]`.
- Import Excel: worker gửi tag sau khi commit một lượt import (`import-revalidate-tags.ts`). Tag lấy từ `entryChangeTags` (cùng hàm với API) và danh sách VĐV.
- Client, route `/api/revalidate` và các bước kiểm: [system-architecture](./system-architecture.md#route-apirevalidate-ở-client-phase-08).
- Bổ sung 2026-11-15: response API public đặt `fetch no-store`, TTL/tag nằm trong Redis dùng chung. Invalidation tăng generation và phiên bản tag nguyên tử; request bắt đầu trước invalidation không được ghi dữ liệu cũ trở lại. Redis lỗi đọc bỏ cache; invalidation lỗi trả 503 để worker retry. Hai Next production local đã kiểm invalidation qua một replica làm mới cả hai.

## Quy tắc phủ route

Mọi route ghi dưới `/admin` (POST, PUT, PATCH, DELETE) phải có một dòng trong `ROUTE_TAG_RULES` (`route-tag-coverage.ts`). Mỗi dòng là một trong hai:

| Loại | Ý nghĩa | Ví dụ |
|---|---|---|
| `tags(...)` | Route gửi các mutation trong `CACHE_TAGS` sau commit | `POST /admin/matches/:id/confirm` → `match.confirm` |
| `none(lý do)` | Route không làm đổi thứ mà trang công khai hiển thị. Lý do bắt buộc, dài hơn 5 ký tự | `POST /admin/imports` → "writes the import tables only" |

`apps/api/test/cache-tags-coverage.e2e-spec.ts` lấy danh sách route từ metadata của Nest rồi kiểm:
1. Mỗi route ghi `/admin/*` có trong `ROUTE_TAG_RULES`.
2. Không có dòng nào trong map mà route đã không còn.
3. Mỗi mutation trong map tồn tại trong `CACHE_TAGS` và xuất hiện trong mã nguồn (`'<mutation>'`). Mutation ghi trong map mà không ai gửi thì test rớt.
4. Mỗi `none` có lý do.

Test này chỉ kiểm có dòng hay không và có gọi mutation hay không. Nó **không** kiểm lý do `none` có đúng hay không. Xem [Khe hở đã biết](#khe-hở-đã-biết).

Thống kê hiện tại (2026-11-14): 93 route ghi admin, 52 route `tags`, 41 route `none`.

## Tag công khai

Tag được dựng từ `publicCacheTags` (`packages/shared/src/public-cache-tags.ts`). Chỉ gồm `A-Z a-z 0-9 _ . -`, nối bằng `-`, không dùng ký tự đại diện. Tag hợp lệ theo `isValidCacheTag`: bắt đầu bằng chữ thường, tối đa 256 ký tự.

| Hàm | Tag | Trang dùng |
|---|---|---|
| `events()` | `events` | Danh sách giải, lịch giải, sitemap |
| `event(slug)` | `event-<slug>` | Tổng quan giải, thông tin, VĐV |
| `schedule(slug)` | `schedule-<slug>` | Trang trận, lịch giải |
| `draw(slug, code)` | `draw-<slug>-<code>` | Trang nhánh đấu |
| `groups(slug, code)` | `groups-<slug>-<code>` | Trang bảng đấu |
| `match(slug, matchNo)` | `match-<slug>-<matchNo>` | Trang trận |
| `resultsStrip()` | `results-strip` | Dải kết quả trên đầu trang |
| `players()` / `player(slug)` | `players`, `player-<slug>` | Danh sách VĐV, hồ sơ VĐV |
| `rankings()` / `ranking(code)` | `rankings`, `ranking-<code>` | Bảng xếp hạng (phase 09) |
| `settings()` | `settings` | Cấu hình ảnh hưởng nhiều trang |

Entry dùng `entryChangeTags` (`packages/shared/src/public-cache-tag-sets.ts`): tag giải, `draw-*`, `groups-*` của các nội dung bị ảnh hưởng, `players` khi có VĐV mới, và `player-*` của các VĐV liên quan. Hàm này dùng chung cho API và worker.

## Mutation và tag

`CACHE_TAGS` (`cache-tags.ts`) ánh xạ mỗi mutation sang hàm dựng tag từ ngữ cảnh của thao tác. Các nhóm chính:

| Nhóm | Mutation | Tag gửi |
|---|---|---|
| Trận | `match.start`, `match.unStart`, `match.saveProgress` | Giải, lịch, nhánh, bảng (nếu là trận bảng), các `match-*` bị ảnh hưởng, `player-*` của VĐV |
| Trận | `match.confirm`, `match.amend`, `match.reopen` | Như trên, cộng `results-strip` và `player-*` của mọi VĐV hai phía |
| Nhánh | `draw.publish` | `event`, `schedule`, `draw-*`, `groups-*` nếu nhánh có bảng, `match-*` của các trận trong nhánh |
| Nhánh | `draw.unpublish`, `draw.postPublishEdit` | Như trên, `match-*` của cả nội dung (cả nhánh vòng loại và nhánh chính, vì rút có thể lan sang nhánh kia). `draw.postPublishEdit` thêm `player-*` của VĐV cũ và mới (khi thay) hoặc của VĐV bị rút |
| Nhánh | `draw.placeQualifiers` | Như `draw.publish`, nhưng chỉ cho các trận và VĐV vừa được xếp vào ô của nhánh MAIN đã công bố. Nhánh nháp không gửi tag |
| Bảng | `group.standings` | Như nhánh (bảng và nhánh). Dùng cho nhập hạng tay và tính lại BXH |
| Lịch | `schedule.update`, `session.create`, `session.update`, `session.delete` | Giải, lịch, `draw-*`, `groups-*`, `match-*` của các trận có giờ hoặc ô đổi |
| Giải | `event.create`, `event.update`, `event.delete` | `events`, `event-*`, `schedule-*`, `draw-*`, `groups-*`, `match-*` |
| Giải | `event.publish`, `event.unpublish`, `event.cancel`, `event.uncancel` | Như `event.update`, cộng `results-strip` và các `match-*` của giải |
| `event.refresh` | Mọi tag của giải, gồm `player-*` của VĐV trong giải (nút "Làm mới trang công khai") |
| Nội dung thi đấu | `subEvent.create`, `subEvent.update`, `subEvent.delete` | `event-*`, `schedule-*`, `draw-*`, `groups-*` |
| Đăng ký | `entry.create`, `entry.update`, `entry.bulk` | Giải, `draw-*`, `groups-*`, `player-*` của VĐV liên quan |
| VĐV | `player.create`, `player.update`, `player.merge` | `players`, `player-*`, và tag giải và nội dung có đăng ký của VĐV |
| Danh mục | `tier.write`, `eventType.write`, `venue.write`, `media.update` | `events`, `event-*` của các giải dùng mục đó |
| Danh mục | `discipline.write`, `category.write` | `events`, các giải và trận dùng môn hoặc nhóm đó |
| Xếp hạng | `rankingList.write`, `ranking.publish` | `rankings`, `ranking-<code>`, `players`, `player-*` đổi thứ hạng |
| Cấu hình | `settings.update` | `settings` |

Tag theo từng mutation không dùng wildcard. Tên mutation dùng camelCase có dấu chấm (`match.unStart`), không dùng kebab-case.

## Bảng phủ route

Bảng dưới đây liệt kê route theo mutation (cột "route") và theo lý do không gửi tag (cột "lý do"). Nguồn đầy đủ: `route-tag-coverage.ts`.

### Route gửi tag (52)

| Mutation | Route |
|---|---|
| `event.create` | `POST /admin/events` |
| `event.update` | `PATCH /admin/events/:id` |
| `event.delete` | `DELETE /admin/events/:id` |
| `event.publish` | `POST /admin/events/:id/publish` |
| `event.unpublish` | `POST /admin/events/:id/unpublish` |
| `event.cancel` | `POST /admin/events/:id/cancel` |
| `event.uncancel` | `POST /admin/events/:id/uncancel` |
| `event.refresh` | `POST /admin/events/:id/revalidate` (nút "Làm mới trang công khai") |
| `subEvent.create` | `POST /admin/events/:eventId/sub-events`, `POST .../sub-events/bulk` |
| `subEvent.update` | `PATCH /admin/events/:eventId/sub-events/:id` |
| `subEvent.delete` | `DELETE /admin/events/:eventId/sub-events/:id` |
| `session.create` | `POST /admin/events/:eventId/sessions` |
| `session.update` | `PATCH /admin/events/:eventId/sessions/:id` |
| `session.delete` | `DELETE /admin/events/:eventId/sessions/:id` |
| `schedule.update` | `PATCH /admin/matches/:id/schedule` |
| `draw.publish` | `POST /admin/draws/:id/publish` |
| `draw.unpublish` | `POST /admin/draws/:id/unpublish` |
| `draw.postPublishEdit` | `POST /admin/draws/:id/replace-entry`, `POST /admin/draws/:id/withdraw-entry` |
| `draw.placeQualifiers` | `POST /admin/draws/:id/place-qualifiers`, `POST /admin/draws/:id/place-group-qualifiers` |
| `group.standings` | `PATCH /admin/groups/:id/manual-ranks`, `POST /admin/groups/:id/recompute` |
| `match.start` | `POST /admin/matches/:id/start` |
| `match.unStart` | `POST /admin/matches/:id/un-start` |
| `match.saveProgress` | `POST /admin/matches/:id/save-progress` |
| `match.confirm` | `POST /admin/matches/:id/confirm` |
| `match.amend` | `POST /admin/matches/:id/amend-scores` |
| `match.reopen` | `POST /admin/matches/:id/reopen` |
| `entry.create` | `POST /admin/sub-events/:id/entries` |
| `entry.update` | `PATCH /admin/entries/:id` |
| `entry.bulk` | `POST /admin/entries/bulk` |
| `player.create` | `POST /admin/players` |
| `player.update` | `PATCH /admin/players/:id` |
| `player.merge` | `POST /admin/players/merge` |
| `tier.write` | `POST /admin/tiers`, `PATCH /admin/tiers/:id`, `DELETE /admin/tiers/:id` |
| `eventType.write` | `POST /admin/event-types`, `PATCH /admin/event-types/:id`, `DELETE /admin/event-types/:id` |
| `venue.write` | `PATCH /admin/venues/:id` |
| `category.write` | `PATCH /admin/categories/:id` |
| `discipline.write` | `PATCH /admin/disciplines/:id` |
| `media.update` | `PATCH /admin/media/:id` |
| `rankingList.write` | `POST /admin/ranking-lists`, `PATCH /admin/ranking-lists/:id`, `DELETE /admin/ranking-lists/:id` |
| `ranking.publish` | `POST /admin/ranking-snapshots/:id/publish` |
| `settings.update` | `PUT /admin/settings/:key`, `DELETE /admin/settings/:key` |

### Route không gửi tag (41)

| Lý do trong code | Route |
|---|---|
| Xóa khi đang được dùng, nên không có trang công khai nào hiển thị | `DELETE /admin/categories/:id`, `DELETE /admin/disciplines/:id`, `DELETE /admin/venues/:id` |
| Bảng điểm chỉ đổi khi tính lại (`group.standings`), không phải khi đổi thang | `PATCH` và `DELETE /admin/group-scoring-rules/:id` |
| Thể thức không được API công khai và client hiển thị | `POST`, `PATCH`, `DELETE /admin/match-formats...`, `PATCH /admin/rounds/:id` |
| Tên bàn không được API công khai và client hiển thị | `PATCH` và `DELETE /admin/venues/:id/tables/:tableId` |
| Mới tạo, chưa có giải nào dùng | `POST /admin/categories`, `POST /admin/disciplines`, `POST /admin/group-scoring-rules`, `POST /admin/match-formats`, `POST /admin/venues`, `POST /admin/venues/:id/tables`, `POST /admin/venues/:id/tables/bulk` |
| Chỉ đọc hoặc chỉ là gợi ý | `POST /admin/sub-events/:id/draws/preview`, `POST /admin/sub-events/:id/entries/suggest-seeds` |
| Nhánh nháp, chưa công bố | `DELETE /admin/draws/:id`, `POST /admin/sub-events/:id/draws`, `POST /admin/draws/:id/swap` |
| Ghi bảng import, chưa đổi dữ liệu công khai (worker gửi tag khi commit) | `POST /admin/imports`, `PUT /admin/imports/:id/file`, `POST .../uploaded`, `POST .../validate`, `POST .../commit`, `PATCH .../rows/:rowNo` |
| Upload, tạo phiên tải ảnh; ảnh chỉ công khai khi giải tham chiếu tới | `POST /admin/media/intents`, `PUT /admin/media/:id/content`, `POST /admin/media/:id/complete` |
| Người dùng không hiển thị công khai | `POST`, `PATCH /admin/users...`, `POST /admin/users/:id/reset-password`, `POST /admin/users/:id/revoke-sessions` |
| Ranking nháp, chưa publish | `POST`, `DELETE /admin/ranking-points...`, `POST /admin/ranking-snapshots/drafts`, `DELETE /admin/ranking-snapshots/:id`, `POST /admin/ranking/recompute`, `PUT /admin/ranking-rules/matrix` |

Lý do ghi trong bảng là lý do trong code. Ngày 2026-11-14 đã rà lại từng lý do `none` và khớp với hành vi thật.

## Hàng đợi và thử lại

Nguồn: `packages/shared/src/revalidate-job-options.ts`, `apps/api/src/modules/revalidation/revalidation-enqueue.service.ts`, `apps/worker/src/revalidate-worker.ts`, `apps/worker/src/processors/revalidate-processor.ts`.

| Mục | Giá trị | Ghi chú |
|---|---|---|
| Queue | `revalidate` (`QueueName.Revalidate`) | |
| Job | `revalidate-tags`, payload `{tags}` | `REVALIDATE_TAGS_JOB` |
| Chia lô | 200 tag mỗi job (`REVALIDATE_MAX_TAGS`) | Client từ chối quá 200 tag, và lỗi đó là vĩnh viễn nên không được gửi |
| `jobId` | `reval-<uuid>`, mỗi lần một id | Không dùng id cố định, vì BullMQ bỏ job mới khi job cũ cùng id còn được giữ |
| Thử lại | 5 lần, backoff mũ từ 2 giây | Trong `revalidateTagsJob`. Hằng cố định có chủ đích: đây là hằng độ tin cậy nội bộ, có comment lý do trong code |
| Giữ lại | 100 job xong, 500 job lỗi | |
| Timeout enqueue (API và worker import) | 2 giây | Hằng `REVALIDATE_ENQUEUE_TIMEOUT_MS` trong `@kamito/shared`, bọc bằng `withTimeout`. Lỗi enqueue chỉ thêm cảnh báo |
| Timeout gọi client | `REVALIDATE_TIMEOUT_MS` (mặc định 5000) | `AbortSignal.timeout` |
| Đồng thời | `REVALIDATE_WORKER_CONCURRENCY` (mặc định 2) | |
| Lỗi vĩnh viễn | Payload sai, tag sai, tên job lạ: `UnrecoverableError`, không thử lại | `PermanentRevalidateError` |
| Lỗi tạm | Non-2xx, lỗi mạng, timeout: thử lại theo backoff | |

Helper `withTimeout` (`packages/shared/src/with-timeout.ts`) từ chối promise khi quá `ms`. Công việc bên dưới vẫn chạy tiếp.

Revalidate là idempotent, nên job trùng vô hại. Nếu mọi lần thử đều lỗi, trang vẫn cập nhật khi cache hết TTL (`PUBLIC_REVALIDATE_SECONDS`, `MATCHDAY_REVALIDATE_SECONDS`).

## Cảnh báo hiện cho admin

Mutation có thể trả `warnings`. Admin hiện qua `apps/admin/src/api/write-warnings.ts`:

| Mã | Nhãn hiện cho người dùng |
|---|---|
| `PUBLIC_REFRESH_DELAYED` | "Đã lưu. Trang công khai sẽ cập nhật chậm hơn" |
| `RANKING_RECOMPUTE_DELAYED` | "Đã lưu. Bảng xếp hạng sẽ cập nhật chậm hơn" |
| `RANKING_SNAPSHOT_REBUILD_SUGGESTED` | "Nên tạo lại bản chụp xếp hạng mới vì VĐV đã được gộp" |

- Hàm `showWarnings(message, warnings)` hiện từng mã. Hàm `warningsOf(response)` đọc `warnings` từ response Refine.
- Mã chưa có nhãn thì hiện đúng chuỗi mã.
- Nhãn `PUBLIC_REFRESH_DELAYED` nói "Đã lưu". Nút "Làm mới trang công khai" không lưu gì, nên nhãn này không đúng với nút đó. Đã ghi nhận trong code (`schedule-actions.tsx`).

## Khe hở đã biết

| Mục | Hiện trạng | Hướng xử lý |
|---|---|---|
| Redis không sẵn sàng | Đọc API trực tiếp; rate limit fallback RAM cục bộ; invalidation trả 503 | Theo dõi Redis và queue retry; không coi fallback là bảo đảm hạn mức toàn cụm |
| Nhãn `PUBLIC_REFRESH_DELAYED` dùng cho nút "Làm mới" | Nhãn nói "Đã lưu" | Tách nhãn hoặc đổi nội dung |

Đã đóng 2026-11-14 (commit `a80dfb2`): `place-qualifiers` và `place-group-qualifiers` trên nhánh MAIN đã công bố gửi `draw.placeQualifiers`, nhãn coverage đổi từ `none` sang `tags`; `draw.publish` có tag `match-*`; rút và thay entry sau công bố có tag `player-*` của VĐV cũ và mới. Test: `apps/api/test/draw-publish-edit-tags.e2e-spec.ts`.

## Liên quan

- [system-architecture](./system-architecture.md#nhập-lịch-và-revalidate-phase-07): tổng quan luồng.
- [public-site](./public-site.md#dữ-liệu-và-cache): cách trang công khai dùng tag và TTL.
- [match-results](./match-results.md#revalidate-cache-công-khai) và [scheduling](./scheduling.md#revalidate): tag theo nhóm chức năng.
- [code-standards](./code-standards.md#route-ghi-admin-mới-phải-đăng-ký-tag): quy tắc khi thêm route mới.
