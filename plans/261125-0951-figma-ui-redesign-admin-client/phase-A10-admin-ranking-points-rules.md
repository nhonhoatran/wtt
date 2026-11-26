# Phase A10 — Quy tắc điểm xếp hạng: ma trận theo Figma, lỗi tại ô, giá trị trước, thanh chưa lưu dính

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-40"
- Figma: `figma/admin/1-40.png` (cuối), `1-36…1-39.png`
- Code: `apps/admin/src/pages/ranking/ranking-rules-matrix-page.tsx` (97), `ranking-rules-grid.tsx`, `ranking-rules-cell.tsx`, `ranking-rules-state.ts` (+ test `apps/admin/test/ranking-rules-state.test.mjs`), `ranking-rules-save-modal.tsx`, `ranking-rules-unsaved-guard.ts`, `ranking-rules-copy-column.tsx`, `use-ranking-rules-matrix.ts`, `apps/admin/src/resources/ranking-lists/ranking-list-form.tsx:48`; schema `rankings.prisma` (`RankingPointsRule`, `RankingList.validityDays`)
- Câu hỏi mở: Q12 (khôi phục mặc định)

## Overview
- Ưu tiên: P3. Effort: ~3h. Trạng thái: in-progress. Phụ thuộc: A1. Không đổi API.

## Key insights
- Giữ các control Figma bỏ sót nhưng có nghĩa nghiệp vụ: Vòng chính/Vòng loại (`RULE_DRAW_OPTIONS`), xem phiên bản cũ (chỉ đọc), "Chép cột", modal lưu có ngày hiệu lực (quy tắc có phiên bản theo `effectiveFrom`).
- Không làm "+ Thêm vòng đấu": mã vòng suy từ cấu trúc nhánh (W, F, SF, QF, R16…, GROUP-n) — thêm vòng tự do sẽ tạo quy tắc không bao giờ khớp.
- Không làm "Khôi phục mặc định" tới khi có Q12 (hệ thống không có bộ mặc định; cần định nghĩa "mặc định" là gì).
- "Thời hạn hiệu lực" là của từng BXH (`validityDays`), không toàn cục → hiện khối chỉ đọc liệt kê BXH + thời hạn + link sửa (`/ranking-lists/:id/edit`), danh sách phân trang server.
- Ô trống hiện tại = giữ giá trị cũ (`ranking-rules-matrix-page.tsx:75`). Giữ ngữ nghĩa đó; lỗi tại ô chỉ cho giá trị âm/không phải số nguyên. Chữ hướng dẫn chuyển thành placeholder ô.
- Giá trị gốc đã có trong state → "trước: n" dưới ô đã sửa là UI thuần; mở rộng `ranking-rules-state.ts` (có test sẵn) cho `invalidCells`.

## Requirements
- `PageHeader` "Quy tắc điểm xếp hạng" + mô tả "Điểm VĐV nhận theo hạng giải và vòng đạt được. Thay đổi chỉ áp dụng cho các giải kết thúc từ ngày hiệu lực."
- Card "Bảng điểm theo hạng giải và vòng đấu": góc phải Segmented Đơn/Đôi + Vòng chính/Vòng loại + chọn phiên bản; cột = hạng giải (Tag `colorHex`), hàng = vòng (nhãn tiếng Việt từ `ranking-stage-labels.ts`).
- Ô: InputNumber canh phải; đã sửa → nền `colorWarningBg` + "trước: n"; lỗi → viền đỏ + chữ "Nhập số điểm, từ 0 trở lên".
- Chân card: "Chép cột…" (giữ) · link "Quản lý hạng giải" → `/event-types`.
- Card "Thời hạn hiệu lực của điểm": bảng BXH (tên, thời hạn ngày, link Sửa), phân trang server.
- Thanh dính đáy (chỉ khi có sửa): chấm cam "N thay đổi chưa lưu" · "M ô cần sửa" (đỏ) · "Huỷ thay đổi" · "Lưu thay đổi" (disabled khi M>0) → mở modal lưu hiện có.
- Guard rời trang giữ nguyên.

## Architecture
```
RankingRulesMatrixPage
 ├─ PageHeader
 ├─ RankingRulesToolbar (kind, draw, version)
 ├─ RankingRulesGrid → RankingRulesCell(value, original, invalid)
 ├─ RankingValidityCard → useTable('ranking-lists', server)
 ├─ RankingRulesUnsavedBar (sticky) → RankingRulesSaveModal (unchanged)
 └─ useUnsavedGuard (unchanged)
state: ranking-rules-state.ts (+ invalidCells, originalOf)
```

## Related code files
Sửa
- `apps/admin/src/pages/ranking/ranking-rules-matrix-page.tsx`
- `apps/admin/src/pages/ranking/ranking-rules-grid.tsx`
- `apps/admin/src/pages/ranking/ranking-rules-cell.tsx`
- `apps/admin/src/pages/ranking/ranking-rules-state.ts`
- `apps/admin/test/ranking-rules-state.test.mjs`
- `apps/client/tests/admin-full-flow/rankings.ts` (nút `'Lưu'` → `'Lưu thay đổi'`)
Tạo
- `apps/admin/src/pages/ranking/ranking-rules-toolbar.tsx`
- `apps/admin/src/pages/ranking/ranking-rules-unsaved-bar.tsx`
- `apps/admin/src/pages/ranking/ranking-validity-card.tsx`

## Implementation steps
1. State: `invalidCells`, `originalOf` + test.
2. Cell/grid: trạng thái sửa/lỗi, "trước: n".
3. Toolbar, unsaved bar, validity card.
4. Ghép page; kiểm guard rời trang + đổi Đơn/Đôi khi đang sửa (hành vi hiện tại giữ).
5. E2E selector; typecheck/lint/test/build.

## Todo
- [x] state + test
- [x] cell/grid
- [x] toolbar / unsaved bar / validity card
- [x] ghép page
- [x] Build và unit test đạt
- [x] E2E admin-full-flow sau redesign (kiểm cùng C11) — đạt 2026-11-26: desktop 8/8 một lượt, mobile 8/8 hai lượt; [báo cáo](../reports/tester-261126-1620-admin-full-flow-after-redesign.md)


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-A10-ranking-rules.md).

Các bước triển khai, unit, build và kiểm tay đã có bằng chứng; E2E admin-full-flow sau đổi nhãn nút đạt ngày 2026-11-26 (bước 8 sửa ma trận điểm qua giao diện).

## Success criteria
- Nhập "-5" → ô đỏ ngay, nút Lưu khoá, thanh hiện "1 ô cần sửa".
- Sửa 3 ô → thanh "3 thay đổi chưa lưu"; Huỷ → về giá trị cũ; Lưu → modal ngày hiệu lực như cũ.
- Xem phiên bản cũ: chỉ đọc, không hiện thanh.
- Test `ranking-rules-state.test.mjs` xanh.

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Thanh dính che hàng cuối | TB × Thấp | padding-bottom |
| Hiểu nhầm ô trống = 0 | TB × TB | Placeholder "giữ giá trị cũ"; "trước: n" |
Rollback: revert; không đổi API.

## Security considerations
- Lưu theo quyền `rankings.update` như cũ; khối thời hạn chỉ link tới form có `RequireAccess`.

## Next steps
- Q12.
