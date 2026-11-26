---
phase: C1
title: "Token thiết kế và thành phần UI dùng chung (client)"
status: completed
priority: P1
effort: 3h
depends_on: []
cross_half: "Không chạy song song với A1 (A1 sửa packages/ui-tokens/src/antd-theme.ts và build-css-variables.test.ts). Chạy trước hoặc sau A1, rebase file test chung."
---

# Phase C1 — Token thiết kế và thành phần UI dùng chung

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục "Phát hiện xuyên suốt" 1–3
- Câu hỏi: [client-open-questions.md](./client-open-questions.md) Q10 (màu đỏ cho chữ nhỏ)
- Quy ước token: `docs/code-standards.md` mục Frontend → "Design token"
- Figma tham chiếu: `figma/client/1-28.png`, `1-8.png`, `1-24.png`

## Overview
- Ưu tiên: P1 (mọi phase giao diện sau dùng lại).
- Trạng thái: completed.
- Thêm token còn thiếu (màu chữ đỏ đạt AA, màu thắng/thua trên nền sáng và navy), các primitive dùng lại: tiêu đề khối có eyebrow + vạch đỏ, pill trạng thái, nút chính/viền, avatar chữ cái, biến thể tab gạch chân của `PillNav`, badge hạng giải nền màu đọc được.

## Key insights
- `#EC1E24` (`packages/ui-tokens/src/tokens.ts:4`) đạt 4,3954:1 với trắng → chỉ đạt chữ lớn. Figma dùng đỏ cho chữ nhỏ và pill nhỏ → cần token riêng. Giá trị đề xuất là mặc định, thiết kế xác nhận (Q10).
- Admin đọc `primary`, `data`, `ink`, `border`, `surface*` qua `antd-theme.ts:14-36` → **chỉ thêm token mới, không đổi giá trị cũ** để admin không đổi.
- Màu hạng giải là dữ liệu (`colorHex` trong DB), không phải token. Badge nền màu phải tự chọn chữ trắng/đen theo độ tương phản; hiện `tier-badge.tsx:6` dùng chấm màu + chữ ink chính vì lý do này.
- Font: Archivo 300–800 đã nạp (`app/[locale]/layout.tsx:15-19`). Tiêu đề Figma là Archivo đậm viết hoa; không thêm font/trục `wdth` trừ khi đo được tăng < 30 KB và Lighthouse vẫn đạt.

## Requirements
- Chức năng: token mới có trong `tokens.css`; primitive có props tối thiểu, server component (trừ khi cần state).
- Phi chức năng: mọi cặp chữ/nền mới ≥ 4.5:1 (chữ nhỏ) hoặc ≥ 3:1 (chữ ≥ 18.66px đậm, viền UI); file < 200 dòng; không hard-code hex trong component.

## Architecture
```
tokens.ts ──build──> tokens.css (CSS vars) ──> global.css (utility: .btn, .section-head)
                                         └──> *.module.css của primitive
readable-text-color.ts (WCAG luminance) ──> TierBadge (nền = tier.colorHex, chữ = trắng | ink)
```
Token mới (giá trị là mặc định, đổi được trong `tokens.ts`):

| Token | Mặc định | Dùng cho | Tương phản |
|---|---|---|---|
| `primaryText` | `#D71920` | Chữ đỏ nhỏ, nền pill nhỏ chữ trắng | ≈ 5,19:1 với trắng |
| `success` | `#15803D` | "Thắng", ▲ trên nền sáng | ≈ 5,0:1 |
| `successOnDark` | `#4ADE80` | ▲ trên navy | ≈ 8:1 với `#0F285D` |
| `dangerOnDark` | `#FF8A8A` | ▼ trên navy | ≈ 6,4:1 |
| `surfaceInk` | = `ink` | Nền header/hero/footer | — |

## Related code files
Sửa:
- `packages/ui-tokens/src/tokens.ts` (thêm token; không đổi token cũ)
- `packages/ui-tokens/src/build-css-variables.test.ts` (nếu test liệt kê biến)
- `apps/client/src/app/[locale]/global.css` (`.btn-primary`, `.btn-outline`, `.section-head`, chữ hoa tiêu đề)
- `apps/client/src/components/common/pill-nav.tsx`, `pill-nav.module.css` (prop `variant?: 'pill' | 'tabs'`)
- `apps/client/src/components/common/live-badge.tsx`, `live-badge.module.css` (dùng `StatusPill`)
- `apps/client/src/components/events/tier-badge.tsx`, `tier-badge.module.css` (prop `filled?`)
- `apps/client/src/components/players/player-hero.tsx` (dùng `InitialsAvatar` thay logic tại dòng 18)

Tạo:
- `apps/client/src/components/common/section-heading.tsx` + `.module.css` (eyebrow, h2, link "xem tất cả")
- `apps/client/src/components/common/status-pill.tsx` + `.module.css` (biến thể: live, official, scheduled, ongoing, upcoming, completed)
- `apps/client/src/components/common/initials-avatar.tsx` + `.module.css` (ảnh nếu có, không thì chữ cái đầu)
- `apps/client/src/lib/readable-text-color.ts`
- `apps/client/tests/unit/readable-text-color.test.ts`

## Implementation steps
1. Thêm token vào `tokens.ts`; build `@kamito/ui-tokens`; kiểm `tokens.css` sinh biến mới.
2. `readable-text-color.ts`: nhận hex 6 ký tự, trả màu chữ (trắng hoặc `ink`) có tương phản cao hơn; hex sai → `ink`. Test: `#EC1E24` → trắng chỉ khi ≥ 4.5, nếu không thì ink; `#FFFFFF` → ink; `#0F285D` → trắng.
3. `TierBadge filled`: nền `tier.colorHex`, chữ từ bước 2 (inline style đã được CSP `style-src 'unsafe-inline'` cho phép, `docs/public-site.md:319`). Mặc định giữ kiểu chấm cũ.
4. `StatusPill`: nhãn lấy từ dictionary truyền vào (không chuỗi cứng); live có chấm + `aria-hidden` cho chấm; không chuyển động liên tục (tôn trọng `prefers-reduced-motion`).
5. `SectionHeading`: `<h2 id>` + eyebrow `<p>` + link tùy chọn; trả `id` để section `aria-labelledby`.
6. `PillNav variant="tabs"`: gạch chân đỏ cho `aria-current`, cuộn ngang trên mobile, vùng chạm ≥ 44px.
7. `InitialsAvatar`: `alt` = tên khi có ảnh; không ảnh → `aria-hidden` (tên đã hiện cạnh).
8. Chạy `pnpm --filter @kamito/ui-tokens build test`, `pnpm --filter @kamito/client typecheck lint test`.

## Todo
- [x] Token mới + test build CSS
- [x] `readable-text-color` + unit test
- [x] `TierBadge filled`
- [x] `StatusPill`, `SectionHeading`, `InitialsAvatar`
- [x] `PillNav variant="tabs"`
- [x] typecheck/lint/unit client và ui-tokens


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-C1-client-tokens.md).

## Success criteria
- `tokens.css` có 5 biến mới; admin build không đổi (`pnpm --filter @kamito/admin build` đạt, theme antd giữ giá trị).
- Unit `readable-text-color` đạt; client unit toàn bộ đạt (`pnpm --filter @kamito/client test`).
- Không có hex mới trong `apps/client/src/components/**` (`grep -rn "#[0-9A-Fa-f]\{6\}" apps/client/src/components` chỉ ra kết quả cũ nếu có).
- Chưa đổi trang nên chưa chạy Playwright; axe chạy ở C3 trở đi.

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Đổi token cũ làm admin đổi màu | Thấp × Cao | Chỉ thêm token; kiểm build admin |
| `#D71920` lệch nhận diện thương hiệu | Trung bình × Thấp | Là mặc định trong `tokens.ts`; Q10 chốt với thiết kế |
| Badge màu admin chọn quá nhạt/đậm | Trung bình × Trung bình | Tự chọn chữ theo luminance; fallback ink |

## Security considerations
- `colorHex` từ API đi vào inline style: chỉ nhận dạng `#RRGGBB` (kiểm regex trong `readable-text-color.ts`), giá trị khác không gắn vào style.

## Next steps
- C3 dùng primitive cho header/ticker/footer; C4–C10 dùng `SectionHeading`, `StatusPill`, `TierBadge filled`.
- Rollback: revert commit của phase; token mới không được nơi nào khác phụ thuộc trước C3.
