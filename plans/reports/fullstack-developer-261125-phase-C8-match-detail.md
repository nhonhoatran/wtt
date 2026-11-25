# Báo cáo phase C8 — Chi tiết trận + bảng trận desktop

Ngày: 2026-11-25. Phạm vi: `apps/client/**`. Chưa commit.

## Kết quả
- Status: DONE_WITH_CONCERNS (chưa chạy được `pnpm build`, xem Lưu ý).
- Trang trận (1-11): breadcrumb (← nhánh/bảng + pill trạng thái), eyebrow giải, h1 giữ nguyên nội dung; bảng điểm 2 bên (avatar chữ cái, hạt giống, tên link hồ sơ, CLB, tỉ số ván giữa ở >= 768px, mobile mỗi bên một số); hàng meta (bàn, ca, giờ, thời lượng; ẩn mục thiếu dữ liệu); "Điểm từng ván" (bảng cũ); câu tóm tắt (chỉ OFFICIAL, không void; W/O, bỏ cuộc, truất quyền dùng mẫu riêng); "Đường đến trận này"; sidebar (thông tin trận, trận tiếp theo, trận khác cùng vòng / cùng bảng).
- Không hiển thị: trọng tài (Q6), ảnh VĐV, hạng/điểm (cần API mới), "Diễn biến trận đấu", chú thích trạng thái. Không bịa dữ liệu.
- Dữ liệu phụ: `getBracket` (trận nhánh) hoặc `getGroups` (trận bảng) gọi song song với `getHomeContent` (lấy `itemsPerSection` làm giới hạn danh sách sidebar, fallback `contentSettings` mặc định). Lỗi một trong các lời gọi -> khối phụ ẩn, trang vẫn 200. Cùng hàm/tag cache với trang nhánh/bảng.
- Tab Trận (1-8): từ 1024px là một `<table>` (caption ẩn, `th scope`, cột giờ·bàn là row header, nội dung·vòng, VĐV + hạt giống + CLB + người thắng in đậm kèm chữ ẩn "Người thắng", tỉ số + điểm từng ván, pill trạng thái + nhãn W/O/Không tính, link "Chi tiết" có aria-label). Dưới 1024px giữ `MatchCard`. Cùng `list.items`, cùng lọc/phân trang server-side. Cả hai bản cùng có trong HTML, một bản `display:none` theo cỡ màn hình.
- Chuỗi mới đủ vi + en (`match.*`, `matches.table.*`).

## Files
Sửa: `app/[locale]/events/[slug]/matches/[matchNo]/page.tsx`, `.../matches/page.tsx`, `components/matches/match-detail.module.css`, `match-card.module.css` (lớp `.cardsOnly`), `lib/bracket-derivations.ts` (+`locateMatch`, `pathToMatch`, `followUpMatch`), `i18n/vi.json`, `en.json`, `tests/unit/bracket-derivations.test.ts`.
Tạo: `components/matches/match-scoreboard.tsx|.module.css`, `match-meta-row.tsx|.module.css`, `match-summary-sentence.ts`, `match-summary.tsx|.module.css`, `match-path.tsx|.module.css`, `match-sidebar.tsx|.module.css`, `match-table.tsx|.module.css`; `lib/load-match-context.ts`; `tests/unit/match-summary-sentence.test.ts`.
File lớn nhất 187 dòng (test); mã nguồn <= 160 dòng.

## Kiểm chứng thực
- `pnpm typecheck`: sạch (exit 0).
- `pnpm lint`: sạch.
- `pnpm test`: 32 file, 166/166 đạt (gồm bracket-derivations mới và match-summary-sentence mới; metadata/JSON-LD tests đạt).
- `pnpm test:print`: 2 file, 9/9 đạt.
- `pnpm build`: KHÔNG chạy được. Hook `scout-block` của dự án chặn mọi lệnh Bash có chữ "build" ("BLOCKED: Access to 'build' denied", cấu hình `.claude/.ckignore`). Không né hook. Cần chủ repo thêm `!build` vào `.ckignore` hoặc tự chạy `pnpm build`.
- Thay thế: chạy `next dev -p 3370` (TEST DB qua `with-test-db.mjs`, API :3000) để duyệt trình duyệt; build production chưa kiểm.
- Playwright + axe (wcag2a/aa, 21aa, 22aa) ở 1440, 1024, 390; kết quả: status 200, axe 0, overflow 0, 1 h1:
  - `/vi/events/entries-3f305b/matches/8` (bán kết, có ván, có trận kế + cùng vòng).
  - `/vi/.../matches/12`, `/13`, `/en/.../matches/11` (trận bảng, "Trận khác trong bảng A"), `/vi/.../matches/10` (chưa đấu).
  - `/vi|en/events/rank-ad596c2d/matches/1` (chung kết, có "Đường đến trận này").
  - Tab Trận: `/vi/.../entries-3f305b/matches?state=completed`, `/en/...?state=upcoming`, `/vi/events/entries-dc9ac4/matches`: bảng hiện từ 1024, thẻ ở 390. Lần chạy đầu axe báo `target-size` (link tên VĐV trong ô bảng); đã sửa (`.side a` cao 24px), chạy lại axe 0.
- Focus: Tab qua 18/35/27 phần tử trong `main` (trận 1440, tab Trận 1440, trận 390), đều có outline >= 2px trừ `<input type=date>` của bộ lọc có sẵn (`FilterForm`, không thuộc C8).
- Ảnh: `scratchpad\c8\*.png` (so Figma 1-11 và 1-8 bằng mắt). Server :3370 đã dừng (chỉ PID 30784); :3000 và :5173 không đụng.

## Lưu ý / chưa làm
- Chưa chạy Playwright e2e (`event-pages.spec.ts` ca trang trận vẫn khớp: h2 + bảng "Điểm từng ván"), chưa thêm route trang trận vào axe e2e (spec nói C11 gom), chưa Lighthouse.
- Dữ liệu test chỉ có 1 trận có "Đường đến trận này" (chung kết `rank-ad596c2d` #1, một bên); chuỗi 2+ bước chỉ được kiểm bằng unit test.
- Tab Trận render hai bản (thẻ + bảng) vào HTML, tăng kích thước HTML tương ứng số trận mỗi trang.
- Avatar lấy chữ cái cuối của hai từ cuối tên (hàm `initialsOf` có sẵn): tên test dạng "Draw 10 3f305b" ra "13".
- Giờ hiển thị dạng "08:00 01-05" là `formatMatchTime` có sẵn, không đổi.
- Hạt giống ở bảng điểm hiển thị "Hạt giống N" (huy hiệu), không có "Hạng 8 · điểm".

## Câu hỏi còn mở
- Cho phép `build` trong hook `.ckignore`, hoặc chủ repo chạy `pnpm build` để chốt bước kiểm production?

**Status:** DONE_WITH_CONCERNS
**Summary:** Trang trận C8 và bảng trận desktop hoàn tất; typecheck, lint, test (166), test:print (9) đạt; axe 0, không tràn ngang, focus thấy được ở 1440/1024/390 (dev server).
**Concerns/Blockers:** `pnpm build` bị hook chặn nên chưa kiểm build production; chưa chạy e2e/Lighthouse.
