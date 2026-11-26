# Nợ còn mở — cập nhật 2026-11-26

Danh sách việc dời lại sau lượt CI + audit admin ngày 2026-11-24. Làm xong mục nào thì gạch và ghi commit/bằng chứng.

Lượt 2026-11-25 xử lý các mục local, kiểm trên trình duyệt với `localhost:5433/kamito_tt_phase12_test` (dữ liệu thử gắn tag, dọn sau khi kiểm). Đợt audit đã có commit `64c8b69` và báo cáo `10e3431`; phần redesign và kiểm tiếp được theo dõi riêng. Còn mở: S1, S2, T2, D1, D2 và A8 L3–L5 (L3/L5 chờ quyết định sản phẩm). A8 L1/L2 đã kiểm đạt trong lượt tiếp nối. Code review gốc: [code-reviewer-261125-open-debts-admin.md](../reports/code-reviewer-261125-open-debts-admin.md); kết quả sau sửa phải đối chiếu báo cáo A1/A8 và [plan redesign](../261125-0951-figma-ui-redesign-admin-client/plan.md).

Lượt 2026-11-26 chạy `admin-full-flow` sau redesign trên `localhost:5433/kamito_tt_phase12_test`: desktop đạt 8/8 một lượt, mobile đạt 8/8 hai lượt; L4 đóng. Sáu lượt khác rớt vì bốn nguyên nhân riêng, ghi thành E1–E3 và bổ sung T2 bên dưới. Cùng ngày đã sửa E1 trong API và chạy lại: desktop 8/8 và mobile 8/8 trên bản có sửa, đóng E1 và E3; ghi thêm E4. Còn mở sau lượt này: S1, S2, T2, D1, D2, L3, L5, E2, E4. [Báo cáo](../reports/tester-261126-1620-admin-full-flow-after-redesign.md).

Nguồn: [audit UI 1440/390](./reports/ui-audit-261124-admin-1440-390.md), [code review](./reports/code-reviewer-261124-ci-and-admin-mobile.md), [phase 07](./phase-07-scheduling-sessions-tables-and-result-entry.md) mục "Việc còn mở".

## Chặn staging (chờ bên ngoài)

| # | Việc | Chờ ai | Ghi chú |
|---|---|---|---|
| S1 | Trả lời checklist hạ tầng | Chủ hạ tầng | [infra-preflight-checklist-261124.md](./reports/infra-preflight-checklist-261124.md) |
| S2 | Câu hỏi G1/G2/consent | BTC | Phase 12, mục "Câu hỏi chưa giải quyết" |

## Admin UI

| # | Mức | Việc | Vị trí | Ghi chú |
|---|---|---|---|---|
| ~~U1~~ | Trung bình | ~~Kiểm kéo thả nhà tài trợ trên trình duyệt~~ | `sponsors-tab.tsx` | Đạt 2026-11-25 với 4 nhà tài trợ thử: kéo chuột giữ trục dọc (`translate3d(0, 159px)`, mép trái hàng = mép bảng 264 px), thứ tự lưu đúng; bàn phím Space → ↑ → Space đổi chỗ, vùng thông báo đọc tiếng Việt |
| ~~U2~~ | Trung bình | ~~Màu focus theo thương hiệu~~ | `packages/ui-tokens/src/antd-theme.ts` | Xong 2026-11-25: focus dùng xanh navy `#0F285D` (không dùng đỏ thương hiệu để khỏi lẫn với lỗi). Ô nhập viền navy + bóng 2 px; nút outline `solid 2px rgb(15, 40, 93)`. Test `build-css-variables.test.ts` |
| ~~U3~~ | Thấp | ~~Cảm biến bàn phím cho kéo thả lịch~~ | `schedule-keyboard-drag.ts`, `schedule-tab.tsx` | Xong 2026-11-25: Space nhấc trận, mũi tên nhảy tới ô gần nhất theo hướng, Space/Enter thả, Esc hủy; Enter giữ nghĩa chọn-rồi-đặt cũ. Test `apps/admin/test/schedule-keyboard-drag.test.mjs` 6/6 |
| ~~U4~~ | Thấp | ~~Trang Cài đặt: nhắc khi còn thay đổi chưa lưu~~ | `settings-page.tsx`, `ranking-rules-unsaved-guard.ts` | Xong 2026-11-25: tab có chấm cam, cạnh nút Lưu có dòng "Có thay đổi chưa lưu"; đổi tab không hỏi (state giữ nguyên); rời trang hỏi "Ở lại / Bỏ thay đổi" (1 hộp thoại). Thẻ trong tab bỏ tiêu đề trùng tên tab |
| ~~U5~~ | Thấp | ~~Drawer menu tự mở lại; thiếu tên~~ | `admin-layout.tsx` | Xong 2026-11-25: đóng khi qua breakpoint lg (0 drawer mở sau resize), `aria-label="Menu quản trị"` |
| ~~U6~~ | Thấp | ~~Nút tạo và kiểu quay lại chưa thống nhất~~ | `components/crud-page.tsx`, `components/back-link.tsx` | Xong 2026-11-25: trang tạo/sửa có link "← <tên danh sách>" về đúng danh sách (thay nút mũi tên quay lại lịch sử trình duyệt); nút tạo có icon + và chữ "Thêm …" ("Tạo giải" → "Thêm giải", "Viết bài" → "Thêm bài viết"); 4 trang riêng dùng `BackLink` |
| ~~U7~~ | Thấp | ~~Cảnh báo `ColorPicker disabledAlpha`~~ | `color-hex-field.tsx` | Xong 2026-11-25: antd coi giá trị rỗng là màu trong suốt; chỉ khoá alpha khi có giá trị |
| ~~U8~~ | Thấp | ~~Cảnh báo Refine `useForm` edit thiếu `id`~~ | 6 file trang sửa | Xong 2026-11-25: truyền `id` từ `useParams()` |
| ~~U9~~ | Thấp | ~~Cảnh báo antd "useForm not connected"~~ | `components/form-instance-host.tsx` | Xong 2026-11-25. Hai nguồn, kiểm bằng stack: (1) `useTable` của Refine gọi `getFieldsValue` trên search form không gắn `<Form>`; (2) `useForm` của Refine gọi `resetFields` khi trang sửa nội dung còn hiện Skeleton. Gắn form vào `<Form component={false}>` (không render DOM) |
| ~~U10~~ | Thấp | ~~Cảnh báo "There may be circular references"~~ | `session-form-modal.tsx:66` | Xong 2026-11-25. Không do dayjs: chỉ xuất hiện khi giải có địa điểm có bàn. `setFieldValue` của rc-field-form gán mảng lỗi mới, còn field chưa đụng dùng chung một mảng rỗng, nên `isEqual` của rc-util báo vòng lặp giả. Đổi sang `setFieldsValue`; bàn vẫn tự điền đủ |
| ~~U11~~ | Thấp | ~~Nhảy 76 px khi mở hộp thoại~~ | — | Đóng 2026-11-25: vị trí nút trước/sau mở modal giữ nguyên (756, 412), body 1440 px |

## Chưa audit

| # | Việc | Lý do |
|---|---|---|
| ~~A1~~ | ~~Trang sửa bài viết, video, trang tĩnh, nhà tài trợ; chi tiết hộp thư liên hệ~~ | Đạt 2026-11-25 ở 1440/390: tràn 0, lỗi 0. Drawer liên hệ 560 px ở 1440, toàn màn hình ở 390; cột tin nhắn ellipsis + `useTableScroll` |
| ~~A2~~ | ~~Admin dưới vai trò `RESULTS_OPERATOR`~~ | Đạt 2026-11-25: trang chủ là "Nhập tỷ số"; vào được kết quả, giải, lịch, VĐV (không có nút tạo); bị chặn ở điểm xếp hạng, cài đặt, người dùng, bài viết; hàng đợi trả 403 |
| ~~A3~~ | ~~Trang hàng đợi bull-board~~ | Đạt 2026-11-25: ADMIN thấy "Bull Dashboard" (200) với danh sách queue; chưa đăng nhập 401; operator 403 |

## CI / test

| # | Việc | Ghi chú |
|---|---|---|
| ~~T1~~ | ~~Khai `passThroughEnv` cho task `test`~~ | Xong 2026-11-25: dry-run của turbo liệt kê `DATABASE_URL` trong passthrough. Script gốc vẫn giữ `--env-mode=loose` |
| T2 | Vitest API trên Windows thỉnh thoảng crash native `0xC0000409` | Chỉ ở máy local; chạy lại từng shard thì đạt. GitHub Actions (Linux) không gặp. `apps/api/vitest.config.ts` đã dùng `pool: 'threads'` để giảm crash nhưng vẫn còn; lỗi ở runtime native, chưa có cách sửa trong code dự án — giữ mở để theo dõi |

Bổ sung theo dõi runtime 2026-11-25: focused Playwright sau sửa metadata đạt 56/12, exit 0 và JSON không errors/flaky, nhưng log có assertion `UV_HANDLE_CLOSING` sau test cuối. Chưa xác định tiến trình con phát sinh; không coi đây là log sạch hoặc cùng nguyên nhân với crash Vitest. Raw: `test-results/261125-c11-public-07f833ec-9bb3-4401-8e02-abcb6df3b3fe/playwright.log`.

Bổ sung 2026-11-26: worker của `admin-full-flow` (Vitest chạy `full-ui-workers.seed.ts`) thoát giữa lượt `mobile-994680a1…` với mã `3221226505` (`0xC0000409`), cùng mã lỗi của T2. Trang công khai ngừng làm mới nên bước 4 rớt; worker không kịp ghi file đánh dấu đã dừng nên bước dọn của runner từ chối chạy. Đã kiểm tiến trình worker không còn rồi dọn riêng, không còn dòng sót.

## Dọn dẹp chờ xác nhận

| # | Việc | Ghi chú |
|---|---|---|
| D1 | Tắt hoặc xoá tài khoản `ui-audit@kamito.local` trên `localhost:5433/kamito_tt_dev` | Cách làm ở cuối báo cáo audit; cần xác nhận của chủ repo |
| D2 | Dữ liệu thử tiền tố "QA " và tài khoản admin thử trong DB dev | Nợ phase 07. Đã liệt kê 2026-11-25 (chỉ SELECT): 57 user gần như toàn tài khoản E2E/thử, 1 giải + 1 địa điểm + 16 VĐV tiền tố "QA", 23 giải đều là dữ liệu thử. Chờ xác nhận trước khi xoá |

## Nợ từ phase A8 (lịch thi đấu admin, 2026-11-25)

| # | Việc | Ghi chú |
|---|---|---|
| ~~L1~~ | ~~Thử kéo bàn phím trên lưới lịch ở Firefox và WebKit~~ | Đạt 2026-11-25: Chromium 156, Firefox 157, WebKit 27.2; hủy bằng Space/Tab/Esc không PATCH, mũi tên + Space đúng 1 PATCH 200, `aria-pressed=false`. Firefox có hai lượt harness chưa hiện UI rồi lượt riêng đạt; không sửa mã sản phẩm. [Báo cáo](../reports/tester-261125-a8-browser-gates.md) |
| ~~L2~~ | ~~Kiểm lưới 6 bàn ở 1280 px không cuộn ngang~~ | Đạt 2026-11-25 trên ba engine: trang 1280/1280 px, vùng cuộn lưới 715/715 px; sáu bàn thật từ DB. Đã phục hồi lịch và dọn toàn bộ session/bàn/user tạm. [Báo cáo](../reports/tester-261125-a8-browser-gates.md) |
| L3 | Q8 màu theo nội dung (`Discipline.colorHex`, cần migration) | Chờ chốt; mặc định hiện tại là Tag mã nội dung, không màu |
| ~~L4~~ | ~~Chạy E2E `apps/client/tests/admin-full-flow` sau khi đổi giao diện~~ | Đạt 2026-11-26: desktop 8/8 (`desktop-b454234d…`, 60 lần làm mới trang công khai, chậm nhất 1380 ms), mobile 8/8 (`mobile-a3ea6eee…`, chậm nhất 796 ms). Bốn lượt ngày 2026-11-25 đều rớt vì helper test đua thời điểm, đã sửa trong `ui.ts` và `results.ts`. Lượt desktop này chạy trước hai chỉnh nhỏ cuối của helper; lượt `desktop-c6d3eeff…` (E3) đạt trên helper cuối |
| L5 | Q9 tự động xếp lịch | Phase riêng, chưa làm |

## Nợ phát hiện khi chạy admin-full-flow (2026-11-26)

| # | Mức | Việc | Vị trí | Ghi chú |
|---|---|---|---|---|
| ~~E1~~ | ~~Trung bình~~ | ~~API trạng thái tác vụ xếp hạng có thể trả `completed` kèm `result: null`~~ | `apps/api/src/modules/ranking-jobs/ranking-enqueue.service.ts:73-74` | Đã sửa 2026-11-26. Nguyên nhân: `getJob` đọc `returnvalue` trước, `getState` đọc trạng thái sau bằng một lệnh Redis khác; tác vụ xong giữa hai lần đọc thì admin coi là xong nhưng không có `snapshotId` (`snapshot-jobs-tracker.tsx:59`). Gặp một lần ở bước 7 lượt `desktop-90974b9e…`; trace ghi `"state":"completed","attemptsMade":0,"result":null`. Sửa: đọc trạng thái (`getJobState`) trước, đọc job sau. BullMQ ghi trạng thái kết thúc và `returnvalue` trong cùng một lệnh, nên trường hợp xấu nhất còn lại là "chưa xong nhưng đã có kết quả", admin tự hỏi lại. Test hồi quy `ranking-enqueue.service.test.ts` rớt trước khi sửa, đạt sau khi sửa. Review độc lập không có lỗi chặn. Chạy lại `admin-full-flow` trên bản có sửa: desktop 8/8, mobile 8/8 |
| E2 | Thấp | Dropdown "Chọn VĐV cho dòng này" ở bước xem trước nhập Excel rộng hơn màn hình điện thoại | `apps/admin/src/components/import-row-decision-select.tsx:48` | Đo ở 390 px với tên thử dài: dropdown rộng 667 px, trang bị nới thành 679 px. `popupMatchSelectWidth={false}` cho dropdown rộng theo nhãn dài nhất. Thử cho dropdown rộng bằng ô chọn và xuống dòng: không đủ vì ô chọn giãn theo cột bảng; đã hoàn lại. Cần quyết định cách hiển thị trên điện thoại |
| ~~E3~~ | ~~Thấp~~ | ~~Chạy lại desktop `admin-full-flow` trên helper cuối khi máy ổn định~~ | `test-results/261120-full-ui-runner.mjs` | Đạt 2026-11-26: `desktop-c6d3eeff…` 8/8 (60 lần làm mới, chậm nhất 851 ms) và `mobile-26a6fdfe…` 8/8 (chậm nhất 913 ms), cùng helper cuối và bản API có sửa E1; dọn xong, `.env` không đổi. Ba lượt desktop trước đó rớt: trang công khai cổng 3373 mất kết nối ở bước 4, API cổng 3371 mất kết nối ở bước 2, và E1 ở bước 7. Hai lần mất kết nối chưa rõ nguyên nhân và chưa tái hiện (runner lúc đó chưa ghi mã thoát, nay đã ghi); lúc đo, bộ nhớ commit của máy còn trống 4,7/47,4 GB, chưa chứng minh được liên quan. Nếu gặp lại thì theo dõi chung với T2 |
| E4 | Thấp | Admin coi tác vụ dựng bản nháp là xong khi API trả 404, nhưng không có `snapshotId` | `apps/admin/src/pages/ranking/snapshot-jobs-tracker.tsx:50-59` | Có sẵn từ trước, review E1 chỉ ra. Tác vụ bị dọn khỏi hàng đợi trước lần hỏi đầu tiên của admin thì bảng theo dõi báo xong mà không mở được bản nháp vừa tạo. Chưa gặp trong các lượt chạy; chưa có test. Chưa sửa |
