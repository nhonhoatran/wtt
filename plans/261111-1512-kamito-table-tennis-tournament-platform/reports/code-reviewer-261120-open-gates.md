# Review độc lập các gate còn mở — 2026-11-20

## Phạm vi

Review file-only phần full UI orchestration, các helper nhập kết quả/xếp hạng và thao tác rút thành viên vòng bảng. Không chạy DB/HTTP/build trong thời gian đội thực thi giữ lease. Báo cáo này không thay thế kết quả browser, nghiệm thu nghiệp vụ hay staging.

## Full UI runner

Chưa phát hiện blocker P1/P2 trong snapshot đã đọc:

- `test-results/261120-full-ui-runner.mjs:10`: yêu cầu lease, chỉ lấy credential của PG local cổng 5433 để nhắm DB test đã được duyệt; UUID riêng cho output, queue prefix, upload directory. Không ghi `.env`.
- `test-results/261120-full-ui-runner.mjs:52`: kiểm ba cổng trống và production build tồn tại; runner không tự build. API kiểm pending migrations, không tự migrate khi khởi động.
- `test-results/261120-full-ui-runtime-support.mjs`: kiểm process PID, coordinator PID và command line trước HTTP/kill; health chỉ đọc listener vừa tạo. Timer có giới hạn và được gỡ sau `Promise.race`.
- `test-results/261120-full-ui-runner.mjs:67`: chờ worker dừng, không gọi PASS nếu worker exit khác 0; cleanup toàn bộ listener đã launch kể cả trường hợp readiness ném lỗi trước khi trả về. Kiểm cổng sau stop, CAS restore runtime config admin và đối chiếu hash `.env`.
- Secret hiện hành và mật khẩu tài khoản fixture được redact trước khi ghi log. World dùng tài khoản tự tạo cho lượt kiểm thử, không dùng tài khoản người thật.

Lỗi setup/runner phải giữ riêng với lỗi ca browser; không xem prepare/syntax là bằng chứng luồng tám bước đã đạt. Runtime browser đang do đội thực thi kiểm chứng.

## UI rút vận động viên vòng bảng

Delta nằm trong bốn file `apps/admin/src/pages/event-hub/{group-card,group-tables-view,draw-panel,draw-entry-action-modal}.tsx`.

- Capability yêu cầu quyền update và draw `PUBLISHED`; hàng đã `WITHDRAWN` hoặc standing không còn member không có nút thao tác.
- Tái sử dụng endpoint `withdraw-entry`, gửi `entryId`, `expectedVersion`, `reason`; preview dùng `dryRun`. Query key có thêm `entryId`, tránh dùng nhầm preview của thành viên khác.
- Không truy cập `positions` cho group target; lựa chọn thay người/radio chỉ hiện cho bracket cell. Nút rút bảng dùng tên truy cập chứa vận động viên và mã bảng.
- Bảng trong card rộng cố định có vùng cuộn nội bộ. Không thay schema, quy tắc nghiệp vụ hay quyền server.

Không phát hiện P1/P2 ở delta hiện hành. Kiểm SSR bốn ca chỉ xác nhận control rendering; bằng chứng mutation/preview/walkover cần browser thật của full UI suite.

## Helper kết quả và xếp hạng

Đã đối chiếu `apps/client/tests/admin-full-flow/results.ts` với `ResultsEntryPage`, `GameScoreInputs`, `MatchScoreDrawer`, `AmendScoresModal`, `ReopenPreviewModal`, `useMatchActions` và DTO hiện hành. Textbox aria labels, filter `OPEN`/`OFFICIAL`, GET detail, POST confirm/amend/reopen, preview và password step-up khớp source.

Public score được làm nóng trước mutation UI, đọc lại điểm từng ván/tổng ván/trạng thái và đo từ thao tác chốt thật. Sửa điểm giữ nguyên người thắng có kiểm trước/sau. Supplemental operator reopen 403 được ghi rõ là HTTP request từ browser context vì nút bị ẩn theo quyền; không gọi phần đó là thao tác UI.

Helper snapshot đọc hết các trang admin, kiểm competition rank khi bằng điểm và thứ tự điểm giảm dần. Public ranking đối chiếu toàn bộ hàng đang hiển thị với phần đầu dữ liệu admin, rồi kiểm breakdown của sự kiện tương ứng. Phần công bố không dùng API write thay cho thao tác UI.

Giới hạn fixture: `resultRows` chỉ đọc trang danh sách kết quả hiện tại. Fixture tạo QUALIFYING trước MAIN và loop loại dần OFFICIAL; các assertion số trận 15/8/15/7 sẽ bắt thiếu trận. Nếu đổi thứ tự cấp matchNo hoặc quy mô fixture, cần rà lại paging để tránh dừng loop khi trang đầu chỉ còn trận chưa đủ hai bên. Đây chưa phải kết luận paging toàn sản phẩm có lỗi.

Bổ sung sau runtime R03: review tĩnh ban đầu bỏ sót kỳ vọng trạng thái reopen trong test. `match-reopen.service.ts:82` chuyển chính trận được mở lại sang `LIVE`, xóa kết quả tổng nhưng giữ game draft; `SCHEDULED` áp dụng cho downstream reset. Test ban đầu chờ `SCHEDULED`/game rỗng, còn helper làm nóng trang public cố định nhãn “Chưa đấu”. Đã đối chiếu source và gửi dependency này cho tác giả test; delta hiện hành chọn nhãn theo trạng thái, kiểm `LIVE`, kết quả tổng rỗng/game được giữ/version tăng. Đây là sửa test theo contract hiện có, không đổi API; vẫn chờ runtime rerun xác nhận luồng sau đó.

## API rollback B: provenance và chuẩn bị

Đã tự tính lại full commit/tree, ZIP SHA256 và toàn bộ file hash của hai archive trong `test-results/261120-api-rollback/67e49e56-f2bf-4817-98ec-d3443c968bd7/`: current 1116 file, previous 1095 file; đều khớp manifest, không có symlink/artifact bị cấm. Hash `.env` khớp. Hai Dockerfile có runtime `CMD ["node", "dist/main.js"]`, migrate là stage riêng.

Image builder đã có guard C/D tối thiểu 6 GiB trước/giữa build và mỗi 30 giây, giới hạn 15 phút; chỉ terminate child build được xác minh, không prune. Đây là review provenance/config, chưa có image build hoặc runtime result trong phạm vi báo cáo này.

Runtime B do chính người viết báo cáo chuẩn bị, nên phần dưới là self-check, không gọi là review độc lập: ba file `test-results/261120-api-rollback-runtime*.mjs` đều dưới 200 dòng và syntax đạt; target/entrypoint/path negative controls đạt; Recovery A default constructor/self-test vẫn đạt. Plan UUID riêng `0bd9bd7a-8fff-47d2-9618-369f01e7433c` chưa start container hoặc query DB. Runtime được yêu cầu chờ điều phối review trước lần chạy đầu.

Node image có thể kế thừa `docker-entrypoint.sh`; guard không giả định entrypoint rỗng. Nếu có, runner sao chép bytes từ owned stopped container, kiểm wrapper exec-only chính xác và lưu SHA trước start. Actual image inspect/entrypoint bytes vẫn cần kiểm sau khi build. Scope dự kiến chỉ hai API committed revisions đọc cùng fixture 18 migrations, không tương đương rollback toàn release.

Sau khi được phép inspect image read-only: Redis 8.2.11-alpine local là Linux/amd64, ID `sha256:da23c2478319ceb4903857d77a2fd7aa5137d9e9d4c8165dafbacedac6403e95`, đã pin trong runtime guard. Pinned Node 24.22.3-alpine3.23 chưa có local (`No such image`); chưa pull/build. Raw metadata: `test-results/261120-api-rollback/67e49e56-f2bf-4817-98ec-d3443c968bd7/preflight-image-availability.json`.

Helper `test-results/261120-api-rollback-image-cleanup.mjs` mới chỉ syntax/self-test 1 positive + 3 negative: yêu cầu exact build ID/revision labels, không có tag/digest lạ hay container tham chiếu; chỉ xóa hai tag riêng, không force/prune. Chưa chạy cleanup image thật; điều phối cần review trước khi sử dụng.
