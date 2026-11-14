# Phase 09 — Kế hoạch thực thi (5 gói tuần tự)

Spec: [phase-09](../phase-09-ranking-rules-points-ledger-and-snapshots.md). Mỗi gói = 1 phiên fullstack-developer (≈150K token), làm xong gói trước mới mở gói sau. Đọc 2026-11-13.

## Sai lệch so với cổng G2 (ghi nhận)

- **G2 chưa được BTC trả lời.** Đã chốt 2026-11-13: vẫn làm phase 09 với dữ liệu mẫu (vô địch 1000/400/125), giống phase 06 làm trước G1a/G1b. Mọi điểm, thời hạn, cờ walkover là cấu hình DB sửa trên admin; khi BTC trả lời chỉ đổi dữ liệu, không đổi code (trừ khi mô hình hạng giải × vòng sai — rủi ro đã có trong spec).
- Bước 1 của spec ("ghi câu trả lời G2") thay bằng dòng này; phase-09 Overview cần thêm 1 dòng sai lệch khi sync.

## Quyết định kèm theo

| Chuyện | Chốt | Lý do / bằng chứng |
|---|---|---|
| Logic tính lại/snapshot đặt ở đâu | **Processor trong worker nhận `deps.prisma`** (`apps/worker/src/ranking/*` + `processors/ranking-*.ts`); e2e API nạp processor bằng `import()` động như `loadImportProcessors` (`apps/api/test/support/import-test-kit.ts:27`) | API không cần tính lại đồng bộ (mọi đường đều qua queue). Đặt trong `packages/db` sẽ kéo `@kamito/ranking-engine` vào db (hiện db chỉ phụ thuộc `@kamito/shared`); tạo package non-pure mới là YAGNI |
| `packages/ranking-engine` | pure, deps chỉ `@kamito/shared`, khuôn y `packages/competition-engine/package.json` | Mã vòng đã lưu sẵn ở `Round.code` (`draws-and-matches.prisma:75`) → engine đọc code có sẵn, không cần import `competition-engine` |
| Job id | `rank-se-{subEventId}-{randomUUID()}` / `rank-snap-{randomUUID()}`, `removeOnComplete`, attempts 5 backoff exp 5 s (snapshot attempts 3) | Đã chốt; khuôn `revalidation-enqueue.service.ts:45`. Không dùng option dedupe của BullMQ |
| Tuần tự hóa recompute | `advisoryLock(tx, 'ranking:' + subEventId)` có sẵn (`packages/db/src/domain/entry-guards.ts:11`) | Không khóa `SubEvent FOR UPDATE` trong worker để khỏi tranh với writer |
| Dấu bẩn | `markRankingDirty(tx, subEventIds)`: sort id → `lockSubEventsInOrder` (`player-locks.ts:33`) → `UPDATE ... SET "rankingDirtyAt" = GREATEST(clock_timestamp(), "rankingDirtyAt" + interval '1 ms')`; trả id để enqueue **sau commit** | Đúng thứ tự khóa SubEvent→Draw→Group→Match (`match-lock.ts:10`, `draw-lock.ts:7`). `GREATEST` giữ giá trị tăng nghiêm ngặt ở độ chính xác ms (Prisma `timestamp(3)`) → compare-and-clear không xóa nhầm lần đánh dấu mới |
| Compare-and-clear | SQL thô `UPDATE "SubEvent" SET "rankingDirtyAt" = NULL WHERE id = $1 AND "rankingDirtyAt" = $t0` | t0 đọc trong cùng tx sau khi lấy advisory lock |
| Setting mới (`/settings`, nhóm mới `ranking` "Xếp hạng" trong `APP_SETTING_GROUPS`) | `ranking.defaultValidityDays` (mặc định ví dụ 365), `ranking.awardPointsOnWalkoverLoss` (false), `ranking.dirtySweepAgeMinutes` (ví dụ 5) | Worker đọc qua `readSetting` (đang lặp ở `import/import-deps.ts:23` và `media-worker.ts:29` → gom về `apps/worker/src/read-setting.ts`) |
| Giữ env | `RANKING_DIRTY_SWEEP_INTERVAL_MINUTES` (ví dụ 10), `RANKING_WORKER_CONCURRENCY` (1) | Chu kỳ scheduler đăng ký lúc boot (`upsertJobScheduler`), cùng kiểu `IMPORT_CLEANUP_INTERVAL_MINUTES` (`worker-env.ts:27`); concurrency là tinh chỉnh tiến trình |
| Hàng của ma trận quy tắc | Khung mã vòng chuẩn trong engine (`W..R128`, `QF-1..QF-4`, `GROUP`, `GROUP-1..GROUP-8`) ∪ mã đã có trong rule + nút "Thêm vòng" | Khung là cấu trúc hiển thị, không phải giá trị nghiệp vụ; điểm luôn từ DB |
| Lưu ma trận | 1 lần lưu = các ô đã đổi, cùng `effectiveFrom`; upsert theo unique 5 cột (lưu 2 lần cùng ngày = sửa phiên bản ngày đó); `ruleFor` chọn theo từng ô | Ô không đổi kế thừa phiên bản cũ; muốn bỏ điểm thì ghi 0 |
| Gộp VĐV | Xóa dòng AUTO của nguồn, trỏ dòng MANUAL sang đích, đánh dấu bẩn các nội dung đã khóa sẵn (`affectedSubEventIds`) | Không đụng unique một phần AUTO; recompute dựng lại AUTO theo entry đã chuyển |
| Gợi ý hạt giống | Service mới `draws/draw-seed-suggestion.service.ts`; `POST .../suggest-seeds {apply?: boolean}`: đọc snapshot PUBLISHED mới nhất của `subEvent.rankingListId`, ghi `rankingAtEntry/pointsAtEntry` (cặp: tổng 2 VĐV, rank null), trả `{available, snapshot, suggestions}`; `apply=true` ghi luôn seed trong cùng tx (xóa seed cũ trước để khỏi đụng unique). Số hạt giống theo setting `draw.defaultSeedPercent` có sẵn | Giữ hợp đồng `{available:false}` khi chưa có bảng/snapshot (`draw-generation.service.ts:29`); 1 click áp gợi ý |
| Revalidate khi công bố | `rankings`, `ranking-{code}`, `players` + `player-{slug}` của VĐV đổi hạng/điểm/mới/rớt (`public-cache-tags.ts`) | Không đẩy 5.000 tag mỗi kỳ |
| Partial unique thêm | `RankingSnapshot (rankingListId, asOfDate) WHERE status='DRAFT'` | Bảo đảm "thay bản nháp cùng ngày" kể cả 2 job chạy song song |

## Lệnh đụng DB (luật cứng)

- Chỉ `prisma migrate dev --create-only` → đọc/sửa SQL → `prisma migrate deploy` → `prisma generate`. **Không bao giờ `prisma db push`.**
- Trước mọi lệnh migrate/seed/e2e: in host + tên DB lấy từ dòng `^DATABASE_URL=` (neo đầu dòng, bỏ dòng `#`), **dừng chờ chủ repo xác nhận**. Không tự truyền `DATABASE_URL=...`.

## Gói 1 — `@kamito/shared` + `packages/ranking-engine` (pure)

Mục tiêu: toàn bộ thuật toán + setting/queue name, chưa đụng DB.

Tạo
- `packages/ranking-engine/{package.json,tsconfig.json,vitest.config.ts}` (chép khuôn competition-engine)
- `src/{types.ts,stage-reached.ts,rule-for-date.ts,points-for-entry.ts,competition-rank.ts,snapshot-builder.ts,pair-seed-points.ts,stage-code-rows.ts,index.ts}` + `*.test.ts` cùng tên
- `packages/shared/src/ranking-settings.ts` (3 setting ở trên, `defineNumberSetting`/`defineAppSetting`)

Sửa: `packages/shared/src/{app-setting-definition.ts (nhóm ranking),app-setting-registry.ts,queue-names.ts (Ranking: 'ranking'),index.ts}`; thêm hằng tên job `RANKING_RECOMPUTE_JOB`, `RANKING_SNAPSHOT_JOB`, `RANKING_SWEEP_JOB` (trong `queue-names.ts` hoặc file `ranking-jobs.ts` riêng); `queue-names.test.ts`.

Bước
1. Kiểu input engine: entry (id, playerIds), match (drawKind, section, roundCode, roundNumber, status, resultType, winnerSide, isVoided, side ids) — dùng `isPlayedMatch`/`isRealMatch` (`packages/shared/src/match-predicates.ts`); group (entryIds, rank, qualified, complete = mọi trận không void đã OFFICIAL).
2. `stageReached` đúng pseudo-code spec (MAIN ưu tiên; GROUP; QUALIFYING theo `QF-n` lưu sẵn; BYE không tính; walkover trận thật đầu tiên + cờ false → null).
3. `ruleFor` (effectiveFrom lớn nhất ≤ endDate), `pointsForEntry` (bỏ 0, nhân theo VĐV), `competitionRank` (1,2,2,4; phá hòa hiển thị: counted asc, fullName), `buildSnapshotRows` (lọc `earnedAt ≤ asOf < expiresAt`, breakdown, previousRank/movement), `pairSeedPoints`, `stageCodeRows`.
4. `pnpm --filter @kamito/ranking-engine test:coverage` ≥ 90 %; build để app khác dùng `dist`.

Test (ma trận spec): hàng 1–5, 6 (pure: 2 VĐV), 10/11 (phần chọn rule theo ngày), 12, 13, 14, 18 (pure).
Xong khi: coverage ≥ 90 %, `typecheck` + `lint` xanh, không file nào > 200 dòng.
Phụ thuộc: không.

## Gói 2 — Schema, migration, seed, processor worker

Mục tiêu: DB + tính lại/snapshot/quét chạy được trong worker, test trên Postgres thật.

Tạo
- `packages/db/prisma/schema/rankings.prisma` (5 model + 2 enum đúng spec; FK: `playerId` Restrict, `subEventId` Cascade, `entryId`/`eventId` SetNull; `createdById`/`publishedById` String? không FK, theo khuôn `Match.officialById`)
- Migration `add_ranking_lists_and_rules` (RankingList, RankingPointsRule, `SubEvent.rankingListId` FK SetNull + `rankingDirtyAt` + index một phần `WHERE "rankingDirtyAt" IS NOT NULL`)
- Migration `add_ranking_ledger_and_snapshots` + SQL viết tay: unique một phần AUTO; unique một phần DRAFT; trigger chặn INSERT/UPDATE/DELETE `RankingSnapshotRow` của snapshot PUBLISHED, chặn UPDATE/DELETE `RankingSnapshot` đã PUBLISHED (cho phép đúng 1 lần DRAFT→PUBLISHED)
- `packages/db/prisma/seed/seed-ranking-defaults.ts` (idempotent theo `code`; bảng mẫu MS/WS/MD/WD/XD; rule mẫu 1000/400/125 theo thứ tự tier, tỉ lệ vòng ghi trong file, ghi chú "dữ liệu mẫu chờ G2") + script `seed:ranking` trong `packages/db/package.json`
- `apps/worker/src/read-setting.ts`; `apps/worker/src/ranking/{ranking-deps.ts,load-sub-event-results.ts,write-ledger-rows.ts,load-snapshot-ledger.ts,write-snapshot-rows.ts}`
- `apps/worker/src/processors/{ranking-recompute-processor.ts,ranking-snapshot-processor.ts,ranking-dirty-sweep-processor.ts}`; `apps/worker/src/ranking-worker.ts` (khuôn `import-worker.ts`: Worker + scheduler quét)
- `apps/api/test/support/ranking-test-kit.ts` (nạp processor, dựng bảng/rule/giải mẫu); `apps/api/test/{ranking-recompute.e2e-spec.ts,ranking-snapshot-immutability.e2e-spec.ts}`

Sửa: `schema/tournament-event.prisma` (2 field SubEvent + relation), `schema/players-and-entries.prisma`, `schema/tournament-catalog.prisma` (back-relation Player/EventType/Category), `apps/worker/src/{main.ts,worker-env.ts,import/import-deps.ts,media-worker.ts}` (dùng `read-setting.ts`), `apps/worker/package.json` (+ `@kamito/ranking-engine`).

Bước
1. Schema phần 1 → in host+DB, chờ xác nhận → `--create-only` #1 → thêm index một phần → `migrate deploy`.
2. Schema phần 2 → `--create-only` #2 → thêm SQL tay → `migrate deploy` → `generate` → build `@kamito/db`.
3. Processor recompute theo pseudo-code (tx timeout ≥ 30 s, nạp lại từ DB, payload chỉ id); snapshot: tính lại nội dung bẩn trước (gọi thẳng hàm recompute), còn bẩn → throw kèm danh sách; createMany theo lô; quét: `rankingDirtyAt < now - dirtySweepAgeMinutes` → enqueue.
4. Seed (xác nhận target trước).

Test: hàng 6 (DB), 7 (đổi kết quả trực tiếp trong DB rồi chạy lại → không dòng thừa), 9 (đặt bẩn không enqueue → quét bắt được → sổ đúng), 10, 11, 15, 16, 17; idempotent (chạy 2 lần cùng kết quả); hiệu năng 128 entry < 2 s, 5.000 VĐV < 10 s (log thời gian, không làm test giòn).
Xong khi: 2 migration áp được trên DB sạch, `migrate status` sạch, worker boot được, e2e trên xanh.
Phụ thuộc: Gói 1.

## Gói 3 — API admin xếp hạng + queue producer

Mục tiêu: mọi endpoint admin trong spec, có quyền/step-up/audit/phân trang server.

Tạo (mỗi module: `*.module.ts`, `admin-*.controller.ts`, `*-dtos.ts`, `*.service.ts`, tách query service khi > 200 dòng)
- `modules/ranking-jobs/{ranking-jobs.module.ts,ranking-enqueue.service.ts,ranking-dirty-marker.ts,admin-ranking-jobs.controller.ts}` (`POST /admin/ranking/recompute`, `GET /admin/ranking/jobs/:id` trả trạng thái job; enqueue không bao giờ throw, trả cảnh báo `RANKING_RECOMPUTE_DELAYED`)
- `modules/ranking-lists/*` (CRUD khuôn `modules/tiers` + `common/crud/{prisma-list-query,delete-guard}.ts`; đổi `validityDays` → đánh dấu bẩn)
- `modules/ranking-rules/*` (`GET` ma trận theo `asOf` + danh sách ngày phiên bản, `GET .../impact` đếm giải sẽ tính lại, `PUT /matrix` → đánh dấu bẩn nội dung có `endDate ≥ effectiveFrom`, cùng `competitorKind`, eventType thuộc ô đổi)
- `modules/ranking-points/*` (list lọc + `POST/DELETE` chỉ MANUAL, `reason` bắt buộc, `@RequireStepUp()`, audit trước/sau)
- `modules/ranking-snapshots/{...,ranking-snapshot-publish.service.ts}` (drafts → job, list kèm số nội dung bẩn, rows phân trang `q`/sort, publish step-up + revalidate, DELETE chỉ DRAFT)
- `apps/api/test/{ranking-admin.e2e-spec.ts,ranking-recompute-race.e2e-spec.ts}`

Sửa: `apps/api/src/app.module.ts`, `modules/revalidation/cache-tags.ts` (`ranking.publish`), `apps/api/package.json` nếu cần.

Bước: quyền `@RequirePermission('rankings', ...)` (ADMIN-only sẵn trong `permissions.ts:39`); step-up theo `admin-players.controller.ts:45`; tham số list qua `parsePaginationQuery` + `PaginationLimitsService`.
Test: hàng 8 (Worker thật trong test + Redis thật: enqueue A chờ xong, enqueue B cùng nội dung → cả 2 completed, sổ phản ánh cả hai), 15 qua API, publish/điểm thủ công thiếu step-up → 403, thiếu `reason` → 422, RESULTS_OPERATOR → 403, `permission-coverage.e2e-spec.ts` xanh, audit có người/lý do.
Xong khi: mọi route bảng API spec có e2e; typecheck/lint xanh.
Phụ thuộc: Gói 2.

## Gói 4 — Nối trigger, gộp VĐV, gợi ý hạt giống, e2e trọn luồng

Trigger có thật hôm nay (đánh dấu trong tx đang có, enqueue sau commit):

| Trigger | Nơi gọi |
|---|---|
| Chốt kết quả | `match-results/match-result.service.ts` `confirm` (SubEvent đã khóa ở `loadMatchLocked`; `write()` cần trả `subEventId` để enqueue) |
| Rút khỏi nhánh (gồm cascade vòng loại→chính, walkover) | `draws/draw-post-publish.service.ts` `withdrawEntry`; `replaceEntry` (người thay vào nhận kết quả walkover) |
| Walkover chờ khi công bố nhánh | `draws/draw-publish.service.ts` `publish` (`settlePendingWalkovers`) |
| Hạng trong bảng đổi (GROUP-n) | `groups/group-admin.service.ts` `setManualRanks`, `recompute` |
| Đổi trạng thái Entry | `entries/entries.service.ts` `update` (nhánh status), `entries/entry-bulk-actions.service.ts` `apply` (withdraw) |
| Đổi `endDate`/`eventTypeId` | `events/events.service.ts` `update` (khi diff có 2 field này) |
| Hủy/bỏ hủy giải | `events/events.service.ts` `cancel`, `uncancel` (qua `change`) |
| Đổi `rankingListId` | `sub-events/sub-events.service.ts` `update` (+ nhận field trong `create`/`bulkCreate`, kiểm `competitorKind` khớp discipline → 422) |
| Đổi `validityDays`, quy tắc mới | Gói 3 (`ranking-lists`, `ranking-rules`) |
| Gộp VĐV | `players/player-merge.service.ts` `merge` (thay dòng chú thích "Phase 09 hook") |

`group-withdrawal.service.ts` `withdraw` chạy bên trong `withdrawEntry` → đánh dấu ở `withdrawEntry`, không lặp. Import commit (worker) chỉ tạo entry chưa có trận → không cần.

Tạo: `draws/draw-seed-suggestion.service.ts`; `apps/api/test/{ranking-triggers.e2e-spec.ts,ranking-flow.e2e-spec.ts}`.
Sửa: các file trong bảng + `draws/{draw-generation.service.ts,admin-draws.controller.ts,draws.module.ts,draw-dtos.ts}`, `sub-events/{sub-event-dtos.ts,sub-event-items.ts}`, các `*.module.ts` import `RankingJobsModule`, `test/player-merge.e2e-spec.ts`.
Test: mỗi trigger trong bảng → `rankingDirtyAt` được đặt (bảng hóa); hàng 7 qua API chốt; 18 (cặp A 300 + B chưa hạng → 300, rank null); 19 (gộp B vào A); `suggest-seeds` khi chưa có bảng/snapshot → `available:false`; luồng trọn: giải 16 VĐV (`test/support/draw-play-helpers.ts` `playOutKnockout`) → sổ điểm đúng → nháp → công bố → rows đúng thứ tự + breakdown (đọc qua admin rows; public endpoint thuộc phase 10).
Xong khi: e2e cũ (draws, entries, events, sub-events, match-results, player-merge) vẫn xanh.
Phụ thuộc: Gói 3.

## Gói 5 — Admin UI (Refine 5 + antd 5)

0. `ui-consistency:finding-patterns` (bound `apps/admin/src`, mẫu: `resources/tiers`, `catalog-common/*`, `pages/event-hub/*`, `pages/settings-page.tsx`) → ghi checklist vào `plans/.../ui/phase-09-ui-checklists.md`; `ui-consistency:planning` thêm 2 mẫu mới "lưới sửa tại chỗ", "xem trước rồi công bố" → `ui/phase-09-ui-plan.md`.
1. Tạo `resources/ranking-lists/{ranking-list-list.tsx,ranking-list-form.tsx}` (khuôn tiers); `pages/ranking/{ranking-routes.tsx,ranking-rules-matrix-page.tsx,ranking-rules-grid.tsx,ranking-rules-save-modal.tsx,use-ranking-rules-matrix.ts,ranking-points-page.tsx,manual-points-form.tsx,ranking-snapshots-page.tsx,snapshot-preview-page.tsx,snapshot-movement-cell.tsx,ranking-labels.ts}`.
2. Sửa `layout/menu-groups.ts` (nhóm `rankings`: Bảng xếp hạng, Quy tắc điểm, Sổ điểm, Kỳ chốt; resource `rankings`), `app.tsx` (chỉ gắn `ranking-routes`), `pages/event-hub/{sub-event-edit-modal.tsx,sub-event-format-fields.tsx}` (chọn Bảng XH, gợi ý theo loại + giới + nhóm tuổi), `draw-seeds-step.tsx` (nút "Gợi ý theo BXH" → modal xem trước → "Áp dụng"; tắt + tooltip khi `available:false`).
3. Mọi bảng `useTable({ syncWithLocation: true })` lọc/sort/phân trang server; `useListPageSize()`; công bố/xóa/điểm thủ công qua `confirm-action-button` + step-up đang có; lưới đổi màu ô đã sửa, "Lưu" 1 lần → modal ngày hiệu lực + câu "Áp cho giải kết thúc từ dd/mm/yyyy; N giải sẽ tính lại; giải đã kết thúc giữ nguyên".
4. `ui-consistency:verifying` trên các file mới/sửa; chạy thử trình duyệt (dev server) luồng 3 bước Kỳ chốt.
Test: typecheck/lint admin; e2e API đã phủ logic. Xong khi: checklist verifying không còn mục lệch, mọi file < 200 dòng.
Phụ thuộc: Gói 4 (seed suggestion, sub-event field), Gói 3 (API).

## Sau 5 gói

tester → code-reviewer → project-manager sync phase-09 + plan.md (ghi sai lệch G2) → docs-manager → hỏi commit. Deploy staging: chưa có staging → ngoài phạm vi.

## Rollback

Gói 1: gỡ package. Gói 2: migration chỉ thêm bảng/cột nullable → revert code; nếu cần bỏ hẳn viết migration ngược (không sửa migration đã áp). Gói 3–4: revert commit; dấu bẩn còn lại vô hại. Gói 5: revert UI. Snapshot đã công bố không bị đụng.

## Follow-up (chưa có code để nối)

- Mở lại / cưỡng chế kết quả (phase 07 còn lại): `match-reopen.service.ts` chưa tồn tại → khi làm phải gọi `markRankingDirty` + enqueue; hàng 7 lúc đó test qua API reopen.
- Trang công khai đọc snapshot (phase 10).

## Câu hỏi mở

1. Snapshot cũ còn dòng của VĐV nguồn sau gộp → gợi ý hạt giống cho VĐV đích hụt điểm tới kỳ chốt sau. Chấp nhận (khuyên dựng lại nháp sau gộp) hay cộng thêm dòng của `mergedIntoId`?
2. `rankingAtEntry` cho cặp để null (spec ghi "cần BTC xác nhận") — giữ.
3. Tỉ lệ điểm các vòng ngoài vô địch trong seed mẫu: chưa có nguồn (G2), dùng tỉ lệ giả định.
