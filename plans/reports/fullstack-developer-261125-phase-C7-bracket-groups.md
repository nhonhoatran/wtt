# Báo cáo phase C7 — Nhánh đấu và bảng đấu

Ngày: 2026-11-25. Phạm vi: `apps/client/**`. Chưa commit. Không đụng `apps/api`, `packages/shared`, admin, `.env`, DB.

## Kết quả
- Status: DONE_WITH_CONCERNS.
- Nhánh đấu (Figma 1-24 / 1-34):
  - Ô trận: ô hạt giống, tên (link hồ sơ giữ nguyên), CLB hiện chữ, điểm từng ván + tổng ván, "Bàn · giờ" (bàn từ `table.displayName` hoặc "Bàn {code}"), `StatusPill` (Sắp đấu / Đang đấu / Đã có kết quả), kết quả W/O..., link "Chi tiết →" tới trang trận (`aria-label` "Chi tiết trận #N: A – B"), dòng "Thắng → Bán kết 1". BYE: "Miễn đấu", không pill, không link.
  - Người thắng: chữ đậm + vạch đỏ + chữ ẩn "Người thắng:" cho trình đọc màn hình (không chỉ màu). Chú thích trạng thái phía trên nhánh.
  - Tiêu đề vòng có ngày ("Tứ kết · 14/03", ngày = min `scheduledAt` theo múi giờ giải; không có giờ thì chỉ tên vòng). Cột "Vô địch" cuối hàng (chỉ nhánh chính, một section, vòng cuối đúng 1 trận): tên + CLB khi chung kết đã OFFICIAL, không thì "Chưa xác định".
  - Mobile ≤ 640px: chip vòng (link `?round=N`, `aria-current`), dòng "Vòng x/y · N trận" + "N đã có kết quả", chỉ hiện một vòng; desktop và in luôn đủ cột. Mặc định = vòng đầu còn trận chưa xong, hết thì vòng cuối. `round` sai/không có trong section -> mặc định. Không JS vẫn đổi vòng (đã kiểm). Canonical/metadata không đổi (`?draw=` như cũ). Cache tag không đổi.
  - Link "Xem vòng bảng" khi `hasGroups`; trang bảng đấu thêm "Xem nhánh đấu" khi có nhánh.
  - Hoãn: ô "Tìm VĐV trong nhánh" (theo spec), thẻ "Vòng sau" của 1-34.
- Bảng đấu: thẻ mỗi bảng (đầu navy "BẢNG A · 3 CẶP/VĐV theo `competitorKind`"), cột Hạng, VĐV, CLB, Trận, Thắng, Thua, Ván, Điểm (mobile gọn: Hạng, VĐV + CLB dưới tên, T–B, Ván, Điểm), vạch đỏ + chữ ẩn "Đi tiếp" cho hàng đi tiếp, chú thích "Đi tiếp" chỉ hiện khi có hàng đi tiếp. Lưới 2 cột desktop. Giữ `<table>`, `caption`, `scope`; thẻ trận dùng `MatchCard` của C6 (không fork).
- Tách CSS: `event-hero.module.css` 229 -> 164 (phần footer/nút CTA sang `event-hero-actions.module.css`, 71 dòng, class đổi sang module mới trong `event-hero.tsx`, không đổi giao diện). `bracket.module.css` 219 -> 188; còn `bracket-cell.module.css` 196, `bracket-nav.module.css` 119, `bracket-champion.module.css`.
- Suy dữ liệu (thuần, có test, dùng lại ở C8): `lib/bracket-derivations.ts`. Lưu ý: khi ô đã có VĐV thật thì `side?Source` rỗng (thấy ở dữ liệu test), nên trận kế dùng WINNER_OF trước, thiếu thì suy theo vị trí (i -> i/2) chỉ khi vòng sau đúng bằng nửa vòng trước; bố cục lệch thì không đoán.
- Sửa nhỏ: `formatShortDay` dựng "dd/MM" từ `formatToParts` vì `Intl` vi-VN ra "15-12".

## Files
Sửa: `src/app/[locale]/events/[slug]/draws/[subEventCode]/page.tsx`, `.../groups/[subEventCode]/page.tsx`, `components/bracket/{bracket-board,bracket-round-column,bracket-match-cell}.tsx`, `bracket.module.css`, `components/groups/group-standings.{tsx,module.css}`, `components/events/{event-hero.tsx,event-hero.module.css}`, `lib/format-date-time.ts`, `i18n/{vi,en}.json` (`bracket.*`, `groups.*`), `tests/e2e/event-pages.spec.ts`, `tests/offline/bracket-print.test.ts` (nạp thêm module CSS mới; đo `.name` ở module ô).
Tạo: `lib/bracket-derivations.ts`, `components/bracket/{bracket-round-chips,bracket-legend,bracket-champion,bracket-print-sheets}.tsx`, `bracket-cell.module.css`, `bracket-nav.module.css`, `bracket-champion.module.css`, `components/groups/groups-page.module.css`, `components/events/event-hero-actions.module.css`, `tests/unit/bracket-derivations.test.ts`.
Đổi chữ: `bracket.bye` "BYE" -> "Miễn đấu" (en "Bye"). Nhãn "LIVE" trong ô nhánh -> "Đang đấu" (khóa `bracket.live` vẫn dùng ở nơi khác).

## Kiểm chứng thực (apps/client)
- `pnpm typecheck`: sạch (exit 0; lỗi admin-group-withdrawal của C6 không còn).
- `pnpm lint`: sạch.
- `pnpm test`: 31/31 file, 156/156 test đạt (gồm `bracket-derivations` 13 case: nhánh 8, 64, vòng loại, trận chưa xếp giờ, BYE, múi giờ, fallback vị trí). `admin-group-withdrawal.test.ts` đạt ở lần chạy này.
- `pnpm test:print`: 2 file, 9/9 đạt (64 suất đơn/đôi, vi/en, A4/A3, 5 PDF/bản). Lần đầu rớt (tờ đôi 736px > 718px do ô cao hơn); đã gọn kiểu in (ẩn ván/CLB/chân ô/chip/chú thích, bớt padding) -> tờ đôi 648px, đơn 561px. Chưa mở ảnh PDF thủ công, chưa chạy `audit-bracket-pdf.py`.
- `pnpm build`: biên dịch thành công, các route vẫn ƒ (dynamic).
- Trình duyệt (Next :3360 trên DB test, Playwright + axe wcag2a/2aa/21aa/22aa), 1440 và 390:
  - `/vi/events/entries-3f305b/draws/MS`, `/vi/events/entries-dc9ac4/draws/MS`, `/vi|en/.../groups/MD`, `/en/.../draws/MS`, `?round=2`: axe 0 vi phạm, tràn ngang 0px.
  - `?round=2` ở 390: hiện đúng trận 5, 6; `?round=99|abc|trống`: về vòng mặc định (1-4); desktop với `?round=2` vẫn hiện đủ 7 trận; chip ẩn ở desktop; tắt JS cho kết quả y hệt; bấm chip đổi URL + vòng.
  - Phím Tab: mọi phần tử tab được (link tên, "Chi tiết", vùng cuộn, tab) đều có outline 2px solid.
  - Ảnh: `scratchpad\c7\*.png`; script `check.mjs`, `check2.mjs` cùng thư mục.
- Server :3360 chỉ PID do em chạy đã dừng; API :3000 và admin :5173 không đụng.

## Lưu ý / chưa làm
- Chưa chạy Playwright e2e (`test:e2e`, accessibility, site-chrome-and-seo) vì global-setup dựng world qua API/DB dùng chung; chỉ thêm 2 test vào `event-pages.spec.ts` (link "Chi tiết trận", cột Vô địch, `?round` ở 390/1440) — logic tương đương đã kiểm bằng script nhưng test chưa chạy. Chưa chạy Lighthouse.
- Dữ liệu test không có nhánh có điểm ván/bàn/giờ/nhà vô địch/hàng "đi tiếp" lớn: các phần đó (chip ván, "Bàn · giờ", nhà vô địch, vạch đi tiếp, nhánh nhiều section) kiểm bằng unit test hoặc đọc code, chưa xem trên ảnh thật. Ô có dữ liệu ván đã thấy ở trận #2 (điểm 11-11-11, tổng 3-0).
- Ô nhánh cao hơn (min-height 184px) nên nhánh 64 suất dài hơn trước trên màn hình (đúng Figma, đã nêu ở rủi ro của spec); chưa đo Lighthouse.
- Tên VĐV trong ô desktop vẫn cắt "…" như Figma (đầy đủ ở trang trận và `aria-label` của link "Chi tiết"); mobile đủ chỗ.
- Lệch Figma có chủ ý: tab Bảng đấu giữ riêng (không lặp dưới nhánh), có link; không có ô tìm VĐV; nhãn trận giữ "Trận #N" (không "Tứ kết 1") vì e2e và số trận công khai.

## Câu hỏi còn mở
- Có cần thẻ "Vòng sau: Bán kết · 15/03" ở cuối mỗi vòng trên mobile (1-34) không, hay dòng "Thắng → ..." trong từng ô là đủ?

**Status:** DONE_WITH_CONCERNS
**Summary:** Nhánh đấu (ô trận mới, ngày vòng, vô địch, chú thích, chip vòng mobile `?round`), restyle bảng đấu, tách CSS hero/bracket; typecheck/lint/test/test:print/build đạt, axe 0 và không tràn ngang ở 1440/390.
**Concerns/Blockers:** e2e và Lighthouse chưa chạy; một số trạng thái dữ liệu (nhà vô địch, hàng đi tiếp, giờ/bàn) chưa có trong DB test nên chưa xem trên ảnh; PDF in chưa mở xem thủ công.
