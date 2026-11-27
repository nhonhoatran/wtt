# Import mobile, màu nội dung và runner — 2026-11-27

## Kết quả

| Phạm vi | Kiểm mới | Kết quả và giới hạn |
|---|---|---|
| Dropdown import E2 | Component React/antd thật qua Vite + Playwright, 320/390/1440 px | 3/3 đạt; chỉ PATCH quyết định được mock, không dùng DB |
| Màu danh mục | DTO production | Trước sửa 6/6 rớt; sau sửa 6/6 đạt |
| Màu API và migration | Vitest/API/PostgreSQL thật | 5/5 đạt; target đã xác nhận `localhost:5433/kamito_tt_phase12_test` |
| Màu lịch helper | Node thực thi helper production | 2/2 đạt: chuẩn hóa, fallback an toàn, gộp chú giải |
| Màu lịch browser | SessionGrid React thật ở 390/1440 px | 2/2 đạt; GET trận được mock, không phải full-stack E2E |
| Runner vòng đời | `node --test scripts/admin-full-flow.test.mjs` | Windows 13 đạt/1 POSIX-only skip; root báo Linux container 14/14 đạt |
| Kiểm tĩnh G | DB generate/build, API typecheck, admin typecheck, eslint phần sửa, diff whitespace | Exit 0; gate tổng sau H thuộc lượt root |

## E2: dropdown chọn VĐV

Nhãn dài làm popup theo nội dung; cho popup bằng ô chọn vẫn không đủ vì ô trong bảng có thể giãn. Fixture tái hiện trigger 900 px trong vùng cuộn ngang: ở 320/390 px, trang trước sửa nới thành 904 px và popup 900 px. Cả hai ca geometry rớt trước sửa.

Ô chọn nay rộng 260 px có giới hạn viewport; popup rộng tối đa 480 px và `100vw - 24px`. Nhãn xuống dòng toàn bộ, tắt virtual list để hàng có thể cao khác nhau; mobile có mục cao tối thiểu 44 px. Sau sửa document width đúng 320/390/1440; popup lần lượt 296/366/480 px. Pointer chọn ứng viên và bàn phím chọn tạo mới gửi đúng PATCH một lần; không có pageerror. Đã mở kiểm ảnh 390/1440, tên/CLB/năm sinh đầy đủ.

Artifacts ignored: `apps/admin/test-results/import-row-decision-select/` (`320-before.png`, `390-before.png`, các `*-popup.png`, `verification.log`).

## G: màu theo nội dung

Migration `20261127090000_add_discipline_color` thêm `Discipline.colorHex TEXT NULL`, không default/backfill. Đã chạy guard target, Prisma generate/DB build và migrate deploy trên DB test; không áp dev/staging. API nhận RGB hex, chuẩn hóa uppercase; null/rỗng xóa màu và PATCH bỏ trường giữ giá trị cũ.

Năm ca tích hợp xác nhận: kiểu/nullable/default cột và create cũ không màu; create/read/update/clear; màu sai không đổi dữ liệu; operator không có quyền ghi; danh sách/chi tiết trận có danh tính nội dung + màu hiện tại và phản ánh sửa danh mục. Fixture riêng được dọn trong `finally`/`afterAll`, users do AuthTestKit dọn.

Admin tái dùng ColorHexField. Lưới và panel chưa xếp dùng viền trang trí; chú giải gộp theo id, giữ mã/tên, xuống dòng với tên dài. Màu thiếu/sai dùng neutral theme; cảnh báo đỏ giữ viền ngoài riêng. Browser đo đúng màu `rgb(18,52,86)`, fallback khác màu đó, viền cảnh báo khớp chữ cảnh báo và không bị accent thay thế; document không tràn ở cả hai viewport. Đã mở ảnh kiểm trực quan: `apps/admin/test-results/discipline-colors/{390-schedule.png,1440-schedule.png}`.

## D: review runner

Đã sửa các lỗi có bằng chứng: lock rò khi dependency/mkdir lỗi; SIGINT không hủy lệnh đang chạy; lỗi mở/flush log có thể bỏ qua cleanup; POSIX chỉ dừng tiến trình cha làm rò con. Tests kiểm lease/retry, dependency thiếu không để lock, log không ghi được không tạo child, lỗi exit-record, abort lệnh có child, hủy readiness và dọn group khi cha đã chết.

Không ghi DB khi review runner. WSL Ubuntu local không có Node nên lượt thử WSL dừng ngay; root dùng Linux container để kiểm nhánh POSIX. Trường hợp Windows cha đã chết trước taskkill không được coi là chứng minh đầy đủ mọi descendant đã dừng; Redis guard tiếp tục chặn cleanup khi worker còn hoạt động. Không tuyên bố T2 đã được sửa.

## Lệnh kiểm

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
node --test apps/admin/test/browser/import-row-decision-select.browser.mjs
node --test apps/admin/test/browser/discipline-colors.browser.mjs
node --test apps/admin/test/schedule-discipline-colors.test.mjs
node --test scripts/admin-full-flow.test.mjs
```

Từ `apps/api`, dùng test env process-only:

```powershell
node --env-file=../../test-results/261127-debt-verification/test.env node_modules/vitest/vitest.mjs run test/discipline-colors.e2e-spec.ts src/modules/disciplines/discipline-dtos.test.ts
```

Lượt đầu 4 integration + 6 DTO đạt 10/10; sau thêm case đọc trận, chạy riêng file integration cuối đạt 5/5. Không cộng các lượt lặp thành tổng test duy nhất.

## Còn lại

Full production public/admin-flow và hồi quy sau khi H tích hợp do root điều phối. Các kết quả component không thay staging, consent hay nghiệm thu queue/API toàn luồng.
