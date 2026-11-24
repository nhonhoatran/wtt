# Code review 2026-11-24: CI fix + admin mobile + e2e reopen qua BYE

Phạm vi: các thay đổi chưa commit trong `D:\Project\wtt` (51 file, +288/-122) cộng 3 file mới. Không tính .docx/markdown trong `plans/`, `docs/`.
Cách làm: đọc diff, đối chiếu với code gọi tới, types antd 5.29.3 / Next 16.4.5 / rc-drawer 7.3.0 trong node_modules. Không chạy test (e2e cần DB).

## Critical

**C1. CI chạy `seed:config` lúc `@kamito/db` chưa được build, job `build-test` sẽ rớt trên runner sạch**
- `.github/workflows/ci.yml:132` chạy `pnpm --filter @kamito/db seed:config` ngay sau `prisma migrate deploy`.
- `packages/db/prisma/seed/seed-config-defaults.ts:4` import `../../dist/index.js`. `dist/` bị ignore (`.gitignore:2`, `git ls-files` không có file nào). Trước bước này không có bước nào build: `migrate deploy` chỉ gọi Prisma CLI, còn `lint`/`typecheck` (dependsOn `^build`) chạy sau.
- Kết quả: `ERR_MODULE_NOT_FOUND`, job dừng trước `pnpm test`. Chạy thử trên "DB CI tạm" ở máy local vẫn đạt, nhiều khả năng vì `packages/db/dist` đã có sẵn từ lần build trước (chưa kiểm chứng).
- Sửa: thêm một bước build trước seed (turbo tự build `@kamito/shared` nhờ `^build`, và chạy `prisma generate`):
  ```yaml
  - run: pnpm --filter @kamito/db exec prisma migrate deploy
  - run: pnpm exec turbo run build --filter=@kamito/db
  - run: pnpm --filter @kamito/db seed:config
  ```
  Có thể dời seed xuống sau `pnpm typecheck`, nhưng khi đó thứ tự chạy phụ thuộc ngầm vào graph turbo. Không nên.

## High

Không có.

## Medium

**M1. Đổi "session" → "buổi" chưa xong, nhưng plan/changelog đã ghi là đóng**
- `apps/admin/src/pages/event-hub/match-sheets-print-page.tsx:121`: `"Chưa chọn session để in"`.
- Lỗi API hiện thẳng trên admin (`message.error(error.message)` / lỗi gắn vào field):
  - `apps/api/src/modules/sessions/sessions.service.ts:37`: "Không tìm thấy session"
  - `apps/api/src/modules/sessions/sessions.service.ts:160`: "Có bàn không thuộc địa điểm của session"
  - `apps/api/src/modules/sessions/sessions.service.ts:188`: "Mã session X đã tồn tại trong giải". Câu này hiện ngay cạnh field mới tên "Mã buổi".
  - `apps/api/src/modules/scheduling/scheduling-errors.ts:5`, `:23`: "Không tìm thấy session", "Bàn không thuộc session này"
- File Excel xuất lịch: header `'Session'` tại `apps/api/src/modules/exports/schedule-export.service.ts:13`.
- Selector E2E thì đã khớp nhãn mới (xem phần "Đã kiểm, ổn").

**M2. `contact-message-list.tsx` bị script bỏ sót**
- `apps/admin/src/resources/content/contact-message-list.tsx:26` vẫn để `scroll={{ x: true }}`. Trên điện thoại bảng này vẫn bẻ chữ, không giống các list khác.
- (`results-entry-page.tsx:145` giữ `{ x: true }` là có chủ ý vì đã có cột tóm tắt. Các bảng `group-card`, `session-grid`, `ranking-rules-grid` vốn đã dùng `max-content`.)

**M3. Dưới `md`, `max-content` làm cột chữ dài không xuống dòng**
- `x: 'max-content'` làm mỗi ô rộng bằng nội dung không ngắt dòng. Với cột chữ tự do (ví dụ "Ghi chú kiểm tra" ở `apps/admin/src/components/import-preview-table.tsx:109-122`, tiêu đề bài viết ở `content-lists.tsx`), một câu lỗi dài kéo cả bảng rộng gấp nhiều lần màn hình 390px, người dùng phải cuộn ngang mới đọc hết.
- Gợi ý: những cột chữ dài thì giới hạn chiều rộng và cho ngắt dòng lại, ví dụ `onCell={() => ({ style: { minWidth: 200, maxWidth: 320, whiteSpace: 'normal' } })}`. Chưa kiểm bằng trình duyệt; nên để ui-audit xác nhận.

**M4. `--env-mode=loose` chỉ nằm trong script gốc**
- `package.json:13`. Chạy `pnpm exec turbo run test --filter=@kamito/api` hay gọi turbo trực tiếp thì vẫn ở strict mode, `DATABASE_URL`/`REDIS_URL` lại bị lọc mất.
- Bền hơn: khai báo `passThroughEnv` (hoặc `env`) cho task `test` trong `turbo.json`, liệt kê `DATABASE_URL`, `REDIS_URL`, `MIGRATE_CONFIRM_TARGET`, `QUEUE_PREFIX`, `S3_*`... Không chặn merge.

## Low

- **L1** `apps/api/test/match-reopen-group-winner-through-bye.e2e-spec.ts:77`: `sub()` đọc `fx.subEvents`. Nếu `beforeAll` lỗi trước khi gán `fx`, `afterAll` ném `TypeError`, không tới được `kit.close()` (dòng 80) và che mất lỗi gốc. Sửa: `[fx?.subEvents.MS].filter(Boolean)`.
- **L2** `apps/admin/src/layout/admin-layout.tsx`:
  - `drawerOpen` không reset khi màn hình nở qua `lg`. Đang mở drawer mà kéo rộng rồi thu hẹp lại thì drawer tự mở ra.
  - Drawer không có `title` nên dialog không có tên cho trình đọc màn hình. Cân nhắc thêm `title` hoặc `aria-label`.
- **L3** Sau lần mở đầu tiên, root `.ant-drawer` của menu vẫn nằm trong DOM với `position: fixed; inset: 0` (rc-drawer `Drawer.js:114-115` dùng `autoDestroy: false`; antd `drawer/style/index.js:36-40`). Playwright sẽ coi nó là `:visible`, nên `page.locator('.ant-drawer:visible')` ở `apps/client/tests/admin-full-flow/ui.ts:85` và `results.ts:78,103,130` có thể bắt trúng 2 phần tử. Hiện chưa vỡ: flow 390 không mở menu, và các `getByRole` con vẫn chỉ ra một kết quả. Nhưng dễ gãy. Nên scope theo drawer kết quả (ví dụ `.ant-drawer-open`).
- **L4** `apps/admin/src/pages/settings-page.tsx:63-73`:
  - Chỉnh field ở tab A rồi chuyển qua tab B thì giá trị chưa lưu vẫn còn (Tabs không huỷ pane), nhưng không có dấu hiệu nào báo tab A còn thay đổi chưa lưu.
  - Ctrl+F không còn tìm được setting nằm ở tab khác.
  - Tiêu đề Card lặp lại nhãn tab.

## Đã kiểm, ổn

- **Rules of hooks:** cả 29 chỗ gọi `useTableScroll()` (27 file) đều nằm ở dòng đầu thân đúng component dùng `scroll={tableScroll}`, trước mọi early return (ví dụ `sponsors-tab.tsx:56` trước `:66`, `sub-events-tab.tsx:15` trước `:25`). `content-lists.tsx` có 3 component, mỗi cái tự gọi hook riêng (`:12`, `:29`, `:38`). Trong `admin-layout.tsx`, `Grid.useBreakpoint`/`useState` nằm ở `:18-19`, trước early return `:21`.
- **Màn 1440 không đổi:** ở desktop `useTableScroll` trả `{ x: true }`, đúng giá trị cũ. Các cột `responsive: ['sm']` vẫn hiện từ 576px trở lên.
- **Không nháy khi load:** `useBreakpoint` render lần đầu với `{}` rồi `forceUpdate` trong `useLayoutEffect` (`antd/es/grid/hooks/useBreakpoint.js:7-20`), tức là trước lần vẽ đầu.
- **`suffix` thay `addonAfter`:** trong antd 5.29.3, `addonAfter` đã bị `@deprecated` (`input-number/index.d.ts:24`), còn `suffix` có sẵn (`:38`). Hết các chỗ dùng `addonAfter`/`addonBefore` trong admin.
- **Modifier `keepInsideRows`:** `containerNodeRect` của dnd-kit là parent của row (tbody). Cách kẹp trục y giống `restrictToParentElement`.
- **Selector E2E** (`schedule-and-withdraw.ts:8-12`) khớp nhãn mới: nút "Thêm buổi thi đấu", tiêu đề modal, "Mã buổi", "Tên buổi". Regex có `$` nên tên kèm icon "plus" vẫn khớp.
- **`MIGRATE_CONFIRM_TARGET`** `localhost:5432/kamito_tt_ci_test` khớp cả `publishing-test-safety.ts:8` lẫn `print-db-target.mjs:16`. Tên DB thoả regex `_test`.
- **Build client:** Next 16.4.5 có `typescript.tsconfigPath` (`next/dist/server/config-shared.d.ts:66`). `tsconfig.build.json` loại `tests/`. Chỉ có `tests/e2e/support/content-fixture.ts` import `packages/db/dist`, `src/` không import.
- **`imports-commit-guards`:** `{ type: 'Error' }` đúng với `safeErrorSummary` (`Error` có trong `ERROR_TYPES`, không có `code`).
- **`public-rate-limit.test.ts`:** `vi.mock` của `public-redis` áp dụng cả cho import gián tiếp qua `public-shared-rate-limit`.

## Câu hỏi còn mở

- Lần review này chưa chạy spec `match-reopen-group-winner-through-bye` (cần DB `_test`). Changelog ghi 2/2 đạt, chưa kiểm chứng lại.
- Turbo chạy test của api/worker/client song song trên cùng một Redis/Postgres của CI. Chưa kiểm có đụng nhau hay không (ví dụ `publishing.e2e-spec.ts:29` gọi `drain` queue revalidate).

**Status:** DONE_WITH_CONCERNS
**Summary:** Có 1 lỗi chặn CI: bước `seed:config` import `packages/db/dist` trước khi có bước nào build. Phần hook/antd không có lỗi đúng sai. Còn sót nhãn "session" (admin + API) và một bảng chưa áp `useTableScroll`.
**Concerns/Blockers:** C1 phải sửa trước khi push, không thì job `build-test` rớt.
