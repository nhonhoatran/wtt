# Phase A11 — Trang "Bảng xếp hạng" (theo từng BXH): KPI kỳ, so với kỳ trước, chốt bảng

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-46 / 1-49"
- Figma: `figma/admin/1-49.png`, `1-46.png` (cuối, gần như trùng), `1-42…1-45.png`, `1-48.png`
- Code: `apps/admin/src/pages/ranking/snapshot-preview-page.tsx` (156), `snapshot-rank-table.tsx`, `snapshot-movement-cell.tsx`, `snapshot-breakdown-table.tsx`, `snapshot-draft-modal.tsx`, `snapshot-jobs-tracker.tsx`, `ranking-snapshots-page.tsx`, `ranking-routes.tsx`, `apps/admin/src/layout/menu-groups.ts`; API `ranking-snapshots/ranking-snapshots-query.service.ts:52-72`, `admin-ranking-snapshots.controller.ts` (publish có `@RequireStepUp`); schema `rankings.prisma` (`RankingSnapshotRow.previousRank/movement`, `RankingPointsEarned.expiresAt` có index `[rankingListId, expiresAt]`)
- Câu hỏi mở: Q4 (xuất Excel BXH)

## Overview
- Ưu tiên: P2. Effort: ~6h (API 2.5h, UI 3.5h). Trạng thái: pending. Phụ thuộc: A1, A10 xong trước để tránh đụng `menu-groups.ts` song song.
- Trang mới `/rankings`: pill BXH → bản đang làm (DRAFT mới nhất, nếu không có thì bản PUBLISHED mới nhất) với KPI, bảng hạng so kỳ trước, "Chốt bảng kỳ này" (= công bố bản nháp, vẫn step-up).

## Key insights
- Không có khái niệm "kỳ đánh số" (Figma "Kỳ 46/2026"); kỳ = `asOfDate`. Tiêu đề phụ: "Bản tạm tính ngày dd/mm/yyyy · tạo lúc HH:mm · Kỳ trước chốt ngày dd/mm/yyyy".
- "Chốt bảng kỳ này" = `POST /admin/ranking-snapshots/:id/publish` có step-up mật khẩu → popconfirm Figma đi kèm hộp nhập lại mật khẩu (hành động không hoàn tác; snapshot PUBLISHED bất biến bằng trigger). Nút khoá khi `dirtySubEvents > 0` (giữ quy tắc hiện tại) + nút "Tính lại ngay".
- Chưa có bản nháp → nút chính "Tạo bản tạm tính" (mở `snapshot-draft-modal.tsx` sẵn có, chọn sẵn BXH đang xem).
- KPI: VĐV có điểm = số dòng; thay đổi thứ hạng = `movement ≠ 0`; VĐV mới = `previousRank IS NULL` (chỉ khi có kỳ trước); điểm hết hạn trong kỳ = tổng `points` ledger của BXH có `expiresAt ∈ (asOf kỳ trước, asOf kỳ này]`.
- "Điểm kỳ trước": đọc dòng của snapshot PUBLISHED trước đó cùng BXH cho các `playerId` trong trang (1 truy vấn `in`) → không đổi schema.
- Lọc "Tất cả CLB" dạng dropdown cần danh sách CLB riêng → bỏ (YAGNI); ô tìm tìm theo tên, mã **và CLB** (server). Giữ toggle "Chỉ hiện VĐV có thay đổi" (server filter).
- Menu: "Bảng xếp hạng" → `/rankings`; danh mục BXH (`/ranking-lists`) đổi nhãn "Danh mục BXH" và chuyển vào nhóm Cấu hình; "Kỳ chốt" giữ (link "Lịch sử các kỳ" → `/ranking-snapshots?filters…listId`).

## Requirements
API (không đổi schema)
- `GET /admin/ranking-snapshots/:id/summary` (quyền `rankings.read`) → `{ rows, changed, newcomers, expiredPoints, previous: { id, asOfDate, publishedAt } | null }`.
- `GET /admin/ranking-snapshots/:id/rows`: thêm `player.club`; `previousPoints` mỗi dòng; `q` khớp cả `club`; `filter[changed]=true` → `OR [movement ≠ 0, previousRank null]`.
UI
- `PageHeader` "Bảng xếp hạng" + Tag "Tạm tính"/"Đã chốt"; nút: "Lịch sử các kỳ" · (Q4) "Xuất Excel" · primary "Chốt bảng kỳ này" | "Tạo bản tạm tính".
- Pill BXH (active, theo `order`; > 6 BXH thì chuyển Select có tìm) đồng bộ `?list=`.
- 4 `StatCard`.
- Card lọc: tìm VĐV/CLB (debounce sẵn có) · Switch "Chỉ hiện VĐV có thay đổi" · "Đặt lại".
- Bảng (server, `useTable`): Hạng · So với kỳ trước (▲n xanh / ▼n đỏ / "–" / Tag "Mới" + "kỳ trước: hạng x") · VĐV · CLB · Điểm · Điểm kỳ trước · Chênh lệch (±) · Số giải tính điểm · "Chi tiết điểm" (expand row dùng `snapshot-breakdown-table.tsx`). Màu ▲/▼ kèm ký hiệu + text cho người mù màu.
- Trang `/ranking-snapshots/:id` giữ nguyên (đích của "Lịch sử các kỳ").

## Architecture
```
RankingBoardPage (/rankings?list=)
 ├─ useQuery ranking-lists (active, small)          GET /admin/ranking-lists?filter[isActive]…
 ├─ useCurrentSnapshot(listId)                        GET /admin/ranking-snapshots?filter[listId]&filter[status]=DRAFT&sort=asOfDate:desc&pageSize=1 (fallback PUBLISHED)
 ├─ useQuery summary                                  GET /admin/ranking-snapshots/:id/summary
 ├─ RankingBoardActions (publish → confirm → useStepUp → POST publish)
 ├─ RankingBoardStats (4 StatCard)
 └─ RankingBoardTable (useTable resource `ranking-snapshots/:id/rows`, filters q/changed)
API: RankingSnapshotSummaryService (count × 2, aggregate sum ledger, find previous) ; rows(): + club, + previousPoints, + changed filter
```

## Related code files
Sửa (API)
- `apps/api/src/modules/ranking-snapshots/ranking-snapshots-query.service.ts` (club, previousPoints, filter changed, q club) — nếu vượt 200 dòng tách `ranking-snapshot-rows-query.ts`
- `apps/api/src/modules/ranking-snapshots/admin-ranking-snapshots.controller.ts` (route summary trước `:id`… thứ tự hợp lệ vì `:id/summary`)
- `apps/api/src/modules/ranking-snapshots/ranking-snapshots.module.ts`
- `apps/api/test/ranking-admin-snapshots.e2e-spec.ts`
Tạo (API)
- `apps/api/src/modules/ranking-snapshots/ranking-snapshot-summary.service.ts`
Sửa (admin)
- `apps/admin/src/pages/ranking/ranking-routes.tsx` (route `/rankings`, resource)
- `apps/admin/src/layout/menu-groups.ts` (đích "Bảng xếp hạng", dời danh mục BXH)
- `apps/admin/src/pages/ranking/snapshot-movement-cell.tsx` (dòng phụ "kỳ trước: hạng x", Tag Mới)
- `apps/client/tests/admin-full-flow/rankings.ts` (nếu đi qua menu; hiện đi URL `/ranking-snapshots` — giữ)
Tạo (admin)
- `apps/admin/src/pages/ranking/ranking-board-page.tsx`
- `apps/admin/src/pages/ranking/use-current-snapshot.ts`
- `apps/admin/src/pages/ranking/ranking-board-actions.tsx`
- `apps/admin/src/pages/ranking/ranking-board-stats.tsx`
- `apps/admin/src/pages/ranking/ranking-board-table.tsx`
- `apps/admin/src/pages/ranking/ranking-board-labels.ts` (thuần: delta, nhãn kỳ) + `apps/admin/test/ranking-board-labels.test.mjs`

## Implementation steps
1. API summary service + route; rows mở rộng; e2e (có/không kỳ trước; changed filter; q theo CLB; previousPoints đúng).
2. `ranking-board-labels.ts` + test.
3. Hook snapshot hiện hành; actions (dùng lại `useConfirmAction`, `useStepUp`, xử lý `RANKING_SNAPSHOT_STALE` như `snapshot-preview-page.tsx:91-97`).
4. Stats, table (expand breakdown), page; route + menu.
5. typecheck/lint/test/build; api e2e ranking.

## Todo
- [ ] summary API + e2e
- [ ] rows: club, previousPoints, changed, q club
- [ ] labels + test
- [ ] hook + actions (step-up)
- [ ] stats/table/page
- [ ] route + menu
- [ ] build/test xanh

## Success criteria
- Chốt bảng: hỏi xác nhận (nêu số VĐV đổi hạng từ summary) → hỏi mật khẩu → công bố; sai mật khẩu không công bố.
- Toggle "chỉ thay đổi" → request có `filter[changed]=true`, tổng trang đổi.
- Chênh lệch = điểm − điểm kỳ trước khớp e2e; VĐV mới hiện "Mới", chênh lệch = điểm.
- Không có bản nháp → nút "Tạo bản tạm tính" mở modal đã chọn BXH.

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| "Kỳ trước" chọn sai (nhiều PUBLISHED cùng ngày?) | Thấp × TB | Lấy `asOfDate < current.asOfDate` mới nhất, `status=PUBLISHED`; e2e |
| Tổng điểm hết hạn hiểu sai ranh giới | TB × Thấp | Định nghĩa (prev, current] ghi trong docs + tooltip KPI |
| Đổi đích menu làm người quen bối rối | TB × Thấp | Danh mục BXH vẫn còn ở Cấu hình; nhãn rõ |
Rollback: revert; route/endpoint mới độc lập, snapshot preview cũ giữ nguyên.

## Security considerations
- Publish vẫn `rankings.publish` + step-up; summary/rows `rankings.read`. Không lộ breakdown ngoài quyền hiện có.

## Next steps
- Q4 xuất Excel BXH. Cập nhật `docs/` (bảng route admin, ranking) ở bước docs.
