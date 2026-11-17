# Phase 09 UI - agent 1 (tasks 1-4)

Status: DONE_WITH_CONCERNS. Admin typecheck: only 2 expected errors (missing `ranking-snapshots-page`, `snapshot-preview-page`, owned by agent 2). Lint (`eslint src`): clean. Not browser-tested.

## Files
Modified: catalog-common/catalog-access.ts (`useCatalogAccess(permission = 'tournaments')`), catalog-common/catalog-row-actions.tsx (prop `permission`), layout/menu-groups.ts (4 items), app.tsx (`...rankingResources`, `{rankingRoutes}`).
catalog-table.tsx unchanged: `actionsColumn` spreads the callback result, so `permission` passes through without edits.
Created: resources/ranking-lists/{ranking-list-list,ranking-list-form}.tsx; pages/ranking/{ranking-routes.tsx, ranking-labels.ts, ranking-points-page.tsx, manual-points-form.tsx, ranking-points-delete-modal.tsx, use-ranking-points-filter-options.ts}.

## Ready for check
- Catalog list: `/ranking-lists` (ranking-list-list.tsx), create/edit (ranking-list-form.tsx)
- List kind: `/ranking-points` (ranking-points-page.tsx)
- Modals: manual-points-form.tsx, ranking-points-delete-modal.tsx

## API gaps / deviations
1. Ranking-list rows have no `category` include, so list column Nhóm tuổi maps `categoryId` to name via `useCatalogRows('categories')` (active categories only; a hidden category shows '—'). Fix: add `include: { category }` in RankingListsService config.
2. Points rows have no sub-event/content name, only `stageCode` and `event`. "Giải + nội dung" column shows event name only. Fix: add `subEvent` to INCLUDE in ranking-points-query.service.ts.
3. Edit page is custom (`RankingListEdit` with `useForm` + `Edit`), not `CatalogEditPage`. Reason: `CatalogEditPage` (not mine) has no `onMutationSuccess`, and PATCH returns recompute `warnings` that must go through `showWarnings`. Create uses `CatalogCreatePage`. Better long-term: `CatalogEditPage` accepts `onSuccess`.
4. Ledger filter is named `active` (true/false), not `expired`. Sort fields allowed: earnedAt, expiresAt, points, createdAt; sortable columns are Điểm, Ngày tính, Hết hạn.
5. Edit: Thời hạn is required on edit, since `null` fails the zod `optional()`. Create: blank = default.
6. Not implemented, no sub-event column. Player search `q` on `/admin/players` not re-verified in API; the `useSelect` follows the tier pattern.

## Copy I invented (a person should read)
- Thời hạn extra (create): "Bỏ trống để dùng thời hạn mặc định trong Cài đặt hệ thống."
- Thời hạn extra (edit): "Đổi thời hạn sẽ tính lại ngày hết hạn của điểm trong bảng này." (from checklist)
- Nhóm tuổi extra: "Bỏ trống nếu bảng áp dụng cho mọi nhóm tuổi."
- Switch extra: "Bật để điểm vòng bảng khác nhau theo thứ hạng chung cuộc của bảng (nhất, nhì...)."
- Manual points: "Nhập số âm để trừ điểm."; "Bỏ trống để tính theo ngày tính cộng thời hạn của bảng xếp hạng."; "Ngày hết hạn phải sau ngày tính"; "Điểm phải khác 0"
- Messages: "Đã thêm điểm thủ công", "Đã xóa dòng điểm thủ công"; delete modal "Xóa {n} điểm của {VĐV}? Không hoàn tác được.", title "Xóa dòng điểm thủ công", okText "Xóa điểm", label "Lý do xóa"
- Filter placeholders: "Đơn hoặc đôi", "Giới tính", "Vận động viên", "Giải", "Nguồn", "Hiệu lực" (Còn hạn / Hết hạn)
- Error: "Không tải được sổ điểm"
- Menu labels exactly per brief. Refine resource labels: Bảng xếp hạng / Sổ điểm / Kỳ chốt.

## Notes
- ranking-labels.ts re-exports `COMPETITOR_KIND_LABELS/OPTIONS`, `GENDER_RULE_LABELS/OPTIONS` from resources/disciplines/discipline-form (no duplicate). Own exports: `POINTS_SOURCE_{LABELS,COLORS,OPTIONS}`, `SNAPSHOT_STATUS_{LABELS,COLORS,OPTIONS}`, `POINTS_VALIDITY_OPTIONS`, types `PointsSource`, `SnapshotStatus`.
- `rankingRoutes` / `rankingResources` exported from ranking-routes.tsx; routes `/ranking-snapshots/:id` use action 'show' (maps to `read`).
- Loading/error states render below the filter bar so filter inputs keep typed state.
- Dates parsed with local-timezone dayjs (`@db.Date` returns UTC midnight; fine for VN, off by one west of UTC).
- Table JSX inside the loading ternary in ranking-points-page.tsx is not re-indented (lint passes).
- Personal-address grep over the touched folders: clean.

**Status:** DONE_WITH_CONCERNS
**Summary:** Tasks 1-4 implemented; typecheck only fails on the 2 missing agent-2 modules, lint clean.
**Concerns/Blockers:** API gaps 1-2 (category and sub-event names not returned); custom edit page instead of `CatalogEditPage`; no browser run.

## Follow-up (approved scope)
- API: `RankingListsService` config now has `include: { category: { id, code, name } }` (list/get/create/update rows). `RankingPointsQueryService` INCLUDE adds `subEvent: { id, code, name }` (display title = name ?? code; no shared title helper exists in the API).
- Admin: `CatalogCreatePage` / `CatalogEditPage` take optional `onSaved(response)`; the 7 existing catalogs are unchanged. `RankingListEdit` now uses `CatalogEditPage` (custom useForm/Edit deleted); Create and Edit pass `showWarnings`. Nhóm tuổi column reads `row.category?.name`; the `useCatalogRows` lookup is gone. Sổ điểm "Giải" column shows event name with the sub-event name (or code) as secondary text.
- Checks: api `tsc --noEmit` clean; admin lint clean; admin typecheck has only the missing `./snapshot-preview-page` (agent 2).
- Tests (grep, not run): ranking-admin-lists-rules.e2e-spec.ts and ranking-admin-points.e2e-spec.ts assert on `code`, `points`, audit `toMatchObject` only, so the added fields should not break them. Note: the audit `after` view for ranking-list create/update now also contains the nested `category` object, while `before` does not (existing row is read without include); the update audit test uses toMatchObject and should pass.
