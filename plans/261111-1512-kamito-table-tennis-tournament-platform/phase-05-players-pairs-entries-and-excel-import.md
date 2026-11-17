# Phase 05 — VĐV, cặp đôi, đăng ký nội dung, import Excel, gộp VĐV

## Context Links

- [Brainstorm §2 đăng ký do admin nhập/import, §4.2 competitor](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Site tham chiếu §3.4 Player List, §5.2 Entry/Player](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Admin + hạ tầng: B.3 import qua BullMQ + MinIO](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Red team đã phân xử: nhóm 1, 5, 9, 10, 11, 12, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước: [phase-04](./phase-04-tournament-master-data-config-and-media-upload.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: Hoàn thành (chưa deploy staging; làm trọn 2026-11-12, không tách lát cắt). ≈8 ngày công (gồm ui-consistency ≈0,5 ngày), kế hoạch gốc làm 2 đợt:
  - **Lát cắt (tuần 4, ≈1,5 ngày):** `Player` tối thiểu (mã, slug, tên chuẩn hóa), `Competitor` loại PLAYER, thêm entry đơn bằng tay vào 1 nội dung (ô tìm VĐV / tạo nhanh), rút entry khi draw còn nháp.
  - **Phần còn lại (tuần 8–9, ≈6,5 ngày):** cặp đôi, kiểm hợp lệ đầy đủ, thao tác hàng loạt, import ENTRIES 2 bước có trần + khớp lại khi commit, export đồng bộ, gộp hai hồ sơ VĐV, cờ hiển thị công khai. Phải xong trước **pilot BTC (tuần 9)** vì pilot nạp dữ liệu giải cũ bằng import.
- VĐV, cặp đôi, lớp trừu tượng **Competitor** (VĐV hoặc cặp; đội thêm sau), đăng ký theo nội dung (trạng thái, vòng chính/vòng loại, suất, hạt giống), import Excel 2 bước (kiểm tra → nhập), export danh sách.

## Key Insights

- `Entry` và phía trận (phase 06) trỏ tới `Competitor`, không trỏ thẳng VĐV/cặp → thêm `TEAM` sau chỉ cần thêm `Team` + giá trị enum, không đổi bảng nhánh đấu.
- Import là nguồn trùng VĐV lớn nhất → khớp theo mã trước, rồi theo (tên chuẩn hóa + năm sinh + giới tính); không chắc thì không tự đoán.
<!-- Red Team: Import Excel và danh tính VĐV — 2026-11-11 -->
- Kết quả validate chỉ để **xem trước**; dữ liệu có thể đổi giữa lúc validate và lúc commit → commit chạy lại khớp từng dòng trong transaction, gắn với SHA-256 của file đã validate.
- Import ENTRIES không được sửa trường danh tính của `Player` đã có (tên, giới tính, năm sinh): chỉ liên kết; lệch → lỗi dòng.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- Rút entry đang nằm trong draw đã công bố làm hỏng nhánh → chặn ở đây, chuyển sang thao tác `withdraw-from-draw` của phase 06.
- Thư viện đọc/ghi xlsx: ứng viên `exceljs` — giấy phép, phiên bản, bảo trì, đọc stream có trần **chưa kiểm chứng**; tra npm/GitHub trước khi cài.

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 đã có: `@RequireStepUp()` + StepUpGuard (chưa gắn route nào), `POST /api/v1/auth/step-up`, `apps/admin/src/components/step-up-modal.tsx`, `AppSettingsService` (đọc setting), resource `players` trong ma trận quyền (`packages/shared/src/permissions.ts`; RESULTS_OPERATOR chỉ `list`, `read`).
- Gộp VĐV: phải gắn `@RequireStepUp()` trên route gộp (phase 05 làm). Ma trận hiện cho phép ADMIN mọi action trên `players`.

<!-- Phase 04 sync — 2026-11-12 -->
- Phase 04 đã có helper upload: không có `presigned-upload.service.ts` (plan ghi vậy, không tạo). Dùng `apps/api/src/modules/media/media-upload-stream.ts` (stream có trần cứng) và `apps/api/src/modules/storage/object-storage.provider.ts` (`OBJECT_STORAGE`, driver `local`/`s3`). Prefix `private/imports/` cần chốt riêng với `incoming/` của media trước khi làm.
- Dùng lại: `apps/api/src/common/crud/prisma-list-query.ts` (list), `apps/admin/src/pages/event-hub/event-hub-page.tsx` + `hub-tab-context.ts` (thêm tab), `apps/admin/src/components/confirm-action-button.tsx` (xác nhận), `apps/admin/src/components/media-upload-field.tsx` (ô file/ảnh có trạng thái).
- `@RequireStepUp` vẫn chưa gắn route nào (phase 04 cũng chưa gắn). Gộp VĐV gắn ở phase này.
- Đăng ký `cache-tags.ts` (bước 10): file đã có từ lát cắt phase 07 (2026-11-13), chưa đăng ký mutation entry/VĐV/gộp; điểm nối có sẵn ở `apps/api/src/modules/events/events.service.ts:15`.

<!-- Phase 05 sync — 2026-11-14 -->
- Chặn import theo draw: test cấp import có 3 ca, `apps/api/test/imports-commit-guards.e2e-spec.ts` (draw đã công bố → từ chối, không ghi gì; ADMIN override có lý do → commit và làm mới trang công khai; draw DRAFT không chặn). Hợp đồng: một dòng khóa draw làm cả job `FAILED`, trừ khi ADMIN override có lý do.
- Revalidate import: worker gọi `refreshPublicAfterImport` sau commit (`apps/worker/src/processors/import-commit-processor.ts:93`, `apps/worker/src/import/import-revalidate-tags.ts`). Lỗi enqueue chỉ ghi log, không làm fail job.
- Đã đóng 2026-11-14 (review phase 06 L6, split từ mục "kiểm draw ngoài tx"): `assertNoLockedDraw` chạy lại **trong** transaction của từng lô, sau khóa SubEvent (`apps/worker/src/import/commit-batch.ts`). Draw được công bố giữa hai lô thì lô sau bị từ chối, lô trước vẫn giữ (`apps/api/test/imports-worker.e2e-spec.ts`, "refuses a later batch when a draw is published after validation"). Kiểm đầu job ngoài transaction (`import-commit-processor.ts`) vẫn giữ để báo lỗi sớm.

## Requirements

Functional
- VĐV: CRUD, mã tự sinh (tiền tố từ AppSetting `player.codePrefix`, mặc định ví dụ `KMT`), slug (trùng → hậu tố `-2`, `-3`…), ảnh, tiểu sử vi/en (text thuần), ẩn/hiện.
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- VĐV: `fullNameEn` mặc định = tên bỏ dấu (sửa được); cờ `isPublicProfile` (tắt → không có trang hồ sơ), `noindex`, tên hiển thị thay thế `publicDisplayName`.
<!-- Red Team: Import Excel và danh tính VĐV — 2026-11-11 -->
- `birthYear` tách khỏi `birthDate` (nhiều VĐV chỉ biết năm sinh); kiểm tuổi dùng `birthDate` nếu có, không thì `birthYear`.
- Cặp đôi: tạo ngầm khi đăng ký đôi (chọn 2 VĐV); một cặp = một bộ 2 VĐV không phân thứ tự.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Đăng ký: thêm/sửa/rút theo nội dung; trạng thái `CONFIRMED/WITHDRAWN` (PENDING/WAITLIST dời giai đoạn sau); vòng `MAIN/QUALIFYING`; suất `DIRECT/WILDCARD/QUALIFIER`; hạt giống; thao tác hàng loạt.
- Kiểm hợp lệ: giới tính theo `Discipline.genderRule`; tuổi theo `Category` (cách tính tuổi theo AppSetting `category.ageCalculation` = `BIRTH_YEAR` | `EVENT_START_DATE`); một VĐV không ở 2 cặp trong cùng nội dung; vượt `maxEntries` → báo lỗi.
- Ghi đè kiểm hợp lệ (kể cả vượt `maxEntries`): chỉ `ADMIN`, bắt buộc lý do, ghi `AuditLog`.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- Rút Entry (kể cả hàng loạt) khi Entry đang nằm trong draw khác `DRAFT` → 409 kèm hướng dẫn "Dùng 'Rút khỏi nhánh' ở tab Bốc thăm"; Entry trong draw `DRAFT` → cảnh báo "Nhánh nháp sẽ cần bốc lại".
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- Audit mọi lần sửa `seed`, `stage`, `quotaType`, `status` của Entry.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Import: một loại `ENTRIES` (theo giải; tạo VĐV mới khi cần). Tải mẫu (có sẵn mã VĐV cũ để tra) → upload → kiểm tra (preview lỗi từng dòng) → nhập các dòng hợp lệ.
- Export: danh sách đăng ký theo giải/nội dung ra xlsx, **stream đồng bộ** từ API (không qua queue).
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Gộp hai hồ sơ VĐV (B vào A): xem trước ảnh hưởng (số entry, cặp, trận, dòng sổ điểm) → xác nhận (nhập lại mật khẩu) → trỏ lại `Competitor`/`Pair`/`Entry` (phase 09 thêm trỏ lại sổ điểm + đánh dấu tính lại) → B thành `mergedIntoId = A`, slug B chuyển hướng 301 sang A.

<!-- Red Team: Import Excel và danh tính VĐV — 2026-11-11 -->
Non-functional
- Import 1.000 dòng: kiểm tra ≤ 30 s, nhập ≤ 60 s (máy dev). Nhập idempotent (chạy lại không nhân đôi).
- Trần: dung lượng file (`IMPORT_MAX_FILE_BYTES`), dung lượng giải nén + số ô khi stream (`IMPORT_MAX_UNZIPPED_BYTES`), số dòng (`IMPORT_MAX_ROWS`); worker chạy với giới hạn bộ nhớ (`--max-old-space-size` + giới hạn container).

## Architecture

Model (migrations `add_players_pairs_competitors`, `add_entries`, `add_import_jobs`, `add_player_merge`)

```prisma
enum Gender { MALE FEMALE }
enum Handedness { LEFT RIGHT }
model Player { id String @id @default(uuid()); code String @unique; slug String @unique
  fullName String; fullNameEn String?; publicDisplayName String?; gender Gender
  birthDate DateTime? @db.Date; birthYear Int?
  countryCode String /* default from AppSetting */; club String?; city String?; handedness Handedness?
  gripStyle String?; playStyle String?; photoMediaId String?; bio String?; bioEn String?   // plain text
  phone String?; email String?                     // private, never in public API
  normalizedName String                           // lowercase, no diacritics — for matching/search
  isPublicProfile Boolean @default(true); noindex Boolean @default(true)   // noindex until consent question is answered
  mergedIntoId String?; isActive Boolean @default(true); createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  @@index([normalizedName]) }
model Pair { id String @id @default(uuid()); playerAId String; playerBId String   // playerAId < playerBId
  @@unique([playerAId, playerBId]) }
enum CompetitorType { PLAYER PAIR }              // TEAM later
model Competitor { id String @id @default(uuid()); type CompetitorType
  playerId String? @unique; pairId String? @unique; displayName String   // refreshed in the same tx when a player is renamed
  entries Entry[] }
// raw SQL in migration: CHECK ((type='PLAYER' AND player_id IS NOT NULL AND pair_id IS NULL) OR (type='PAIR' AND pair_id IS NOT NULL AND player_id IS NULL))
enum EntryStatus { CONFIRMED WITHDRAWN }
enum EntryStage { MAIN QUALIFYING }
enum QuotaType { DIRECT WILDCARD QUALIFIER }
model Entry { id String @id @default(uuid()); subEventId String; competitorId String
  status EntryStatus @default(CONFIRMED); stage EntryStage @default(MAIN); quotaType QuotaType @default(DIRECT)
  seed Int?; rankingAtEntry Int? /* null for pairs */; pointsAtEntry Int? /* pairs: sum of both players */
  eligibilityOverrideReason String?; notes String?; createdAt DateTime @default(now())
  @@unique([subEventId, competitorId]); @@unique([subEventId, stage, seed]); @@index([subEventId, status]) }
enum ImportStatus { AWAITING_UPLOAD UPLOADED VALIDATING VALIDATED COMMITTING DONE FAILED }
model ImportJob { id String @id @default(uuid()); eventId String; fileKey String; fileSha256 String?
  status ImportStatus; totalRows Int?; validRows Int?; errorRows Int?; needsConfirmRows Int?
  createdById String; createdAt DateTime @default(now()); finishedAt DateTime? }
enum ImportRowStatus { VALID ERROR NEEDS_CONFIRM COMMITTED }
model ImportRow { importJobId String; rowNo Int; status ImportRowStatus; plannedAction String
  /* CREATE_PLAYER | LINK_PLAYER | CREATE_ENTRY | UPDATE_ENTRY */; data Json; messages Json?
  candidatePlayerIds Json?; decisions Json? /* {"1": playerId | "NEW", "2": ...}; thay chosenPlayerId */
  createdEntityIds Json?; @@id([importJobId, rowNo]); @@index([importJobId, status]) }
```

- Migration CHECK constraint viết tay: `migrate dev --create-only` → thêm SQL → review → áp dụng.
- `@@unique([subEventId, stage, seed])`: Postgres cho nhiều `NULL` → nhiều entry không hạt giống vẫn hợp lệ; trùng hạt giống bị DB chặn.
- Ràng buộc "1 VĐV không ở 2 cặp cùng nội dung" kiểm trong service (khóa `SELECT ... FOR UPDATE` theo subEvent khi ghi) + test.
<!-- Red Team: Xếp hạng không tái lập được — 2026-11-11 -->
- Entry của cặp: `pointsAtEntry` = tổng điểm hiện tại của 2 VĐV, `rankingAtEntry` để trống (phase 09 điền).
- `ImportRow` tách khỏi `ImportJob` (trước là JSON) → preview phân trang/lọc ở server, trạng thái commit theo dòng.

<!-- Red Team: Import Excel và danh tính VĐV — 2026-11-11 -->
Luồng import

```
admin: Tải mẫu (GET /admin/imports/template?eventId → xlsx stream: sheet "Hướng dẫn", dropdown mã nội dung, sheet "VĐV đã có" kèm mã)
  → POST /admin/imports {eventId} → ImportJob AWAITING_UPLOAD + form upload (helper presigned-upload phase 04, prefix private/imports/)
  → upload → POST /admin/imports/:id/uploaded → enqueue import:validate-import {importJobId}
worker validate: nạp job từ DB → HeadObject (vượt trần → FAILED) → kiểm zip signature → đọc xlsx stream, dừng khi vượt
  trần giải nén/số ô/số dòng → tính SHA-256 → mỗi dòng: chuẩn hóa → khớp VĐV
     mã → LINK_PLAYER (trường danh tính lệch → ERROR "Khác dữ liệu VĐV mã X")
     tên chuẩn hóa + năm sinh + giới tính khớp 1 → LINK_PLAYER
     chỉ khớp tên (hoặc khớp nhiều) → NEEDS_CONFIRM, kèm ứng viên (tên, CLB, năm sinh)
     không khớp → CREATE_PLAYER; trùng VĐV mới trong cùng file → gộp thành 1 VĐV mới
  → ghi ImportRow, status VALIDATED
admin: bảng preview lọc theo trạng thái (server-side); dòng NEEDS_CONFIRM: chọn "Liên kết với …" hoặc "Tạo VĐV mới"
  → "Nhập N dòng" (xác nhận) → enqueue import:commit-import
worker commit: advisory lock theo eventId → kiểm SHA-256 file vẫn khớp → từ chối nếu nội dung đích có draw khác DRAFT
  (trừ khi ADMIN chọn override, có lý do) → từng lô 200 dòng chưa COMMITTED, mỗi lô 1 transaction:
     khớp lại VĐV/entry với dữ liệu hiện tại → upsert theo khóa tự nhiên → ImportRow COMMITTED + createdEntityIds
  → DONE; AuditLog {jobId, số tạo/liên kết/sửa, danh sách id}
thử lại: chỉ chạy các dòng chưa COMMITTED
```

Cột mẫu ENTRIES: `Mã nội dung | Mã VĐV 1 | Họ tên VĐV 1 | Giới tính 1 | Năm sinh 1 | CLB 1 | Mã VĐV 2 | Họ tên VĐV 2 | Giới tính 2 | Năm sinh 2 | CLB 2 | Vòng (Chính/Loại) | Suất (Thường/Đặc cách) | Hạt giống | Ghi chú`.

Queue `import` (tiền tố `QUEUE_PREFIX`): `validate-import` attempts 2 backoff 10 s; `commit-import` attempts 1 (nút "Thử lại" thủ công, an toàn vì trạng thái theo dòng). Job id: `imp-{importJobId}-{action}-{attemptNo}` (duy nhất mỗi lần bấm). File import xóa sau setting `import.retentionDays` bằng job dọn định kỳ.

Gộp VĐV (`player-merge.service.ts`, 1 transaction, advisory lock theo 2 player id)
```
preview(A, B): counts of B's entries, pairs, matches; conflicts (A and B in the same sub-event, pair (A,B))
merge(A, B, reason): reject on conflict → entries of B's competitor → A's competitor
  pairs (B, X) → (A, X); if (A, X) exists → move its entries, drop the duplicate pair/competitor
  refresh displayName; B.mergedIntoId = A, isActive = false; audit before/after; revalidate tags of both
  phase 09 hook: re-point ledger rows to A, mark affected sub-events rankingDirtyAt
```

API

| Method | Path | Ghi chú |
|---|---|---|
| GET/POST/PATCH | `/admin/players?page&pageSize&sort&q&filter[gender]&filter[club]&filter[isActive]` | `q` tìm trên `normalizedName`, `code` |
| GET | `/admin/players/lookup?q&gender&limit=10` | autocomplete |
| GET/POST | `/admin/players/merge/preview?targetId&sourceId`, `/admin/players/merge {targetId, sourceId, reason}` | step-up |
| GET | `/admin/pairs?q` | |
| GET | `/admin/sub-events/:id/entries?page&sort&filter[status]&filter[stage]&q` | |
| POST | `/admin/sub-events/:id/entries` `{playerIds:[1|2], stage, quotaType, seed?, overrideReason?}` | tự tạo Pair + Competitor |
| PATCH | `/admin/entries/:id`; `POST /admin/entries/bulk {ids, action: withdraw|setStage|setQuota}` | 409 nếu entry trong draw đã công bố |
| GET | `/admin/imports/template?eventId` | stream xlsx |
| POST/GET | `/admin/imports`, `/admin/imports/:id/uploaded`, `GET /admin/imports/:id`, `GET /admin/imports/:id/rows?page&filter[status]`, `PATCH /admin/imports/:id/rows/:rowNo {chosenPlayerId | createNew}`, `POST /admin/imports/:id/commit` | |
| GET | `/admin/exports/entries?eventId&subEventId?` | stream xlsx đồng bộ |

<!-- Implementation sync — 2026-11-12 -->
Hợp đồng đã chốt khi code (2026-11-12)

- Kiểm thư viện (bước 3): `exceljs` 4.4.0 (MIT, bản ổn định cuối 2023-10-19, bảo trì chậm, kéo theo `uuid@8`, `fstream` đã deprecated) dùng để đọc/ghi xlsx; `fflate` 0.8.3 (MIT, cập nhật 2026-07) giải nén thử để đếm byte giải nén **thật** (không tin kích thước khai trong header zip) trước khi đưa buffer cho `exceljs`. File đã có trần `IMPORT_MAX_FILE_BYTES` nên đọc vào bộ nhớ có giới hạn.
- Tham số vận hành trên `/settings`: `player.codePrefix` (KMT), `player.codeDigits` (5), `player.defaultCountryCode` (VIE), `player.showAge` (tắt), `category.ageCalculation` (BIRTH_YEAR, editor mới `choice`), `import.maxFileMegabytes` (5), `import.maxRows` (5000), `import.retentionDays` (30). Env `IMPORT_MAX_*` là trần; `IMPORT_MAX_UNZIPPED_BYTES` chỉ env (chốt an toàn). `IMPORT_RETENTION_DAYS` env không còn dùng.
- `ImportRow.chosenPlayerId` → `decisions Json` (`{"1": playerId | "NEW", "2": …}`) vì dòng đôi có 2 VĐV cần xác nhận. `ImportJob` thêm `fileName`, `fileSize`, `failureReason`, `committedRows`, `overrideReason`, `attemptNo`, `fileDeletedAt`. `Entry` thêm `updatedAt`. `Player` thêm `mergedAt`.
- Mã VĐV: sequence Postgres `player_code_seq` (SQL tay trong migration 1) + CHECK `Pair_ordered_distinct_players`, `Competitor_type_matches_reference`.
- Helper dùng chung API + worker: `@kamito/shared` (`normalizePersonName`, `stripDiacritics`, `ageOnEvent`, `checkEntryEligibility`, `ENTRY_IMPORT_COLUMNS`, `playerSettings`, `importSettings`) và `@kamito/db` (`allocatePlayerIdentity`, `findOrCreateCompetitor`, `refreshCompetitorNames`, `lockSubEvent`, `advisoryLock`, `playersAlreadyEntered`, `confirmedEntryCount`, `entriesInLockedDraw`, `subEventsWithLockedDraw` — 2 hàm cuối trả rỗng tới phase 06).
- Draw (phase 06, 2026-11-13): chặn rút/import theo draw đi qua 2 hook trên (đã nối); số trận trong xem trước gộp đã đếm trận thật, loại BYE (`player-merge-preview.ts:86`). Chuyển hướng slug VĐV đã gộp đã hoàn tất ở phase 10 (2026-11-17): GET/HEAD thường trả 301 tới opaque URL của đích còn active/public; đích ẩn trả 404. Ở phase 05 chỉ lưu `mergedIntoId`.
- Lỗi hợp lệ trả 422 `{ code: 'ENTRY_INELIGIBLE', message, issues: [{code, message, playerId?, overridable}] }`; `overrideReason` (ADMIN) bỏ qua các issue `overridable` + vượt `maxEntries`.

<!-- Phase 05 sync — 2026-11-12: bổ sung hợp đồng khi code -->
- `ImportRow.decisions` (Json) đã thay `chosenPlayerId` (xem khối model ở trên).
- Setting mới: `entry.maxBulkItems` (trần số dòng hàng loạt), `import.uploadTtlHours`. `IMPORT_RETENTION_DAYS` env đã bỏ → setting `import.retentionDays`.
- Worker cần env: `IMPORT_MAX_FILE_BYTES`, `IMPORT_MAX_UNZIPPED_BYTES`, `IMPORT_MAX_ROWS` (trần, chốt an toàn), `WORKER_MAX_OLD_SPACE_MB`, `WORKER_MEM_LIMIT` (giới hạn bộ nhớ container).
- Đọc xlsx: sau khi viết lại zip, `exceljs` đọc stream bằng `WorkbookReader` (sheet đọc sau cùng). Đã test bằng file do `exceljs` tạo và file dựng tay theo layout Excel. **Chưa test file thật do Excel lưu** → phải thử trước pilot.
- Thêm route `POST /admin/imports/:id/validate` (chạy lại kiểm tra khi bấm "Kiểm tra lại").
- Lỗi gộp VĐV trả `MERGE_CONFLICT` trong `error.issues`.
- Thứ tự khóa: SubEvent trước, Player sau, ở mọi nơi ghi.
- Rút entry làm xóa `seed` (audit ghi seed cũ); import ô trống giữ giá trị đang lưu.

Module Nest: `players` (+ `player-merge.service.ts`), `pairs`, `competitors` (service nội bộ, `findOrCreateForPlayers(ids)`), `entries`, `eligibility` (service thuần, test riêng), `imports`, `exports`. Worker: `import-validate-processor.ts`, `import-commit-processor.ts`, `import-file-cleanup-processor.ts`.

Màn admin
- **Vận động viên**: Danh sách VĐV, Cặp đôi, Lịch sử import, "Gộp VĐV" (từ dòng VĐV: chọn hồ sơ trùng → xem trước → xác nhận).
- Hub giải → tab **Danh sách**: menu dọc chọn nội dung (hiện số đăng ký mỗi nội dung) + bảng đăng ký.

Luồng thêm đăng ký (góc nhìn người vận hành)
- Đơn: "Thêm VĐV" (1) → ô tìm (gõ tên/mã, gợi ý lọc sẵn theo giới tính của nội dung) → chọn (2) → Enter thêm, ô tìm giữ focus để thêm người tiếp. Không thấy → "Tạo VĐV mới với tên này" ngay trong ô. Mặc định: `CONFIRMED`, `MAIN`, `DIRECT`.
- Đôi: 2 ô tìm liên tiếp → "Thêm cặp".
- Lỗi hợp lệ hiện ngay dưới ô: "VĐV sinh 2008, vượt nhóm U15 (tính theo năm sinh)" + link "Vẫn thêm (cần lý do)" nếu có quyền.
- Hạt giống: sửa trực tiếp trên ô bảng (Tab chuyển dòng); trùng số hạt giống → báo đỏ ngay.
- Hàng loạt: tick nhiều dòng → "Rút" / "Chuyển vòng loại" / "Đổi suất" (rút cần xác nhận).
- Import từ hub: nút "Import Excel" mở wizard 3 bước có chỉ báo tiến độ: Tải mẫu → Tải file lên → Kiểm tra & nhập (dòng "Cần xác nhận" nổi bật, chọn tại chỗ).

## Related Code Files

Create
- `packages/shared/src/{normalize-person-name.ts,strip-diacritics.ts,age-on-event.ts,import-columns.ts}`
- `packages/db/prisma/schema.prisma` (model trên) + 4 migrations
- `apps/api/src/modules/{players,pairs,competitors,entries,eligibility,imports,exports}/` (module, admin controller, service, dto)
- `apps/api/src/modules/entries/entry-bulk-actions.service.ts`, `apps/api/src/modules/players/player-merge.service.ts`
- `apps/worker/src/processors/{import-validate-processor.ts,import-commit-processor.ts,import-file-cleanup-processor.ts}`, `apps/worker/src/import/{xlsx-row-reader.ts,player-matcher.ts,entry-row-mapper.ts,import-limits.ts}`
- `apps/admin/src/resources/players/{player-list.tsx,player-edit.tsx,player-create.tsx,player-merge-modal.tsx}`, `apps/admin/src/resources/pairs/pair-list.tsx`, `apps/admin/src/resources/imports/import-list.tsx`
- `apps/admin/src/pages/event-hub/{entries-tab.tsx,sub-event-side-menu.tsx,add-entry-form.tsx,entry-table.tsx}`
- `apps/admin/src/components/{player-lookup-select.tsx,import-wizard.tsx,import-preview-table.tsx}`
- Test: `apps/api/src/modules/eligibility/eligibility.service.test.ts`, `apps/worker/src/import/player-matcher.test.ts`, `apps/api/test/{entries.e2e-spec.ts,imports.e2e-spec.ts,player-merge.e2e-spec.ts}` + file xlsx mẫu tự tạo trong `apps/api/test/fixtures/` (gồm file vượt trần, zip bomb nhỏ, sai định dạng)

Modify: `apps/admin/src/pages/event-hub/event-hub-page.tsx` (thêm tab), `menu-groups.ts`, `app.module.ts`, `apps/api/src/modules/revalidation/cache-tags.ts`.

## Implementation Steps

Lát cắt (tuần 4)
1. Migration `add_players_pairs_competitors` (gồm CHECK) + `add_entries` → áp dụng DB cục bộ sau khi in host + tên DB.
2. Players tối thiểu (mã từ sequence Postgres + tiền tố AppSetting, slug + hậu tố, normalizedName, `fullNameEn` bỏ dấu); Competitor PLAYER; thêm/rút entry đơn bằng tay ở tab Danh sách.

Phần còn lại (tuần 8–9)
3. Kiểm `exceljs` (giấy phép, bản mới nhất, ngày cập nhật, đọc stream, cách giới hạn kích thước giải nén). Không đạt → thư viện khác đã kiểm chứng tương tự; ghi kết quả vào file này.
4. `ui-consistency:finding-patterns` → `ui-consistency:planning`: tái dùng mẫu hub/tab, thêm mẫu "menu dọc + bảng", "wizard nhiều bước", "sửa ô trực tiếp".
5. Pairs + eligibility đầy đủ + bulk + override có lý do + audit seed/stage/quota/status; chặn rút entry trong draw đã công bố.
6. Migration `add_import_jobs`; import validate/commit (worker) với trần, SHA-256, khớp lại khi commit, trạng thái theo dòng, NEEDS_CONFIRM, advisory lock, audit; template có sheet VĐV đã có.
7. Export entries stream đồng bộ.
8. Migration `add_player_merge`; gộp VĐV (preview + step-up + audit); cờ `isPublicProfile`, `noindex`, `publicDisplayName`; làm mới `displayName` của Competitor khi đổi tên.
9. Màn admin: VĐV, cặp, tab Danh sách, wizard import, gộp VĐV.
10. Đăng ký mutation (entry, VĐV, gộp) vào `cache-tags.ts`.
11. `ui-consistency:verifying`; deploy + migrate staging; chuẩn bị file import giải cũ cho pilot.

## Todo List

- [x] (Lát cắt) Migrations players/pairs/competitors + entries — áp dụng DB local (`add_players_pairs_competitors` gồm `player_code_seq` + 2 CHECK, `add_entries`)
- [x] (Lát cắt) Player tối thiểu + entry đơn thêm/rút tay
- [x] Kiểm chứng thư viện xlsx — `exceljs` 4.4.0 + `fflate` 0.8.3 (xem "Hợp đồng đã chốt")
- [x] ui-consistency: finding-patterns → planning — `ui/phase-05-ui-checklists.md`, `ui/phase-05-ui-plan.md`
- [x] Pair/Entry + eligibility + bulk + override có lý do + audit seed/stage/quota/status
- [x] Chặn rút entry khi draw đã công bố — phase 06 (2026-11-13): hook `entriesInLockedDraw` (`packages/db/src/domain/entry-guards.ts`) gọi ở `entries.service.ts`, 409 `ENTRY_IN_PUBLISHED_DRAW` có test (`draws.e2e-spec.ts`, `draw-review-guards.e2e-spec.ts`)
- [x] Import ENTRIES: trần, SHA-256, khớp lại khi commit, NEEDS_CONFIRM, trạng thái theo dòng, audit, resume khi commit dở
- [x] Import: chặn draw khác DRAFT — test cấp import có (`apps/api/test/imports-commit-guards.e2e-spec.ts`, 3 ca; 2026-11-14)
- [x] Import: kiểm draw khóa trong transaction của từng lô, dưới khóa SubEvent (review phase 06 L6) — đóng 2026-11-14: `apps/worker/src/import/commit-batch.ts`; e2e `imports-worker.e2e-spec.ts`
- [x] Export stream đồng bộ (`exports` module; test xuất > 1 trang 1000 dòng)
- [x] Gộp VĐV + cờ công khai + tên hiển thị thay thế — `mergedIntoId`, `isPublicProfile`, `noindex`, `publicDisplayName`; 301 slug đã kiểm ở phase 10 ngày 2026-11-17
- [x] Màn admin VĐV, cặp, tab Danh sách, wizard, gộp — `apps/admin` (tests 4/4, build OK)
- [x] Đăng ký tag revalidate cho entry/VĐV/gộp/import — 2026-11-14: `cache-tags.ts` (`entry.create/update/bulk`, `player.create/update/merge`); import: `apps/worker/src/import/import-revalidate-tags.ts`, gọi sau commit
- [x] ui-consistency: verifying — 2 vòng kiểm độc lập trên UI ban đầu (kết quả trong `plans/reports/ui-261112-1436-phase-05-admin-ui.md`, checklist ở `ui/`); các chỉnh UI sau review (nút "Thử lại"/"Kiểm tra lại" trang import, ẩn thẻ liên hệ riêng tư trên form VĐV, nhãn "Từ vòng loại") chưa qua verifying lại; chưa chạy trên trình duyệt
- [ ] Deploy + migrate staging — chờ cổng ra phase 01 (chủ hạ tầng)
- [ ] File import thử cho pilot — chờ staging; cần thử file do Excel thật lưu trước

## Success Criteria

- Unit test: eligibility (giới tính, tuổi 2 cách tính, chỉ có `birthYear`, cặp nam–nữ cho `MIXED`), matcher (mã, tên có/không dấu, trùng nhiều → NEEDS_CONFIRM, mã khớp nhưng năm sinh lệch → ERROR).
<!-- Red Team: Import Excel và danh tính VĐV — 2026-11-11 -->
- Tích hợp: import 1 file 1.000 dòng tự tạo (gồm 20 dòng lỗi cố ý) → preview báo đúng 20 lỗi kèm số dòng; commit lần 2 không tạo thêm bản ghi; 2 dòng cùng 1 VĐV mới → 1 VĐV.
- File vượt `IMPORT_MAX_FILE_BYTES` hoặc vượt trần giải nén → `FAILED` có lý do, worker không vượt giới hạn bộ nhớ.
- Sửa dữ liệu giữa validate và commit (vd thêm tay 1 entry trùng) → commit khớp lại, dòng đó không nhân đôi.
- Commit bị ngắt giữa chừng → "Thử lại" chỉ chạy các dòng chưa `COMMITTED`.
- Import vào nội dung có draw `PUBLISHED` → bị từ chối nếu không có override.
- Rút entry nằm trong draw đã công bố → 409; trùng hạt giống cùng nội dung/giai đoạn → DB từ chối.
- Gộp VĐV: sau gộp, entry/cặp của B trỏ về A; xung đột (A, B cùng nội dung) → chặn; URL hồ sơ B → 301 sang A.
- Thêm 1 VĐV vào nội dung đơn: 2 click + gõ tên.
- `GET /public/*` (phase 08) không bao giờ trả `phone`, `email`, `birthDate` (test serializer ở phase 08).

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Trùng VĐV do tên viết khác nhau | Cao × Trung bình | Khớp chuẩn hóa + NEEDS_CONFIRM; công cụ gộp VĐV |
| File Excel định dạng lạ (ô gộp, công thức) | Trung bình × Thấp | Chỉ đọc sheet đầu, giá trị đã tính; lỗi dòng rõ ràng |
| File độc (zip bomb, quá lớn) | Thấp × Cao | Trần dung lượng/giải nén/số ô + giới hạn bộ nhớ worker |
| Ghi đồng thời 2 người thêm cùng VĐV | Thấp × Thấp | Unique `(subEventId, competitorId)` + khóa theo subEvent |
| Gộp nhầm 2 VĐV khác nhau | Thấp × Cao | Xem trước + step-up + audit đủ before/after để gộp ngược bằng tay |

Rollback: migrations chỉ thêm bảng/cột; revert app về phase 04.

## Security Considerations

- Dữ liệu cá nhân (SĐT, email, ngày sinh): chỉ admin đọc; public chỉ năm sinh/tuổi nếu bật cờ AppSetting `player.showAge`; `noindex` mặc định bật cho tới khi có trả lời về đồng ý công khai.
- File import trong prefix private, không public; xóa sau setting `import.retentionDays`.
- Kiểm loại file xlsx bằng nội dung (zip signature) trước khi parse; trần dung lượng, giải nén, số dòng.
- Gộp VĐV và override cần `ADMIN`; gộp cần step-up.

## Next Steps

- Lát cắt tiếp tục ở phase 06 (bốc thăm loại trực tiếp). Phase 06 dùng `Entry` `CONFIRMED` + `seed`; phase 09 điền `rankingAtEntry/pointsAtEntry` và nối gộp VĐV vào sổ điểm.
- Phase 06 (đã xong 2026-11-13): 2 hook `entry-guards.ts` đã implement; phase 07: đăng ký mutation vào `cache-tags.ts`; phase 09/10: xem ghi chú "Phase 05 sync" trong các file đó.

## Kết quả thực hiện

**Trạng thái (2026-11-12, sync 2026-11-14):** Hoàn thành (chưa deploy staging). Còn mở: staging + pilot (chờ cổng phase 01), file Excel thật. Đã đóng 2026-11-14: test chặn import theo draw; tag revalidate entry/VĐV/gộp/import; kiểm draw trong transaction của từng lô (L6).

<!-- Debt fixes sync — 2026-11-14 -->
- Đóng: L6 (kiểm draw khóa chạy lại trong transaction của từng lô, dưới khóa SubEvent; e2e "draw công bố giữa chừng"). Mục "kiểm draw ngoài tx" trong "Việc còn mở" đã tách: phần test đã đóng từ trước, phần transaction đóng hôm nay.
- Còn mở (không đổi): staging + pilot, file xlsx do Excel thật lưu, và các mục 6–8 của "Việc còn mở" (crash `0xC0000409`, trùng `Competitor_playerId_key`, verifying UI sau review).

**Cách làm:** làm trọn phase trong một đợt. Hai vòng review: 7/10 → 8/10, đã sửa N1–N3.

**Kiểm chứng** (số liệu chạy 2026-11-12):
- Migration đã áp dụng DB local: `add_players_pairs_competitors`, `add_entries`, `add_import_jobs`, `add_player_merge`.
- Test: shared 80/80; worker 30/30; admin 4/4 + build OK; API full suite 37 file 257/257 (lần chạy cuối).
- Turbo typecheck + lint 14/14.
- Báo cáo: `plans/reports/fullstack-developer-261112-1436-phase-05-{api-core,imports-exports,api-review-fixes,import-review-fixes}.md`, `plans/reports/ui-261112-1436-phase-05-admin-ui.md`, `plans/reports/tester-261112-1436-phase-05-test-run{,-2}.md`, `plans/reports/code-reviewer-261112-1436-phase-05-review{,-2}.md`.

**Tiêu chí thành công** (đối chiếu test có tên trong repo):

| Tiêu chí | Trạng thái | Bằng chứng |
|---|---|---|
| Unit eligibility | Đạt | `packages/shared/src/entry-eligibility.test.ts` |
| Unit matcher | Đạt | `apps/worker/src/import/player-matcher.test.ts` |
| Import 1.000 dòng, 20 lỗi, commit idempotent | Đạt | `apps/api/test/imports-worker.e2e-spec.ts:71` |
| 2 dòng cùng VĐV mới → 1 VĐV | Đạt | `imports-worker.e2e-spec.ts:112` |
| File vượt trần, quá nhiều dòng, zip bomb → FAILED, bộ nhớ bị chặn | Đạt | `imports-worker.e2e-spec.ts:303, 314, 326, 346` |
| Sửa giữa validate và commit không nhân đôi | Đạt | `imports-worker.e2e-spec.ts:124` |
| Commit dở → thử lại chỉ chạy dòng còn lại | Đạt | `imports-worker.e2e-spec.ts:225` |
| Trùng seed cùng nội dung/giai đoạn bị DB chặn | Đạt | `apps/api/test/entries.e2e-spec.ts:113` |
| Gộp: xung đột chặn; cặp trùng gộp, entry chuyển; 301 hồ sơ đích | Đạt local | `player-merge.e2e-spec.ts:129, 141`; phase 10 kiểm chuỗi gộp/đích private và HTTP 301 trong `rankings-and-players.spec.ts`; [QA 2026-11-17](../reports/tester-261117-phase-10-public-rankings-players.md) |
| Rút entry trong draw đã công bố → 409 | Đạt (sync 2026-11-13) | `draws.e2e-spec.ts:217`, `draw-review-guards.e2e-spec.ts:68, 70` |
| Import vào draw PUBLISHED bị từ chối, kể cả draw công bố giữa chừng | Đạt (sync 2026-11-14) | `apps/api/test/imports-commit-guards.e2e-spec.ts`; `apps/api/test/imports-worker.e2e-spec.ts` (draw công bố sau lô 1); kiểm trong transaction của lô đã đóng (L6) |
| Thêm VĐV đơn: 2 click + gõ tên | Chưa đo | cần kiểm tay trên staging |
| `GET /public/*` không trả phone/email/birthDate | Đạt trong phạm vi endpoint đã kiểm | Whitelist phase 08 và hồi quy public 2026-11-17; phase 10 kiểm thêm alias vi/en, opaque URL và trường hồ sơ; [QA](../reports/tester-261117-phase-10-public-rankings-players.md) |

**Quyết định đã chốt 2026-11-12 (chủ repo):**
- Làm trọn phase, không tách lát cắt.
- Rút entry → xóa seed.
- Ô trống trong file import giữ giá trị đang lưu.
- `RESULTS_OPERATOR` không thấy SĐT, email, ngày sinh.
- Thêm media purpose `player-photo`.
- Nhãn suất `QUALIFIER` là "Từ vòng loại"; nhãn cũ "Vòng loại" vẫn nhận khi import.
- API vitest pool `threads`.

**Mặc định của lead (chủ repo không phản đối):**
- Import đưa entry `WITHDRAWN` về `CONFIRMED` (có audit).
- Không savepoint theo dòng cho race P2002 slug VĐV: cả lô lỗi, chạy lại là được.
- Không thêm nút kiểm tra lại ngoài "Kiểm tra lại" đã có.

**Sai lệch so với plan:** đã ghi trong "Hợp đồng đã chốt khi code" ở trên. Tóm tắt: `decisions` thay `chosenPlayerId`; setting thay env `IMPORT_RETENTION_DAYS`; thêm route `validate`; thứ tự khóa SubEvent → Player; xlsx đọc bằng exceljs stream.

**Việc còn mở:**
1. ~~Chặn import theo draw: test cấp import~~ **Đã đóng 2026-11-14**. ~~Kiểm tra lại draw trong tx (review phase 06 L6)~~ **Đã đóng 2026-11-14** (`commit-batch.ts`, e2e draw công bố giữa hai lô).
2. ~~Tag revalidate cho entry/VĐV/gộp/import~~ **Đã đóng 2026-11-14** (`cache-tags.ts`, `import-revalidate-tags.ts`).
3. ~~301 slug VĐV đã gộp — phase 10~~ **Đã đóng local 2026-11-17**: GET/HEAD 301 giữ query tới opaque URL; đích private/inactive trả 404. RSC prefetch dùng fallback Next 308; [QA](../reports/tester-261117-phase-10-public-rankings-players.md).
4. Deploy staging + migrate + pilot — chờ cổng phase 01 (chủ hạ tầng).
5. Thử file do Excel thật lưu trước pilot. Hiện mới test bằng file exceljs và file dựng tay.
6. Crash ngẫu nhiên tiến trình test trên Windows (mã `0xC0000409`), khoảng 1/6 lần chạy full API, cả hai pool; nguyên nhân chưa rõ; không có assertion lỗi. Cùng mã lỗi đã gặp ở phase 04 (việc còn mở 4) — chưa chắc cùng nguyên nhân.
7. Chèn trùng `Competitor_playerId_key` khi tạo đồng thời → 500 (chưa xử lý; import thì cả lô lỗi, chạy lại được).
8. Verifying UI chưa chạy lại cho các chỉnh sau review và chưa kiểm trên trình duyệt (kích thước, thứ tự focus, Tab/Enter).
