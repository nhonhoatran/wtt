# Review: race trong helper E2E admin-full-flow

Ngày: 2026-11-26. Phạm vi: thay đổi chưa commit ở `apps/client/tests/admin-full-flow/{ui,results,rankings,draws}.ts` (45 dòng thêm, 49 dòng bớt).
Cách làm: chỉ đọc. Không chạy test, server, build, typecheck, lệnh DB; không đọc `.env`.
Nguồn đối chiếu: mã sản phẩm trong `apps/admin`, `apps/client` và mã thư viện đã cài (`rc-select@14.16.8`, `rc-dialog@9.6.0`, `playwright@1.64.1`).

## Kết luận

Không có lỗi chặn. Hai bản sửa mới nhất xử lý đúng nguyên nhân, không che lỗi. Còn 2 điểm mức trung bình nên xử lý trước khi commit và vài điểm mức thấp.

Chưa kiểm chứng: project `mobile` (390x844). Bằng chứng hiện có chỉ là một lượt chạy `desktop`.

## Hai bản sửa có trúng nguyên nhân không

**1. `pickOption` nhánh keyboard (`ui.ts:32`) — trúng.**
- `options` của bộ lọc là `(lists.data ?? [])` (`ranking-snapshots-page.tsx:58`), rỗng cho tới khi query xong.
- Khi rỗng, rc-select chỉ render khối `-empty` và `aria-activedescendant` trỏ `<id>_list_-1` (`OptionList.js:101-126`, `251-258`), nên ArrowDown không đi đâu được. Chờ option đầu tiên hiện ra là đúng chỗ.
- Options không bao giờ tải: dừng sau 15 giây với thông báo `The open dropdown must load its options`. Báo lỗi rõ, không pass giả.

**2. `amendResult` (`results.ts:117`) — trúng.**
- `fill` của Playwright gồm 2 bước rời nhau: focus + select trong trang, rồi `keyboard.insertText` từ phía Node (`coreBundle.js:21544-21557`). Timer 80 ms của `GameScoreInputs` chen vào giữa thì chữ rơi vào ô điểm đầu; `digitsOnly` xoá sạch chữ nên ô đó thành rỗng, nút lưu bị khoá, request không bắn.
- Sau khi ô đầu đã có focus thì không còn ai giành focus nữa: rc-dialog chỉ focus lại khi focus đang nằm ngoài modal (`rc-dialog/es/Dialog/index.js:70-75`). Timer chỉ chạy một lần lúc mount.

## Mức trung bình (không chặn)

### M1. `results.ts:54-60` — comment sai cơ chế, vòng refill rộng hơn nguyên nhân
- Comment ghi "form đang khởi tạo ghi đè phím gõ sớm". Không tìm thấy đường mã nào ghi đè draft lúc khởi tạo: draft là `useState(() => draftFromDetail(detail))`, chỉ đổi qua `onChange`, `afterRewrite`, `reloadFromProblem` (`match-drawer-body.tsx:38,65,95,125`; `amend-scores-modal.tsx:23,61`). Nguyên nhân thật vẫn là timer focus 80 ms đẩy chữ sang ô đầu.
- Rủi ro che lỗi: sau này nếu sản phẩm lỡ reset draft khi refetch (người nhập mất điểm vừa gõ), vòng lặp sẽ gõ lại tới 10 giây và test vẫn xanh.
- Đề xuất: sửa comment cho đúng cơ chế (giống comment ở `results.ts:116`). Giữ vòng lặp cho nhánh drawer là hợp lý, vì ở drawer không thể chờ focus (xem phần `toBeFocused`).

### M2. `rankings.ts:111-125` phụ thuộc thay đổi sản phẩm chưa commit
- Selector `summary strong` `.last()` cần `<strong>` bọc điểm, vốn mới thêm ở `apps/client/src/components/rankings/ranking-row-summary.tsx:27` (kèm CSS `.points strong`), cũng đang chưa commit.
- Nếu commit helper mà thiếu 2 file đó: `.last()` trùng `.first()` (ô hạng), poll ở `rankings.ts:113-117` hết 15 giây ở bước 7.
- Đề xuất: đưa chung một commit. Lưu ý mô tả "chỉ sửa mã test" không còn đúng hẳn. Chưa xác định `<strong>` này thuộc thiết kế hay chỉ để test bám vào.

## Mức thấp

### L1. `ui.ts:32` — cổng chờ nhìn danh sách hiển thị, không nhìn trạng thái đang được duyệt
- `dropdown` là `.ant-select-dropdown:visible` chung toàn trang (`ui.ts:19`). Dropdown của bộ lọc (`rankings.ts:25`) còn đang chạy hiệu ứng đóng có thể làm cổng ở lần gọi `rankings.ts:30` qua sớm.
- Option hiện ra trước, `aria-activedescendant` cập nhật sau một effect (`OptionList.js:124-126`). Đọc `start` đúng khe đó sẽ ra `_list_-1`.
- Hậu quả: không pass giả. Vòng duyệt quay vòng nên vẫn tới đích khi danh sách không quá 100 mục; tệ nhất là fail như lỗi cũ.
- Đề xuất: chờ chính thứ đang duyệt, ví dụ `await expect.poll(activeLabel, { message: '...' }).not.toBe('')`. Chỉ đúng với Select để mặc định `defaultActiveFirstOption` và nhãn là chuỗi (hai Select đang dùng đều vậy).

### L2. `ui.ts:35-39` — điều kiện dừng theo `start`
- Một option và đúng đích: `found` đúng ngay, không vào vòng lặp.
- Một option và sai đích: ArrowDown quay về chính nó (`OptionList.js:87-100`), bằng `start`, thoát và fail đúng.
- `aria-activedescendant` null lúc đầu: chỉ xảy ra khi dropdown đóng (`Selector/Input.js:41`), mà `ui.ts:21` đã loại. Nếu vẫn xảy ra thì không thoát sớm, bấm đủ 100 lần rồi fail.
- Giới hạn ngầm: danh sách trên 100 mục mà đích nằm sau mục 100 sẽ fail oan. Dữ liệu hiện tại (vài bảng xếp hạng) không chạm tới.

### L3. `results.ts:55-60` — lỗi bên trong `toPass` bị nuốt
- `fill` bên trong dùng timeout mặc định 15 giây, dài hơn 10 giây của `toPass`. Ô bị disabled hoặc không có thì chỉ nhận được "Timeout 10000ms exceeded while waiting on the predicate", mất lý do thật (`playwright/lib/matchers/expect.js:12993-12998`).
- Đề xuất: thêm `{ timeout: 2_000 }` cho hai lệnh `fill`, giống cách `closeDrawer` đã làm.

### L4. `results.ts:50-61` — chỉ kiểm lại ô của ván đang điền
- Nếu timer chen đúng lúc điền ván 2 trở đi, chữ rơi vào ô ván 1 phía 1 và không được kiểm lại.
- Trạng thái sinh ra luôn không hợp lệ (0-0 hoặc 11-11), nên nút xác nhận bị khoá và test fail, không pass giả.
- Thực tế gần như không tới được: mọi nơi gọi `fillWin` đều cách lúc mount rất xa hoặc đã qua cổng focus.

### L5. `ui.ts:76-80` — `closeDrawer` trả về xong drawer vẫn có thể mở lại
- Sau khi chốt, sản phẩm chạy `openNext` (`results-workspace.tsx:58-66`): refetch rồi mới `setOpenId`. Bấm "Đóng" khi `openNext` chưa xong thì drawer đóng, rồi tự mở lại ở trận kế.
- Hiện vô hại: mọi bước sau đó đều điều hướng lại (`results.ts:30`, `schedule-and-withdraw.ts:47`).
- Sẽ gây lỗi nếu sau này có chỗ gọi `closeDrawer` rồi thao tác tiếp ngay trên danh sách.
- Vòng thử lại cũng bỏ qua trường hợp "phải bấm Đóng hai lần mới đóng". Chấp nhận được vì đây là bước dọn dẹp, không phải điểm kiểm.

## Helper có làm yếu điều test khẳng định không

Không thấy chỗ nào khiến test pass khi sản phẩm hỏng, ngoài rủi ro ở M1.
- `pickOption`: bỏ kiểm `aria-activedescendant` = id đích, thay bằng khớp nhãn và kiểm giá trị hiện trong ô chọn sau Enter (`ui.ts:44`). Sức kiểm tương đương. `rankings.ts:23` còn kiểm `filter[listId]` trên request thật.
- `publicRanking`: thêm kiểm `details[open]` (`rankings.ts:130`), mạnh hơn trước. Phần bỏ đi là kiểm trùng với vòng lặp ở chỉ số 0.
- `draws.ts:52`: tên nút khớp `event-hub-actions.tsx:82-85`.
- Sẵn có từ trước, ngoài diff: `confirmResult` không so `confirmed.winnerSide` với `winner` đã gõ (`results.ts:90`). Thêm một dòng `expect` là đủ, tuỳ chọn.

## `toBeFocused` ở `amendResult` có giòn không

Chấp nhận được.
- Nếu bỏ auto-focus khỏi sản phẩm: test fail ngay tại `results.ts:117`, comment phía trên chỉ thẳng lý do, cách sửa là xoá một dòng. Khi đó race cũng biến mất theo.
- Nếu đổi ô được focus (ví dụ ô trống đầu tiên): test fail rõ ràng, không im lặng.
- Auto-focus là hành vi có chủ đích (`FOCUS_DELAY_MS`, `game-score-inputs.tsx:17,33-37`), nên việc test bám vào nó là hợp lý.
- Không nên bê cổng này sang nhánh drawer: ở đó focus không chắc xảy ra (ô có thể đang disabled ở mốc 80 ms vì `useCan` chưa trả; sau khi mở lại trận thì modal đóng giành focus về).

## Chính sách comment

- 6 comment mới, đều tiếng Anh, đều giải thích lý do. Không có xưng hô riêng, không comment chia khu hay kể lịch sử.
- Vi phạm: `results.ts:54` sai sự thật (xem M1).
- Sát ranh: `rankings.ts:111` mô tả cấu trúc DOM nhiều hơn lý do. Giữ được vì nó ghi lại quy ước `.first()`/`.last()`.
- `ui.ts:25` đã đối chiếu đúng: rc-select chỉ render 3 option quanh mục đang active (`OptionList.js:294-300`).

## Điểm tốt

- `closeDrawer` chờ modal tan hẳn trước khi bấm, timeout trong nhỏ hơn timeout ngoài nên lỗi trong không bị nuốt.
- Vòng thử lại của `closeDrawer` cũng đỡ được trường hợp toast che nút đóng trên màn hình hẹp.
- Thông báo lỗi mới ở `ui.ts:32,41` nói rõ đang thiếu gì.

## Việc nên làm (theo thứ tự)

1. Sửa comment `results.ts:54` cho đúng cơ chế.
2. Commit helper cùng `ranking-row-summary.tsx` và `ranking-accordion.module.css`.
3. Chạy project `mobile` trước khi coi là xong.
4. Tuỳ chọn: L1 (cổng theo `activeLabel`), L3 (timeout 2 giây cho `fill`), một dòng `expect(confirmed.winnerSide).toBe(winner)`.

## Chỉ số

- Typecheck, lint, test: không chạy (theo yêu cầu chỉ đọc).

## Câu hỏi còn mở

- `<strong>` bọc điểm ở `ranking-row-summary.tsx:27` thuộc thiết kế hay thêm cho test?
- Drawer tự mở lại sau khi người dùng bấm đóng lúc `openNext` chưa xong (L5) có phải hành vi mong muốn của sản phẩm không?
