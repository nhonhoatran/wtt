# Review phase 08 — Lịch công khai theo buổi/bàn và bản in

- Ngày: 2026-11-15.
- Phạm vi: API lịch công khai, hợp đồng dùng chung, tab Thông tin, bộ lọc GET, bảng lịch và stylesheet in; kiểm tra hồi quy API giải/trận và luồng làm mới cache.
- Kết luận: đạt sau sửa; điểm review 9,5/10. Không còn phát hiện critical/high/medium trong phạm vi đã đọc. Không thay đổi schema hoặc tạo/chạy migration.

## Đối chiếu yêu cầu

- `apps/api/src/modules/public-competition/public-schedule.query.ts:22`: tìm giải qua predicate công khai; chỉ đưa trận có session, bàn và giờ vào lịch; loại draw nháp và BYE bằng `publicScope.match`. Session/bàn rỗng không đưa vào kết quả hoặc lựa chọn lọc.
- Cùng file: một truy vấn tìm giải và hai truy vấn session có nested select. Không có lời gọi DB trong vòng lặp session/bàn/trận; không tạo N+1 theo số lượng bản ghi. Đây là kiểm tra cấu trúc code, chưa đo số câu SQL bằng log Prisma.
- `packages/shared/src/public-schedule-contract.ts`: hợp đồng chỉ chứa tên công khai, mã buổi/bàn, thời gian và các trường trận đã có whitelist. Không đưa ID nội bộ, email, số điện thoại hoặc tên pháp lý bị ẩn vào response.
- `apps/client/src/app/[locale]/events/[slug]/info/page.tsx:37`: chỉ giữ tham số nằm trong lựa chọn công khai trước khi tạo cached fetch; lọc ở API, render HTML ở server, form GET giữ URL. Phần tương tác mới chỉ có nút mở hộp thoại in.
- `apps/api/src/modules/public-events/public-event-detail.query.ts:94`: tab Thông tin hiện khi có lịch công khai dù chưa có HTML giới thiệu. Cờ `showInfoTab` vẫn kiểm soát riêng nội dung HTML.
- `apps/client/src/components/schedule/session-table-schedule.module.css:27`: page style riêng cho lịch, bắt đầu trang mới theo buổi/bàn, lặp tiêu đề bảng, tránh ngắt hàng trận; tên giải/ngày/buổi/bàn/múi giờ có trên bản in.

## Phát hiện đã sửa

1. **Medium — Đổi mã/tên bàn không làm mới lịch công khai.** Bổ sung `venueTable.write` trong `cache-tags.ts`, dùng `VenueTablesService.updateRefreshed` sau commit và cập nhật `route-tag-coverage.ts`. Test kiểm tra tag `event-*` và `schedule-*`, đồng thời đọc lại tên mới.
2. **Medium — Đổi tên địa điểm chỉ dùng qua session bỏ sót giải liên quan.** `VenuesService.publicTags` đã thêm điều kiện `sessions.some.venueId`; tag giải cũng làm mới fetch lịch vì lịch dùng tag `event-*`.

## Kiểm chứng đã chạy

- `pnpm --filter @kamito/api test public-schedule.e2e-spec.ts public-events.e2e-spec.ts public-matches.e2e-spec.ts`: 3 suite, 24 ca đạt ở lượt trước khi thêm ca cache.
- `pnpm --filter @kamito/api test public-schedule.e2e-spec.ts public-refresh-wiring.e2e-spec.ts cache-tags-coverage.e2e-spec.ts`: 3 suite, 18 ca đạt, bao gồm ca đổi tên bàn/địa điểm.
- Sau cập nhật map mutation: `pnpm --filter @kamito/api test public-schedule.e2e-spec.ts cache-tags-coverage.e2e-spec.ts`: 2 suite, 11 ca đạt.
- `pnpm --filter @kamito/api typecheck`, `pnpm --filter @kamito/api lint`, `pnpm --filter @kamito/client typecheck`, `pnpm --filter @kamito/shared build`: đạt.
- `git diff --check`: đạt; chỉ cảnh báo chuẩn hóa CRLF/LF.
- DB test lấy tự động từ `.env`; `pnpm db:print-target` xác nhận `localhost:5433/kamito_tt_dev`. Lượt đầu phụ thuộc local chưa chạy nên lỗi kết nối, sau khi bật dịch vụ đã chạy lại đạt. Không thay `DATABASE_URL` và không đọc dòng comment làm cấu hình.

## Giới hạn

- Mã bàn chỉ duy nhất trong một địa điểm. Bộ lọc bàn hiện gộp cùng mã giữa các địa điểm; từng buổi vẫn hiển thị tên địa điểm để phân biệt. Đây là hành vi hiện tại, không có định danh DB lộ trên URL.
- Review tĩnh đã kiểm tra cấu trúc in; kết quả Playwright/PDF được báo riêng bởi lượt kiểm thử giao diện, không suy ra từ việc CSS tồn tại.
- Chưa triển khai staging hoặc đo chốt trận → trang công khai cập nhật trên staging. Không coi M1/M2 staging hoàn thành từ các kết quả local này.
