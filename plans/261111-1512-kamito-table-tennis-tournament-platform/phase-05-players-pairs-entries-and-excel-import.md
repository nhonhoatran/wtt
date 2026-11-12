# Phase 05 — VĐV, cặp đôi, đăng ký nội dung, import Excel, gộp VĐV

## Context Links

- [Brainstorm §2 đăng ký do admin nhập/import, §4.2 competitor](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Site tham chiếu §3.4 Player List, §5.2 Entry/Player](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Admin + hạ tầng: B.3 import qua BullMQ + MinIO](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Red team đã phân xử: nhóm 1, 5, 9, 10, 11, 12, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước: [phase-04](./phase-04-tournament-master-data-config-and-media-upload.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: pending. ≈8 ngày công (gồm ui-consistency ≈0,5 ngày), làm 2 đợt:
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
  candidatePlayerIds Json?; chosenPlayerId String? /* operator decision for NEEDS_CONFIRM */
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

Queue `import` (tiền tố `QUEUE_PREFIX`): `validate-import` attempts 2 backoff 10 s; `commit-import` attempts 1 (nút "Thử lại" thủ công, an toàn vì trạng thái theo dòng). Job id: `imp-{importJobId}-{action}-{attemptNo}` (duy nhất mỗi lần bấm). File import xóa sau `IMPORT_RETENTION_DAYS` bằng job dọn định kỳ.

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

- [ ] (Lát cắt) Migrations players/pairs/competitors + entries
- [ ] (Lát cắt) Player tối thiểu + entry đơn thêm/rút tay
- [ ] Kiểm chứng thư viện xlsx
- [ ] ui-consistency: finding-patterns → planning
- [ ] Pair/Entry + eligibility + bulk + override có lý do + audit; chặn rút entry trong draw đã công bố
- [ ] Import ENTRIES: trần, SHA-256, khớp lại khi commit, NEEDS_CONFIRM, trạng thái theo dòng, chặn draw khác DRAFT, audit
- [ ] Export stream đồng bộ
- [ ] Gộp VĐV + cờ công khai + tên hiển thị thay thế
- [ ] Màn admin VĐV, cặp, tab Danh sách, wizard, gộp
- [ ] Đăng ký tag revalidate
- [ ] ui-consistency: verifying; deploy staging; file import cho pilot

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
- File import trong prefix private, không public; xóa sau `IMPORT_RETENTION_DAYS`.
- Kiểm loại file xlsx bằng nội dung (zip signature) trước khi parse; trần dung lượng, giải nén, số dòng.
- Gộp VĐV và override cần `ADMIN`; gộp cần step-up.

## Next Steps

- Lát cắt tiếp tục ở phase 06 (bốc thăm loại trực tiếp). Phase 06 dùng `Entry` `CONFIRMED` + `seed`; phase 09 điền `rankingAtEntry/pointsAtEntry` và nối gộp VĐV vào sổ điểm.
