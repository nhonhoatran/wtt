# Review phase 11 — CMS

Ngày: 2026-11-19.

## Kết luận

**Phê duyệt phạm vi mã nguồn đã rà soát.** Không còn finding Critical/P1/P2 trong phạm vi này. Kết luận không thay thế kiểm thử tích hợp với DB thật, kiểm tra giao diện hoặc xác nhận staging.

Vòng cuối kiểm tra thay đổi router admin, parser Refine, guard nội dung chưa lưu, đường xử lý lỗi liên hệ và các bản sửa hydration/editor/ô chọn giải được xác nhận bằng browser mock. Các vòng trước đã rà API CMS, worker hẹn giờ, audit, upload ảnh và sắp thứ tự tài trợ. Không kết nối DB, chạy migration hoặc triển khai trong quá trình review.

## Bằng chứng kiểm tra

- Dùng `createMemoryRouter` và `renderToString` với React Router/Refine đang cài; nạp wrapper và toàn bộ resource khai báo hiện tại. **53 URL list/create/edit/show đạt**, gồm CMS và các màn có sẵn. `resource`, `action`, `id` giữ đúng; `pageSize` và `q` được giữ; tham số splat `*` bị loại. Nguồn: `apps/admin/src/app.tsx:64`; parser gốc: `apps/admin/node_modules/@refinedev/react-router/src/bindings.tsx`.
- Admin chuyển sang data router; guard dùng `useBlocker` cho điều hướng trong ứng dụng và lịch sử trình duyệt, cùng `beforeunload` cho điều hướng toàn trang. Nguồn: `apps/admin/src/app.tsx`, `apps/admin/src/pages/ranking/ranking-rules-unsaved-guard.ts:10`. Browser mock của ứng dụng thật đã kiểm tra hủy/xác nhận native Back/Forward, giữ nháp và lưu thành công không báo nhầm thay đổi chưa lưu.
- Các lệnh test tập trung do reviewer chạy: worker publishing **5/5**, API CMS/audit/reorder/home query **32/32**, client proxy/structured data/sanitizer **7/7**. Không test nào trong nhóm này cần DB thật.
- Regression test dùng TipTap đang cài: **3/3 đạt**, chứng minh mặc định `setEditable` phát update dù tài liệu không đổi; helper cập nhật trạng thái im lặng giữ nguyên cả tài liệu Việt/Anh và không ghi ngược vào form. Lệnh: `pnpm --filter @kamito/admin exec node --test test/rich-text-editor-state.test.mjs`.
- Đã đọc script và log browser mock cuối của nhóm UI: **8/8 đạt**, không có page error theo assertion. Phạm vi gồm native history, article edit/save, player/event/ranking không thuộc CMS, hydration video/trang tĩnh/tài trợ, upload clipboard đợi `READY` và từ chối URL ảnh tương đối. Script: `apps/admin/test-results/phase11-unsaved-navigation.browser.mjs`; log: `apps/admin/test-results/phase11-admin-browser-final.txt`. Đây là API/media mock, không phải E2E với dịch vụ thật.
- Matcher Next với `/vi/contact` đã được đối chiếu bằng `unstable_doesMiddlewareMatch`: request thường và request có từng header `purpose: prefetch`, `next-router-prefetch` đều khớp. Bộ test proxy hiện tại kiểm cả hai locale.

## Các finding trước đã đóng

| Nhóm | Trạng thái cuối và bằng chứng |
|---|---|
| Chọn giải trang chủ | Điều kiện ngày địa phương và cờ nổi bật được áp dụng trước giới hạn số dòng; `apps/api/src/modules/public-events/public-home-events.query.ts`. |
| Tranh chấp lịch đăng | Worker cập nhật có điều kiện theo trạng thái và `publishAt` đã đọc; `apps/worker/src/processors/publishing-processors.ts:21`. |
| Phục hồi cache sau khi đã đăng | Job chạy lại và sweep vẫn enqueue tag rộng `articles`/`home`, kể cả khi không còn dòng `SCHEDULED`; `apps/worker/src/processors/publishing-processors.ts:16`, `:38`. |
| Trạng thái video/trang tĩnh | DTO và UI chỉ nhận trạng thái đăng ngay/nháp/lưu trữ; `apps/api/src/modules/content/admin-content-dtos.ts:7`, `apps/admin/src/resources/content/content-form-fields.tsx`. |
| Liên hệ và giới hạn gửi | Bộ đếm Redis dùng Lua; matcher hai route liên hệ không phụ thuộc header prefetch; `safeSubmit` bắt lỗi Server Action để hiển thị trong form. Nguồn: `apps/api/src/modules/public-content/public-content.controller.ts`, `apps/client/src/proxy.ts:51`, `apps/client/src/components/content/contact-form.tsx:11`. |
| Audit và cảnh báo sau ghi | Mutation và audit cùng transaction; cập nhật bản ghi có khóa hàng. Lỗi enqueue sau commit được trả dưới dạng cảnh báo; `apps/api/src/modules/content/content-writes.service.ts:148`, `publishing-enqueue.service.ts`. |
| Thứ tự tài trợ | PATCH chấp nhận cập nhật thứ tự riêng; reorder kiểm tra trùng/phạm vi, dùng advisory lock và transaction với audit; `apps/api/src/modules/content/sponsor-order.service.ts:22`. |
| Upload ảnh bất đồng bộ | Chỉ bật khi host đăng ký trạng thái upload; host CMS chặn lưu khi ảnh chưa xong. Có kiểm tra MIME, dung lượng, SVG và URL HTTPS; `apps/admin/src/components/rich-text-field.tsx:138`, `rich-text-image-policy.ts`, `resources/content/content-forms.tsx`. |
| Nội dung rich text trắng sau nạp | Trace trước sửa ghi nhận API hydrate HTML Việt/Anh, sau đó `setEditable` phát `onUpdate` tài liệu rỗng và ghi `''` vào form. Cả hai đường cập nhật editability nay dùng helper `setEditable(editable, false)`; regression test và browser mock xác nhận giữ nguyên HTML. Nguồn: `apps/admin/src/components/rich-text-editor-state.ts:4`, `rich-text-field.tsx:145`, `:163`. |
| Dữ liệu form sửa bị thay bằng mặc định | Video/trang tĩnh/tài trợ trộn `formProps.initialValues` sau các giá trị mặc định, giữ nguyên dữ liệu đã lưu. Browser mock xác nhận cả ba màn, gồm `Sponsor.order = 7` và `isActive = false`; `apps/admin/src/resources/content/content-forms.tsx`, `apps/admin/src/resources/sponsors/sponsor-form.tsx`. |
| Ô chọn giải gửi filter không hỗ trợ | Hook nội dung dùng query phân trang/tìm kiếm phía server theo hợp đồng `/admin/events`, không gửi `filter[isActive]`; tải riêng tên giải đã chọn nếu nằm ngoài trang hiện tại. Mock trả 400 nếu filter cũ xuất hiện và lượt cuối đã đạt; `apps/admin/src/resources/content/use-content-event-options.ts`. |
| JSON-LD | Escape ký tự có thể đóng thẻ script trước khi render; `apps/client/src/lib/structured-data.ts`. |

## Giới hạn xác minh

- Chưa chạy migration trên DB thật; chưa kiểm chứng truy vấn SQL, khóa/transaction và tranh chấp bằng PostgreSQL thật.
- Chưa xác minh luồng đầy đủ DB–Redis/BullMQ–media storage–Next bằng dịch vụ thật trong vòng review này.
- Browser mock kiểm tra hành vi không thay thế kiểm tra trực quan. Báo cáo này không xác nhận toàn bộ giao diện đã được kiểm tra; ảnh chụp thuộc luồng UI riêng.
- Chưa triển khai hoặc xác nhận staging.

Các mục trên là giới hạn kiểm chứng còn mở, không phải finding lỗi mã nguồn đã xác định.
