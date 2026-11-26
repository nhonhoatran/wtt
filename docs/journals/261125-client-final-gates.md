# C11 — Kiểm cuối client sau redesign Figma

Ngày: 2026-11-25. Phạm vi: site công khai, kiểm tích hợp admin liên quan, đồng bộ tài liệu và kế hoạch. Không triển khai staging/production bên ngoài.

## Bối cảnh và thay đổi

- Tiếp tục các cổng còn thiếu của [plan redesign](../../plans/261125-0951-figma-ui-redesign-admin-client/plan.md). Báo cáo Next dev trước đó đã đạt 113/21 nhưng chưa thay cho production/Lighthouse/admin-full-flow.
- Dọn thông báo validation/429 của form liên hệ vào dictionary; nhãn tin/video tái dùng khóa dịch. Giữ locale `en` khi hợp lệ, còn lại `vi`, cùng validation/honeypot/header/IP/API flow. Đổi hai màu hex cũ sang token sẵn có.
- Rà toàn bộ phase A1–A11/C1–C11 để đánh dấu đúng việc có bằng chứng; tách các mục kiểm gộp, giữ phần chưa kiểm và tính năng tùy chọn chưa chốt ở trạng thái mở.

## Kết quả đã kiểm chứng

- Build gốc: 9/9 task đạt, 8 task cache, client build mới; 18,372 giây. Raw `test-results/261125-c11-production-build.log`.
- Public production: API dist 3421, Next start 3422, CSP enforce, DB riêng `localhost:5433/kamito_tt_phase12_test`, workers 1/retries 0. Có 134 ca liệt kê: 119 đạt, 15 bỏ qua theo điều kiện môi trường/viewport, 0 lỗi/0 flaky; 229,031 giây. Desktop 57/10, mobile 62/5. Sáu ca CSP enforce đã thực thi; không cộng trùng với lượt Next dev 113/21.
- Axe production: 72 lượt, 0 violation mọi mức; target-size WCAG 2.2 được kiểm đủ. Các mục incomplete cần xem thủ công, không coi đây là chứng nhận WCAG đầy đủ.
- Kiểm tiếp sau dọn copy/token: client unit 36 file/188 ca đạt, kiểm in 2 file/9 ca đạt; root typecheck 14/14, lint 9/9 task đạt. Mọi exit 0; log `test-results/261125-c11-{client-unit,client-print,root-typecheck,root-lint}.log`.
- Raw public: `test-results/261125-c11-public-bedb9d04-2764-4475-8884-842af5e96167/{playwright.log,qa-summary.json}`. [Báo cáo tester](../../plans/261125-0951-figma-ui-redesign-admin-client/reports/tester-261125-client-figma-regression.md).
- Lighthouse r01 13.6.0 mobile/simulated: home/BXH 98/100/100, giải/nhánh 100/100/100; bốn route bắt buộc đạt. Danh sách giải tham khảo 99/100/100, trang trận 100/100/92 vì thiếu `meta-description`, runner sáu route chưa đạt. Mọi `runtimeError=null`. Raw `lighthouse/summary.json` trong artifact public.
- Đã thêm metadata trang trận theo dictionary vi/en từ dữ liệu công khai; không thêm API call hoặc đổi auth/SSR/canonical. Review độc lập source, hai dictionary, unit và route e2e mới không có phát hiện. Regression trước sửa 3 lỗi/12 đạt; sau sửa + parity 16/16 đạt. Client typecheck/lint/build exit 0; build `9vBGS8wTDm5ESGhYCFyEg`.
- Focused production trên build sau sửa: 56 đạt/12 bỏ qua/0 lỗi/0 flaky trong 68 ca, 44,023 giây. Chỉ hai spec trang giải và SEO; không thay full suite 119/15 hay unit 188 của build trước. Lighthouse cuối bốn route bắt buộc 100/100/100, danh sách giải và trang trận 99/100/100; sáu `runtimeError=null`. Raw `test-results/261125-c11-public-07f833ec-9bb3-4401-8e02-abcb6df3b3fe/`.
- A8 L1/L2 đạt Chromium/Firefox/WebKit; mỗi thao tác hủy 0 PATCH, thả đúng 1 PATCH 200, lưới 6 bàn thật 1280/1280 và 715/715 px. Có hai lượt Firefox chưa hiện UI trước lượt riêng đạt; không gọi đây là một lượt ba engine đạt ngay. Dữ liệu tạm và lịch được khôi phục chính xác. [Báo cáo A8](../../plans/reports/tester-261125-a8-browser-gates.md).

## Quyết định và giới hạn

- Phép đo local không thay cổng staging, G1/G2, consent, xác nhận hạ tầng hoặc dọn dữ liệu DB dev.
- Không mở lại nợ focus sider đã có bằng chứng đạt. A8 Firefox/WebKit/lưới 6 bàn đã có bằng chứng để đóng L1/L2; các lựa chọn sản phẩm chưa quyết vẫn giữ mở.
- Focused log có assertion native Windows `UV_HANDLE_CLOSING` sau test cuối; Playwright exit 0, JSON không có errors/flaky. Chưa biết chính xác tiến trình con gây ra; giữ T2 và khai rõ giới hạn, không gọi log sạch.
- Không stage, commit hoặc push trong lượt này. Tài liệu `.docx` và thư mục `.impeccable` không thuộc thay đổi.

## Việc tiếp theo

Đã lưu 28 ảnh 1440/390, mới mở đối chiếu 7 ảnh chính với 10 frame Figma; chưa mở riêng mọi ảnh/PDF. Admin-full-flow sau redesign chưa chạy. Cleanup r01 đạt; lượt cuối đang được runner dọn sau khi A8 trả lease. C11 còn `in-progress` cho tới khi đóng đủ các mục kiểm còn lại.
