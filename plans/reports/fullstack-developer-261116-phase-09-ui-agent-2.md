# Phase 09 UI – agent 2 (tasks 5, 6): Quy tắc điểm + Kỳ chốt

Trạng thái: sẵn sàng cho checker. `pnpm typecheck` và `pnpm lint` (apps/admin) sạch. Không chạy e2e/browser.

## File tạo (apps/admin/src/pages/ranking/)
Task 5: ranking-rules-matrix-page.tsx, ranking-rules-grid.tsx, ranking-rules-save-modal.tsx, use-ranking-rules-matrix.ts, ranking-stage-labels.ts, ranking-rules-copy-column.tsx, ranking-rules-unsaved-guard.ts
Task 6: ranking-snapshots-page.tsx, snapshot-draft-modal.tsx, snapshot-preview-page.tsx, snapshot-movement-cell.tsx, snapshot-breakdown-table.tsx, snapshot-rank-table.tsx, snapshot-jobs-tracker.tsx
Import từ ranking-labels.ts (COMPETITOR_KIND_OPTIONS, SNAPSHOT_STATUS_*) – không định nghĩa trùng. Stage label tái dùng `roundTitle` của event-hub/draw-labels.ts (F/SF/QF/R<n>).

## Lệch checklist / quyết định
- `useBlocker` không dùng được: app chạy `BrowserRouter` (không phải data router). Thay bằng `useUnsavedGuard` (bọc `navigator.push/go` như @refinedev/react-router + `beforeunload`, hỏi bằng `modal.confirm`). Đổi kind/draw/version khi có ô sửa cũng đi qua guard này (cùng một hộp hỏi). Nút Back của trình duyệt không chặn được (giới hạn chung). Nếu muốn chặn đủ: chuyển app.tsx sang data router (ngoài phạm vi).
- "Tính lại ngay" ở trang xem trước KHÔNG gọi `POST /admin/ranking/recompute`: endpoint đó bắt buộc `subEventId` hoặc `eventTypeId`, mà `GET /admin/ranking-snapshots/:id` chỉ trả số `dirtySubEvents`, không trả id. Thay vào đó gọi `POST /admin/ranking-snapshots/drafts {listIds:[list], asOfDate}`: worker tự tính lại các nội dung dirty rồi dựng lại bản nháp (id snapshot mới) -> trang tự chuyển sang bản nháp mới khi job xong.
- Polling job: `GET /admin/ranking/jobs/:id` mỗi 2s (hằng `SNAPSHOT_JOB_POLL_MS`, nội bộ cố định) tới state completed/failed; 404 coi như đã xong. Job lỗi: Alert error liệt kê bảng + "N nội dung chưa tính lại được" (parse từ failedReason của worker; không khớp thì in nguyên văn).
- Cột lưới ẩn hạng giải `isActive=false`.
- Ô xóa trắng (null) = hoàn về giá trị gốc (API không có xóa quy tắc).
- Bảng rank dùng resource `ranking-snapshots/${id}/rows` qua data provider (không đăng ký Refine resource).

## API gap (không sửa backend)
1. Không có tên người công bố: snapshot chỉ có `publishedById` (plain id). UI hiện "Đã công bố lúc …" mà KHÔNG có "bởi …". Cần API trả `publishedBy {id,name}` nếu muốn đủ checklist.
2. Không có id sub-event dirty ở snapshot detail (xem trên) -> không gọi recompute trực tiếp được.
3. Impact endpoint trả `{subEvents, events}`; copy ghi "N giải (M nội dung) …" theo `events`/`subEvents`.

## Copy tự đặt, cần người đọc
- Stage: "Vòng loại – vòng cuối" (QF-1), "Vòng loại – trước vòng cuối N vòng" (QF-(N+1)), "Vòng bảng – hạng N", "Vô địch (W)".
- Impact: "Áp cho giải kết thúc từ dd/mm/yyyy; N giải (M nội dung) đang diễn ra hoặc chưa diễn ra sẽ tính lại; giải đã kết thúc giữ nguyên."
- Guard: "Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?" nút "Bỏ thay đổi"/"Ở lại".
- Copy cột: popover "Sao chép cột", "Chép điểm từ hạng giải" / "sang hạng giải", nút "Sao chép", "Sao chép cột từ…".
- Select phiên bản: "Hiện hành" + ngày; "Có ô chưa hợp lệ" (422 trong modal).
- Draft modal: "Tạo bản nháp", "Bảng xếp hạng" (placeholder "Tất cả bảng"), "Tính đến ngày"; "Đang dựng bản nháp (x/y)…", "Không dựng được bản nháp".
- Preview: "Xóa bản nháp?", tooltip "Còn N nội dung chưa tính lại, hãy tính lại trước khi công bố", Alert description "Bản nháp này chưa phản ánh kết quả mới nhất. Tính lại sẽ dựng lại bản nháp.", toasts "Đã gửi yêu cầu tính lại", "Đã công bố bảng xếp hạng", "Đã xóa bản nháp".
- Table: "Chưa tính lại", "Hiệu lực" (earnedAt → expiresAt) trong breakdown.

## Chưa kiểm
Chưa chạy trên trình duyệt: guard bọc navigator, `useTable` với resource động, `Select` giá trị '' (Hiện hành), InputNumber readOnly ở phiên bản cũ. Nên chạy thử khi task 9.

**Status:** DONE_WITH_CONCERNS
**Summary:** Tasks 5–6 UI viết xong, typecheck + lint sạch, mỗi file < 200 dòng.
**Concerns/Blockers:** thiếu tên người công bố ở API; "Tính lại ngay" đi đường dựng lại bản nháp vì recompute cần subEvent/eventType id; không dùng được useBlocker (BrowserRouter).

## Follow-up: publishedBy
- apps/api ranking-snapshots-query.service.ts: list + detail now return `publishedBy: {id,name} | null` (one `user.findMany` over distinct publishedById; `publishedById` kept; deleted user -> null).
- UI: list column "Công bố lúc / bởi" (`time · name`), preview Descriptions "Đã công bố lúc … bởi <name>". Type `SnapshotRecord.publishedBy` added.
- api typecheck, admin typecheck, admin lint: clean.
- apps/api/test grep (report only): no test asserts the snapshot response shape beyond list/detail status codes and rows (ranking-admin-snapshots.e2e-spec.ts:51 list by filter, :75 404); no assertion on exact keys of a snapshot object found, so the extra field should not break them. e2e not run.

## Follow-up: UI checker findings (ui-verifier-261116-phase-09-pages.md)
- Matrix: edits stored with scope `kind|draw|version`, never read/sent under another scope (reset on scope change); grid + copy column + "Lưu" disabled while `isPlaceholderData`; load error shows Result even with old data (grid hidden). Only the current rules (asOf empty or = today) are editable; past AND future versions read-only. Hidden event types shown only if they hold rules, titled "(đã ẩn)" (`visibleEventTypes`, also feeds copy-column).
- Save modal: error Alert at top (Flex gap token); /impact failure -> Alert error; `DATE_ONLY_FORMAT` replaces local ISO_DATE (hook, modal, draft modal).
- Snapshots list: row-click removed, Link in first cell only; filter+table wrapped in `div` (no doubled spacing; same in rank table); list filter uses all ranking lists incl. hidden (`snapshot-list-options.ts`); date column and draft-modal field renamed "Ngày chốt"; job tracker stops polling on any error and shows "Không kiểm tra được tiến độ dựng bản nháp" for non-404.
- Preview: tags on line under title; Tooltip wraps `<span>` around disabled "Công bố"; delete confirm content "Không khôi phục được sau khi xóa."; player cell via `playerCodeName`.
- Decided: Popover (not Dropdown) for "Sao chép cột từ…" — Popover thay Dropdown vì cần 2 lựa chọn nguồn/đích.
- Not done (not mine): status label "Bản nháp" lives in ranking-labels.ts (agent 1). admin typecheck + lint clean.

## Follow-up: code review (code-reviewer-261116-phase-09-ui.md)
- H1: save modal DatePicker disables dates before the server's today (`data.asOf` of the matrix without asOf). Baseline = matrix as of the chosen date (fetched when != today); only edits differing from it are sent; OK disabled + info Alert when none; warning Alert "Đã có phiên bản từ dd/mm/yyyy; ô không sửa ở phiên bản đó vẫn giữ giá trị của nó."; impact sentence only when cells are sent.
- M6: readOnly = explicit `asOf` param (any version view); "Hiện hành" has no asOf = editable; no local "today" used for editability.
- M1: cells `disabled` + no step controls when locked (read-only / stale / no `rankings.update`). L4: save bar hidden without update permission.
- L2: `ranking-rules-cell.tsx`: clearing resolved on blur (reverts to stored value); save bar text "Để trống một ô = giữ giá trị cũ". L3: popover note about blank source cells.
- L1: guard wraps `navigator.replace` too.
- M3: preview keyed by id (state/jobs reset). M7: "Tính lại ngay" `loading` while job runs; alert stays so retry after failure works. L6: publish 409 `RANKING_SNAPSHOT_STALE` -> refetch + closable error Alert.
- L10: impact/baseline alert shows Skeleton while fetching. Draft modal date picker disables future days (local day; no server today available there).
- L5: snapshot-list-options.ts deleted; list uses `useCatalogRows('ranking-lists', { isActive: '' })` (use-catalog-options `listUrl` drops `filter[isActive]` when its value is empty; default unchanged). `RANKING_NOTE_MAX_LENGTH` in packages/shared/src/ranking-limits.ts, used by admin modal and ranking-rule-dtos.ts; shared rebuilt.
- L8: `rows()` only checks the snapshot exists (select id) instead of calling get().
- Checks: admin typecheck+lint clean; api typecheck+lint clean; e2e ranking-admin-snapshots + ranking-admin-lists-rules: 2 files, 9 tests passed (DB from anchored `^DATABASE_URL=` line: localhost:5433/kamito_tt_dev).
