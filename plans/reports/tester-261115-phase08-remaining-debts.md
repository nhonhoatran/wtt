# Kiểm thử hoàn tất nợ code phase 08

Ngày: 2026-11-15. Phạm vi: bộ lọc ngày dài, trạng thái trận tự chọn, hồi quy site và đối chiếu các tác vụ API/runtime.

## Kết quả cuối

- Lượt cuối production: **51 đạt, 7 bỏ qua theo viewport, 0 lỗi**, 31,3 giây. Next production client **3115**, API build `dist/main.js` **3215**, `CI=1` không tái dùng server cũ; JavaScript bật. DB/Redis thật. Log `apps/client/test-results/phase08-production-dist-final.log`. Lượt dev trước đó cũng đạt 51/7, 2,3 phút (`phase08-all-debts-final.log`).
- `E2E_NEXT_MODE=start ... playwright test match-filter-debts.spec.ts`: **6/6 đạt** trên Next production, JavaScript bật. Log `phase08-date-production-js.log`. Cấu hình port chỉ đổi địa chỉ HTTP local, không đổi URL DB.
- Client unit **41/41, 8 file**, build production, typecheck và lint đạt theo lượt tổng hợp runtime. New `public-match-filter.test.ts` có 8 ca ngày/trạng thái; lượt trước khi bổ sung Redis đã chạy 28/28 đạt.
- API: lượt tổng hợp 8 file/50 ca đạt; sau guard ngày không hợp lệ có lượt 3 file/15 ca đạt (settings 1, parser 11, DST 3). Build/typecheck/lint API đạt. Xem báo cáo timezone, tên công khai, settings và runtime riêng để tránh cộng trùng số ca.

## Ngày và trạng thái trận

Fixture tách riêng có giải đang diễn ra kéo dài 201 ngày và một trận upcoming ở ngày thứ 121. Test kiểm date input có min/max đúng ngày đầu/cuối giải, chọn được ngày sau mốc 62 cũ, submit GET giữ ngày và vẫn thấy trận. Ngày sai định dạng, ngày không tồn tại, ngoài giải và query lặp bị server bỏ trước fetch/cache; cả desktop 1280 và mobile 390 đạt.

Giải chỉ có upcoming tự mở tab upcoming sau khi live rỗng. URL `state=live` rõ ràng vẫn giữ tab live và trạng thái rỗng. Unit kiểm số lần gọi: live có dữ liệu chỉ một request; upcoming có dữ liệu dừng sau hai; completed chỉ đọc sau hai trạng thái trước rỗng. Không tải cả dữ liệu về browser để lọc.

Ảnh native date trong production đã mở kiểm: `apps/client/test-results/artifacts/match-filter-debts-date-fi-a3427--native-bounds-and-GET-URLs-mobile/long-event-date-filter.png`. Ngày, nút lịch, nút lọc và thẻ trận đều đọc được; form không tràn ngang trang. Ảnh và log nằm trong thư mục Git bỏ qua.

## Lượt lỗi và giới hạn

Hai lượt focused trên dev từng có navigation bị abort hoặc form quay lại URL cũ, với trace ghi nhiều GET lặp cùng trang; không thấy HTML 500. Lượt full dev sau đó đạt 51/7. Lượt không JavaScript đạt 6/6 nhưng chỉ dùng làm kiểm SSR bổ sung, không thay thế lỗi JavaScript. Đã chạy lại cả 6 ca rồi toàn bộ suite bằng JavaScript bật trên Next production và đạt. Chưa xác định chắc nguyên nhân dev; HMR/hydration là suy luận, không ghi là lỗi sản phẩm đã được sửa.

Hai lượt full production đầu dùng API qua runtime SWC gặp ECONNRESET/ECONNREFUSED: một lượt dừng ở setup, một lượt API không còn nghe cổng giữa test. Không thấy log xác định nguyên nhân tiến trình thoát, nên không kết luận lỗi SWC. Lượt cuối dùng API build chuẩn, port mới, `CI=1`, môi trường Next production rõ ràng và không retry: đạt toàn bộ 51/7. Setup hiện chỉ thêm lỗi có URL để chẩn đoán, không nuốt lỗi hoặc tự thử lại.

Không có deploy staging trong báo cáo. Production ở đây là tiến trình Next build chạy local; header Traefik/CDN thật và M1/M2 vẫn cần hạ tầng staging.

## Bằng chứng liên quan

- `reviewer-261115-phase08-timezone-and-dst.md`: SQL timezone trước count/paginate và biên DST độc lập.
- `tester-261115-phase08-public-player-names.md`: migration tên công khai, tìm không dấu, sort đơn/cặp trước phân trang, query plan fixture.
- `reviewer-261115-phase08-shared-cache.md`: Redis cache/rate atomic, generation fence và API settings không cache RAM.
- `reviewer-261115-phase08-shared-public-runtime.md`: build và hai Next production local chia sẻ invalidation/hạn mức thật.
