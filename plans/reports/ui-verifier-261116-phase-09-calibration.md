# UI verifier — phase 09 calibration (2026-11-16)

Skill: `ui-consistency:verifying`. Checker chạy độc lập (không phải tác giả các bản copy). Read-only: không sửa file dự án, không chạy git.
Bound: `apps/admin/src`. Cách so: đọc từng copy theo thứ tự checklist, đếm lại các dòng checklist trên family, rồi `diff --strip-trailing-cr` copy với file gốc cùng tên trong repo để chắc phần còn lại khớp.

## Khác biệt theo file

### `scratchpad/calib/tier-list.copy.tsx` — catalog list
| Vùng | Khác biệt | Dòng checklist bị phá | Family làm gì |
|---|---|---|---|
| Hàng filter phía trên bảng | Không render `ListFilterBar` (search `q` + select `isActive`). Import `ListFilterBar`, `ACTIVE_FILTER_OPTIONS` và biến `filters`, `setFilters` vẫn còn nhưng không dùng (dòng 3, 5, 13) | filter row `ListFilterBar` (search + select) directly above the table — shared piece 13 of 13 | 13/13 file `resources/*/*-list.tsx` render `ListFilterBar` (`grep -L ListFilterBar` trả về rỗng); bản gốc `resources/tiers/tier-list.tsx:17-24` có nó |

Không thấy khác biệt khác (diff với gốc chỉ có 8 dòng này).

### `scratchpad/calib/audit-log-list.copy.tsx` — Refine list có filter
| Vùng | Khác biệt | Dòng checklist bị phá | Family làm gì |
|---|---|---|---|
| `useTable` (dòng 15) | `syncWithLocation: false` → filter/sort/trang không lên URL, reload/back mất trạng thái | server-side sort/filter/pagination with `syncWithLocation: true` — 13 of 13 | 6 list tự gọi `useTable` đều `true` (audit-log, event, import, pair, player, user) + 7 catalog qua `catalog-common/catalog-table.tsx:22` = 13/13; gốc `audit-log-list.tsx:15` là `true` |

Không thấy khác biệt khác.

### `scratchpad/calib/player-merge-modal.copy.tsx` — modal có lý do bắt buộc + step-up
| Vùng | Khác biệt | Dòng checklist bị phá | Family làm gì |
|---|---|---|---|
| Nút OK (dòng 77) | `disabled: !data?.canMerge` — không chặn khi lý do trống; bấm được "Gộp VĐV" với lý do rỗng | `okButtonProps={{ loading, disabled: <until valid, incl. required reason filled> }}` | draw-entry-action:92, amend-scores:31/47, reopen-preview:77/82 đều chặn theo lý do; gốc `player-merge-modal.tsx:77` có `|| !reason.trim()` |
| Field lý do (dòng 123) | `Form.Item label="Lý do gộp"` thiếu `required` → không có dấu bắt buộc | reason field `Form.Item label="Lý do…" required extra=…` | 3/3 modal family có `required` (draw-entry-action:149, amend-scores:73, reopen-preview:117); gốc dòng 123 có `required` |

Không thấy khác biệt khác (width 640, destroyOnHidden, cancelText "Hủy", Alert lỗi ở đầu, `useStepUp()` đều khớp).

## Đúng, nhưng không thuộc task này
- Merge modal (cả bản gốc) chỉ chặn lý do rỗng; family còn chặn độ dài tối thiểu và báo lỗi tại field (`MIN_REASON_LENGTH` draw-entry-action:43, `MATCH_REASON_MIN_LENGTH` amend-scores:29, reopen-preview:48; manual-tiebreak-modal:40). Drift có sẵn trong reference.
- Audit-log list (cả bản gốc) không có ô search — chỉ select + dateRange; dòng "search + select" là của catalog list.

## Sửa checklist
- "Catalog list (13 members)": 13 là toàn bộ `resources/*/*-list.tsx`; chỉ 7 file là catalog (dùng `useCatalogTable`). Các con số 13/13 (`ListFilterBar`, `syncWithLocation`, `rowKey="id"`) và 12/13 (`useListPageSize`, thiếu ở `user-list.tsx`) đếm đúng trên 13 file đó.
- Modal family: `reopen-preview-modal.tsx:73` dùng `footer` riêng (2 nút tự dựng), không dùng `okButtonProps`/`okText` → dòng `okButtonProps` là 2/3, không phải 3/3.

## Chưa kiểm được
- Không render: kích thước, overflow, focus/tab order thực tế, contrast — chưa đánh giá. Các copy không đổi giá trị style nào so với gốc (diff chỉ ra các dòng trên).
- Chưa chạy typecheck/lint trên copy; `tsconfig.base.json` không bật `noUnusedLocals`, nên import thừa ở tier copy có lẽ không làm hỏng build (chưa kiểm chứng ESLint).

## Chi phí
3 trang so sánh; ~22 file dự án được mở/grep (13 list, catalog-table, 4 modal, use-match-actions, 2 tsconfig, manual-tiebreak); ~9 lệnh tìm/diff. Số liệu ước lượng, chỉ một checker.
