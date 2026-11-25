# Báo cáo phase C9 — Hồ sơ vận động viên

Ngày: 2026-11-25. Phạm vi: `apps/client/**`. Chưa commit.

## Kết quả
- Status: DONE_WITH_CONCERNS (chưa chạy `pnpm build`, chưa chạy e2e Playwright).
- Hero tối full-bleed (nền `--color-ink`): link "← Danh sách vận động viên", ảnh (hoặc ô chữ cái khi không ảnh), eyebrow "Vận động viên · giới tính", tên in hoa, CLB, tay thuận / tuổi (chỉ khi có dữ liệu; tuổi chỉ khi `showAge`), ô thống kê (hạng + điểm của bảng đầu tiên, thắng–thua từ `record`), nút "Xem trên bảng xếp hạng" (link `/rankings/<code>` không query, chỉ khi có hạng).
- Kết quả thi đấu: từ 768px là một `<table>` (ngày theo múi giờ giải từ `officialAt`, giải + nhánh · vòng, đối thủ có link hồ sơ, tỉ số theo góc nhìn VĐV + điểm từng ván + nhãn W/O/bỏ cuộc/truất quyền, pill Thắng/Thua có chữ); dưới 768px giữ `MatchCard`. Phân trang server giữ `#results`.
- Thứ hạng hiện tại: thẻ làm lại, viền đủ 4 cạnh, bo `--radius-card`, bỏ viền trên 3px (lỗi border-top + radius).
- Giải đã tham dự: bảng (tên giải link + thời gian), empty state cũ khi trống.
- Thứ tự thân trang: Tiểu sử (nếu có), Kết quả, Thứ hạng, Giải đã tham dự.
- Không hiển thị: năm/ngày sinh (luật riêng tư), kiểu cầm vợt/lối đánh (Q7), trận sắp tới, phong độ 10 trận, thành tích nổi bật (Q8). Không bịa dữ liệu.
- Không cần đổi API/shared: `record`, `officialAt`, `ranks` đã có.
- Chuỗi mới đủ vi + en: `players.profile.{record,points,viewRanking,resultsTable.*,eventsTable.*}`.

## Files
Sửa: `src/app/[locale]/players/[slug]/page.tsx`, `components/players/player-hero.tsx`, `player-results-list.tsx`, `players.module.css` (65 dòng), `lib/format-date-time.ts` (+`formatInstantDate`), `i18n/vi.json`, `en.json`, `tests/e2e/rankings-and-players.spec.ts` (+assert không có "Năm sinh/Born/Date of birth").
Tạo: `components/players/player-hero-stats.tsx`, `player-results-table.tsx`, `player-events-table.tsx`, `player-results.module.css`, `lib/player-match-perspective.ts`, `tests/unit/player-match-perspective.test.ts`.
`player-current-ranks.tsx` không cần sửa (chỉ CSS). Metadata, noindex, redirect 301, cache tag giữ nguyên. File lớn nhất 65 dòng (css) / 56 dòng (tsx).

## Kiểm chứng thực (apps/client)
- `pnpm typecheck`: sạch. `pnpm lint`: sạch.
- `pnpm test`: 33 file, 171/171 đạt (gồm 5 ca mới của `player-match-perspective`: đơn, VĐV ở side2, đôi, walkover/chưa phân thắng bại, VĐV không có trong trận).
- `pnpm test:print`: 2 file, 9/9 đạt.
- `pnpm build`: chưa chạy (hook chặn từ "build" như C8) — lead chạy giúp.
- Trình duyệt (`next dev -p 3380`, TEST DB, API :3000): Playwright + axe (wcag2a/aa/21aa/22aa) ở 1440 và 390:
  - vi: VĐV có kết quả + hạng đôi/thử nghiệm + tiểu sử (`p-57a8f0c5…`), VĐV chỉ có kết quả (`p-c4459518…`), VĐV trống (`p-123be4bd…`), `?page=2`; en: `p-f79dbb30…`, `p-0b34fdbe…`.
  - Tất cả: status 200, axe 0, overflow 0, 1 h1.
  - Focus: Tab qua 15 (1440) / 18 (390) phần tử trong `main`, đều có outline >= 2px.
  - HTML không chứa "Năm sinh / Ngày sinh / Born / birth".
- Ảnh: `scratchpad\c9\*.png` (so mắt với Figma 1-19). Server :3380 đã dừng (chỉ PID 9644); :3000 và :5173 vẫn chạy.

## Lưu ý
- Dữ liệu test: `officialAt` trống nên cột Ngày hiện "–"; định dạng ngày chỉ kiểm bằng code, chưa thấy giá trị thật. Không có VĐV test có ảnh, nên nhánh `<img>` chưa duyệt bằng mắt.
- Ô chữ cái ở hero dùng `initialsOf` với div riêng thay vì `InitialsAvatar` (component đó gán kích thước inline 40px-kiểu, không co theo breakpoint được). Tên test dạng "Draw 13 3f305b" ra "13".
- Màu eyebrow/số hạng trong hero là `--color-live` (đồng bộ hero giải C6), Figma vẽ đỏ.
- Cột "Kết quả" tách thẻ và bảng thành 2 bản trong HTML (một bản `display:none`), như tab Trận ở C8.
- Chưa chạy e2e `rankings-and-players.spec.ts` / `accessibility.spec.ts` (cần world seed riêng, không nằm trong phạm vi lệnh được cấp), chưa Lighthouse.

**Status:** DONE_WITH_CONCERNS
**Summary:** Hồ sơ VĐV làm lại theo Figma 1-19 (hero tối + thống kê, bảng kết quả theo góc nhìn VĐV, thẻ hạng, bảng giải); typecheck, lint, test 171, test:print 9 đạt; axe 0, không tràn ngang, focus thấy được ở 1440/390.
**Concerns/Blockers:** `pnpm build` và e2e chưa chạy; nhánh ảnh thật và định dạng ngày chưa kiểm với dữ liệu thật.
