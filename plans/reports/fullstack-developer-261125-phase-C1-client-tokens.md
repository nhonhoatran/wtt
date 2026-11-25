# Báo cáo phase C1 — token + primitive UI public site (2026-11-25)

## Đã làm
- `packages/ui-tokens/src/tokens.ts`: thêm 5 token màu (chỉ thêm, không đổi giá trị cũ): `primaryText #D71920` (chờ thiết kế duyệt, Q10), `success #15803D`, `successOnDark #4ADE80`, `dangerOnDark #FF8A8A`, `surfaceInk` (= ink). Giữ nguyên thay đổi A1 ở `antd-theme.ts`.
- `build-css-variables.test.ts`: thêm 2 test (5 biến CSS mới; `primary` admin không đổi).
- `apps/client/src/lib/readable-text-color.ts`: `readableTextColor`, `contrastRatio`, `isHexColor` (chỉ nhận `#RRGGBB`, sai -> ink). Test `tests/unit/readable-text-color.test.ts`, gồm kiểm tương phản >= 4.5 cho các cặp token mới (primaryText/trắng, success/trắng, successOnDark/navy, dangerOnDark/navy).
- `TierBadge`: prop `filled` (nền `colorHex` + chữ theo độ tương phản); `colorHex` sai định dạng không gắn vào style; mặc định giữ kiểu chấm cũ.
- Mới: `status-pill` (live/official/scheduled/ongoing/upcoming/completed, nhãn truyền vào, chấm `aria-hidden`, không animation), `section-heading` (eyebrow + h2 có `id` + vạch đỏ + link tùy chọn, vùng chạm 44px), `initials-avatar` (ảnh hoặc chữ cái, `initialsOf` dùng chung).
- `PillNav variant="tabs"`: gạch chân đỏ cho `aria-current`, cuộn ngang, cao >= 44px. Mặc định `pill` không đổi.
- `LiveBadge` nay dựng trên `StatusPill` (không chấm, giữ kích thước gọn cũ cho bracket/lịch); API không đổi.
- `PlayerHero` dùng `initialsOf` (nay viết hoa chữ cái).
- `global.css`: `.btn-primary`, `.btn-outline`, `.heading-caps`.

## Kiểm tra (chạy thật)
- ui-tokens: `pnpm build` OK; `pnpm test` 8/8 pass; `pnpm typecheck` sạch. `tokens.css` có đủ 5 biến mới.
- client: `pnpm typecheck` sạch; `pnpm lint` sạch; `pnpm test` 23 file / 106 test pass.
- admin: `pnpm typecheck` sạch. Chưa chạy `pnpm build` admin (phase yêu cầu typecheck; token cũ không đổi giá trị).
- Grep hex 6 ký tự trong `apps/client/src/components`: chỉ còn 1 dòng cũ (`contact-form.module.css:13`, fallback của `--color-danger`), không do phase này thêm.
- Chưa kiểm tra trình duyệt/axe: chưa trang nào dùng primitive mới (đúng phạm vi phase); `LiveBadge` đổi nền qua `StatusPill` nhưng chưa chụp so sánh bracket/lịch.

## Lệch so với phase file
- Không đổi `.page-title` thành chữ hoa (sẽ đổi text hiển thị ở mọi trang, có thể ảnh hưởng e2e theo text); thay bằng utility `.heading-caps` để C3+ áp dụng từng trang.
- `.btn-primary` dùng `primaryStrong #A31115` (trắng/đỏ ~8:1), vì `primary #EC1E24` + chữ trắng chỉ 4.4:1.
- Chưa có `section-head` utility trong global.css; component `SectionHeading` thay thế.

## Câu hỏi mở
- Q10: designer duyệt `#D71920`?
- `LiveBadge` có nên hiện chấm trong bracket/lịch không (hiện tắt để giữ mật độ)?

**Status:** DONE_WITH_CONCERNS
**Summary:** Token + primitive xong, typecheck/lint/test ui-tokens, client, admin typecheck đều sạch.
**Concerns:** Chưa xác nhận bằng trình duyệt/axe vì chưa có trang dùng primitive; `LiveBadge` đổi nền bằng CSS chưa chụp so sánh.
