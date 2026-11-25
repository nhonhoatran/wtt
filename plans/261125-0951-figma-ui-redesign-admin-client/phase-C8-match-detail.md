---
phase: C8
title: "Chi tiết trận (1-11)"
status: pending
priority: P2
effort: 3h
depends_on: [C1, C2, C7]
---

# Phase C8 — Chi tiết trận

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục 1-11
- Câu hỏi: Q6 (trọng tài)
- Figma: `figma/client/1-11.png` (chốt, dạng wireframe xám), `1-10.png`
- Hiện có: `app/[locale]/events/[slug]/matches/[matchNo]/page.tsx:1-110`, `components/matches/match-score-table.tsx`, `match-detail.module.css`

## Overview
- Ưu tiên: P2.
- Bố cục: breadcrumb (← nhánh/bảng; giải · nội dung · vòng; trạng thái) → bảng điểm lớn 2 bên (avatar chữ cái, hạt giống, tên, CLB, tổng ván) → hàng meta (bàn, ca, giờ, thời lượng) → "Điểm từng ván" (bảng hiện có) → câu tóm tắt → "Đường đến trận này" (mỗi bên) → sidebar: thông tin trận, trận tiếp theo, trận khác cùng vòng.

## Key insights
- Dữ liệu thêm lấy từ endpoint có sẵn: trận nhánh → `getBracket(slug, sub, kind)` (tag `draw-<slug>-<code>`, đã được `match.*` làm mới); trận bảng → `getGroups(slug, sub)`. Không thêm API ngoài A2 (bàn), A8 (ca).
- `lib/bracket-derivations.ts` (C7) cho trận kế, trận cùng vòng; thêm hàm "đường đến trận" (lần ngược `WINNER_OF` qua các vòng trước, dừng ở vòng đầu/nguồn khác).
- Thời lượng = `officialAt − startedAt` (cả hai có); thiếu → ẩn.
- Câu tóm tắt sinh bằng template dictionary (vi/en), chỉ khi OFFICIAL: "{winner} thắng {a}–{b}" (+ "vào {round} gặp {opponent}" khi trận kế đã có đối thủ). Không viết câu cho walkover/retired khác template riêng.
- Bỏ "Diễn biến trận đấu" (lặp bảng điểm) và chú thích trạng thái (nhãn tự đủ nghĩa).
- Ảnh VĐV, "Hạng 8 · 1.540 điểm": cần API mới → hoãn (gap). Trọng tài: không có dữ liệu, không suy từ `officialById` (Q6).
- `page.tsx` 110 dòng → tách component, giữ `load()` một lời gọi chính.

## Requirements
- Chức năng: như Overview; trận SCHEDULED hiện "–" và giờ dự kiến; trận void giữ ghi chú (`page.tsx:82`); walkover/retired hiện nhãn kết quả.
- Phi chức năng: một `<h1>` (giữ nội dung tiêu đề hiện tại cho SEO: "Trận N · nội dung · vòng"); metadata giữ (`page.tsx:31-37`); axe 0; 390 không tràn (bảng ván trong `ScrollRegion`).

## Architecture
```
MatchPage
  ├ getMatch(slug, matchNo)                       tag match-<slug>-<no>
  └ (song song sau khi biết drawKind)
      ├ drawKind MAIN/QUALIFYING → getBracket(slug, sub, kind) → derive: path, next, sameRound
      └ GROUP → getGroups(slug, sub) → các trận cùng bảng
  render: MatchScoreboard, MatchMetaRow, MatchScoreTable, MatchSummary, MatchPath ×2, MatchSidebar
```

## Related code files
Sửa:
- `apps/client/src/app/[locale]/events/[slug]/matches/[matchNo]/page.tsx`
- `apps/client/src/components/matches/match-detail.module.css`, `match-score-table.module.css`
- `apps/client/src/lib/bracket-derivations.ts` (thêm `pathToMatch`)
- `apps/client/tests/unit/bracket-derivations.test.ts`
- `apps/client/src/i18n/vi.json`, `en.json` (`match.*`)
- `apps/client/tests/e2e/event-pages.spec.ts` (ca trang trận dòng 72)

Tạo:
- `apps/client/src/components/matches/match-scoreboard.tsx`
- `apps/client/src/components/matches/match-meta-row.tsx`
- `apps/client/src/components/matches/match-summary-sentence.ts` (thuần, test `tests/unit/match-summary-sentence.test.ts`)
- `apps/client/src/components/matches/match-path.tsx`
- `apps/client/src/components/matches/match-sidebar.tsx`

## Implementation steps
1. `pathToMatch` + test (trận vòng 1 không có đường; trận chung kết nhánh 8 có 2 trận trước mỗi bên; bên từ vòng loại).
2. `match-summary-sentence.ts` + test vi/en.
3. Tách component; page ghép + gọi dữ liệu phụ song song; lỗi dữ liệu phụ → ẩn khối phụ, trang vẫn 200.
4. Scoreboard: `InitialsAvatar`, `TierBadge` không cần; tên link hồ sơ như cũ (`SidePlayers`).
5. Sidebar: trận kế (link), danh sách cùng vòng/bảng (link, trạng thái).
6. Thêm route trang trận vào axe (C11 gom) và chạy e2e.

## Todo
- [ ] `pathToMatch` + test
- [ ] Câu tóm tắt + test
- [ ] Tách component, dữ liệu phụ song song
- [ ] Sidebar trận kế/cùng vòng
- [ ] e2e trang trận + axe

## Success criteria
- `event-pages.spec.ts` (trang trận có bảng điểm từng ván) đạt desktop + mobile; axe route trang trận 0 vi phạm (vi, en).
- Unit mới đạt; `typecheck lint build` đạt.
- Trận bảng, trận vòng loại, trận chưa xếp lịch đều HTTP 200, không khối rỗng.

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Thêm `getBracket` làm trang trận chậm với nhánh lớn | Trung bình × Thấp | JSON đã cache Redis; chạy song song sau `getMatch` |
| Suy sai đường đến trận khi có section/vòng loại | Trung bình × Thấp | Chỉ hiện khi chuỗi nguồn khép kín; test nhiều cấu hình |

## Security considerations
- Không hiện người chốt kết quả (`officialById` là dữ liệu nội bộ, không có trong whitelist).

## Next steps
- C9. Rollback: revert commit.
