---
type: red-team
date: 2026-11-11
plan: 261111-1512-kamito-table-tennis-tournament-platform
reviewers: [security-adversary, failure-mode-analyst, assumption-destroyer, scope-complexity-critic]
status: adjudicated-approved
---

# Red team: kết quả phân xử

40 phát hiện từ 4 reviewer → gộp còn 15 nhóm. Chủ dự án duyệt: nhận cả 15, bác 3 ý. Nhiều hành vi thư viện do reviewer nêu theo hiểu biết, chưa kiểm trên bản sẽ cài → đưa vào spike/test, không ghi như sự thật.

## Quyết định kèm theo (đã chốt 2026-11-11)

| Chủ đề | Quyết định |
|---|---|
| Thời gian | Kéo dài ~20 tuần. Phạm vi ≤ ~80 ngày công, dự phòng tường minh ≥ 12–15 ngày, trừ tuần Tết (mùng 1 Tết Đinh Mùi 2027-02-06 theo nguồn reviewer dẫn; lịch nghỉ chính thức chưa có). Ngày bắt đầu: chờ xác nhận, ghi rõ trong plan.md |
| Engine nhánh đấu | Bỏ `brackets-manager.js` và Spike A; tự viết. Bỏ interface `BracketGenerator` + adapter. Bỏ thử `react-brackets`, dùng UI CSS grid tự làm |
| Truy cập admin | Mở ra internet → cần khóa tạm theo tài khoản, idle timeout, thu hồi phiên |
| Điểm đôi | Cộng cho từng VĐV (giữ nguyên) |
| Điểm giải đã xong | Đóng băng. Đổi quy tắc điểm chỉ áp cho giải kết thúc sau thời điểm đổi |
| Rút lui giữa vòng bảng | Cấu hình trong `GroupScoringRule` (giữ kết quả đã đấu / hủy kết quả); mặc định chờ BTC xác nhận |

## 15 nhóm đã nhận

### 1. Không sửa được draw sau khi công bố — Critical → phase 06, 05
- Thêm thao tác sau công bố, có lý do + audit: `unpublish` (khi chưa có trận không-BYE nào LIVE/OFFICIAL), `replace-entry` tại một vị trí, `withdraw-from-draw` (knockout: walkover trận hiện tại; bảng: theo cờ cấu hình).
- Khóa cấu trúc = "trận không-BYE đầu tiên LIVE/OFFICIAL" (BYE sinh ra đã OFFICIAL nên quy tắc cũ khóa ngay lúc tạo).
- Swap trong DRAFT phải sinh lại trạng thái dẫn xuất (BYE tự đẩy vòng 2).
- Chặn/cảnh báo rút Entry (kể cả bulk) khi Entry đang nằm trong draw đã công bố.
- Thêm `section` cho `Round` vòng loại; `Round` unique không dựa cột nullable (`groupId` NULL không được Postgres ràng buộc).
- `advancePerGroup`: giới hạn {1, 2} hoặc đặc tả vị trí cho N; vị trí Q không rơi đối diện BYE.
- Predicate dùng chung "trận đã đấu thật" (`resultType != BYE`) cho mọi thống kê/danh sách (phase 08, 10).

### 2. Sửa kết quả và toàn vẹn khi chốt đồng thời — Critical → phase 07, 06
- Ba thao tác tách bạch: `amend-scores` (không đổi người thắng, luôn cho phép, có lý do); `reopen` kèm xem trước ảnh hưởng do server tính, lan qua các ô phía sau chưa đấu (gồm vị trí Q và bảng → knockout); đường cưỡng chế cho ADMIN khi trận sau đã đấu, có audit.
- Thêm `un-start` (LIVE → SCHEDULED).
- Mọi mutation trận yêu cầu `expectedVersion` + điều kiện trạng thái (`start`, `save-progress`, `reopen`, `confirm`).
- Khóa ở mức `Draw`/`Group` (`SELECT … FOR UPDATE` hoặc advisory lock) trước khi đọc trạng thái tổng hợp; tính BXH bảng idempotent; `POST /admin/groups/:id/recompute`; reopen phải tính lại BXH.
- `matchNo` cấp theo khóa/sequence mức event.
- Test tích hợp: hai request chốt hai trận khác nhau cùng bảng cùng lúc.
- `auto-schedule/apply` bị cắt (xem nhóm 5); PATCH lịch không làm mất tỷ số đang nhập (version tách hoặc merge theo trường).

### 3. Job ID cố định làm rơi lần tính lại xếp hạng — Critical → phase 09, 07
- Không dùng job id cố định làm debounce. Dùng tùy chọn deduplication/debounce của BullMQ hoặc id duy nhất + `removeOnComplete`; tuần tự hóa theo sub-event trong processor (advisory lock). Kiểm ngữ nghĩa trên bản BullMQ cài thật.
- Dấu "bẩn" bền, không phải outbox: `SubEvent.rankingDirtyAt` ghi trong transaction chốt/reopen, job tính xong thì xóa. `buildSnapshot` tính lại mọi nội dung bẩn trước (hoặc từ chối); màn nháp hiện "N nội dung chưa tính lại".
- Lỗi enqueue sau commit: trả thành công kèm cảnh báo, không 500 (tránh 409 với chính thao tác của mình).
- Test: chốt hai kết quả cách nhau 10 s → sổ điểm phản ánh cả hai. Dựng lại nháp snapshot cùng ngày phải chạy.
- Bổ sung trigger tính lại: đổi `endDate`, `eventTypeId`, hủy/bỏ hủy giải, đổi trạng thái Entry.

### 4. Auth và bull-board nằm ngoài guard; vòng đời phiên — Critical → phase 02 (Spike C), 03
- Tiêu chí đạt Spike C bổ sung: sign-up tắt (404), endpoint admin-plugin tắt hoặc chỉ ADMIN, impersonation tắt, rate limit hoạt động trên handler đã mount, ánh xạ model `User`/role, luồng mật khẩu tạm.
- Test e2e duyệt router Express (không chỉ route Nest), khẳng định allowlist đường dẫn không cần đăng nhập.
- Bọc Better Auth sau controller Nest tường minh (login, logout, me, change-password) nếu khả thi.
- bull-board: cùng session + quyền + kiểm Origin, mặc định chỉ đọc; quyền riêng cho thao tác retry/xóa.
- Thu hồi mọi phiên khi đổi vai trò, reset/đổi mật khẩu, khóa tài khoản. `mustChangePassword` enforce ở guard toàn cục (allowlist `/auth/me`, `/auth/change-password`, `/auth/logout`). Mật khẩu tạm hết hạn (mặc định ví dụ 24 giờ, cấu hình được).
- Idle timeout cho vai trò nhập kết quả; nhập lại mật khẩu cho `reopen`/cưỡng chế, điểm thủ công, chốt snapshot. Đọc role từ DB mỗi request.
- Khóa tạm theo tài khoản (backoff, lưu Redis) song song giới hạn theo IP.

### 5. Lịch không dự phòng, thiếu lát cắt sớm, thiếu chức năng ngày thi đấu — Critical → plan.md, mọi phase
- Tái cấu trúc 20 tuần theo bảng quyết định ở trên; ước lượng lại phase 03, 07, 08; tính thời gian cho bước ui-consistency.
- Lát cắt dọc hết ~tuần 6: 1 giải, 1 nội dung loại trực tiếp, nhập entry tay, bốc thăm, nhập tỷ số, 1 trang nhánh đấu công khai, chạy trên staging.
- Pilot với BTC trên dữ liệu một giải cũ ~tuần 8–9.
- Cổng cứng: câu hỏi quy chế BTC (đặt hạt giống/chia bảng, phá hòa vòng bảng, quy chế điểm xếp hạng) phải có trả lời trước khi bắt đầu phase 06 và 09.
- Cắt (dời "giai đoạn sau"): tự xếp lịch + duplicate-day; trạng thái PENDING/WAITLIST của Entry (giữ CONFIRMED/WITHDRAWN); loại import PLAYERS riêng; export qua queue (đổi sang stream đồng bộ); clone giải; `bestResultsCount`; thống kê mùa của VĐV; công cụ "thiếu bản tiếng Anh"; load test 50 req/s (giữ smoke test nhẹ); link xem trước có token; autosave 30 s; CRUD chuyên mục video/liên hệ; sắp thứ tự khối trang chủ.
- CMS còn ~6 model: Article (1 trường chuyên mục), Video, Sponsor (link giải tùy chọn + thứ tự), StaticPage, ContactMessage.
- Vai trò: 2 (ADMIN, RESULTS_OPERATOR), giữ guard deny-by-default; ma trận gọn theo nhóm menu. Thêm vai trò khi có người thật cần.
- Tham số kỹ thuật chuyển sang env (giới hạn upload, loại ảnh, bề rộng variant, `import.maxRows`, retention, page size, host nhúng video). Registry admin chỉ giữ giá trị nghiệp vụ.
- Thêm (bù từ phần cắt): stylesheet in cho nhánh đấu, lịch theo session/bàn, phiếu trận; gộp hai hồ sơ VĐV (trỏ lại Competitor, Pair, sổ điểm, rồi tính lại).
- Danh sách cắt có thứ tự ưu tiên khi trễ, nằm trong phase 04–10; hardening ra mắt không bị cắt trước CMS.

### 6. Cơ chế revalidate của Next.js chưa kiểm chứng — Critical → phase 02 (Spike E mới), 07, 08, 10
- Spike E trên bản Next.js đã ghim: fetch có tag → route handler → vô hiệu tag → HTML mới ngay ở request đầu tiên; đo thời gian chốt → HTML mới; thử cả khi container client khởi động lại. Kiểm API hiện hành (reviewer dẫn docs: `revalidateTag` một tham số bị deprecated, dạng khuyến nghị là stale-while-revalidate, cần dạng hết hạn ngay; `middleware.ts` đổi thành `proxy.ts`).
- Tag chính xác, không wildcard (`groups-{drawId}`, `rankings`); chiến lược tag theo slug/id khai báo được trước khi có response.
- Một bảng `cache-tags.ts` ánh xạ mọi mutation admin → tag, có test khẳng định; hook revalidate cho mọi module ghi (lịch, reopen, start, phá hòa thủ công, rút entry, sửa/hủy giải, AppSetting, sửa VĐV).
- TTL ngắn đồng nhất cho trang ngày thi đấu thay cho quy tắc "trang có trận live".
- Nút admin "Làm mới trang công khai" theo giải.
- `sitemap` sinh động (build trong Docker không gọi được API).

### 7. Thứ tự deploy/migrate, staging, sao lưu — High → phase 01, 02 (Spike D), 12
- Staging tạo ở phase 01 như một cổng; deploy + migrate staging cuối mỗi phase.
- Quy trình phát hành viết ở phase 01, diễn tập ở Spike D: build → `pg_dump` DB dự án về nơi dự án kiểm soát → migrate → đổi container. Migrate là bước bắt buộc trước khi app chạy (vd service migrate + `service_completed_successfully`), vẫn giữ xác nhận host + tên DB.
- API kiểm lúc khởi động: `_prisma_migrations` chậm hơn bộ migration đi kèm → dừng.
- Quy tắc tương thích ngược đưa vào "Ràng buộc cứng": migration chạy được trước code cần nó, chỉ cộng thêm; bước phá hủy lùi một bản phát hành.
- Runbook `prisma migrate resolve` cho migration lỗi.
- Chủ sở hữu sao lưu, RPO, diễn tập khôi phục: trước lần nạp dữ liệu thật đầu tiên, không để tới tuần cuối.
- Preflight phase 01: phiên bản PG, quyền CREATE trên schema, pooler (pgbouncer), SSL, giới hạn kết nối, shadow DB cho `migrate dev`, phiên bản Redis.

### 8. Hạ tầng dùng chung không cách ly — High → phase 01
- `QUEUE_PREFIX` bắt buộc (vd `kamito-tt:{env}`), kiểm lúc khởi động, khác nhau giữa môi trường.
- Production: worker từ chối chạy khi policy không phải `noeviction` hoặc không kiểm được (trừ khi có env override tường minh). Redis riêng cho BullMQ là cổng ra của phase 01.
- MinIO: service account giới hạn một bucket. PostgreSQL: role runtime chỉ DML + role migrate riêng, nếu hạ tầng cấp được (ghi thành câu hỏi cho chủ hạ tầng).
- Worker nạp lại và kiểm trạng thái từ DB, không tin payload job.
- Câu hỏi cho chủ hạ tầng: các dịch vụ có dùng chung với dự án khác không, ai giữ thông tin đăng nhập.

### 9. Luồng upload và khả năng truy cập MinIO — High → phase 01, 04
- Cổng phase 01: trình duyệt có tới được MinIO qua HTTPS không, ai đặt được policy/CORS. Hai thiết kế tường minh: (a) truy cập trực tiếp; (b) upload qua API + ảnh phục vụ qua route Next hoặc proxy Traefik có cache dài.
- Upload vào prefix riêng tư `incoming/`; worker kiểm, chỉ sao bản đã mã hóa lại sang `public/`, xóa bản gốc dù đạt hay không.
- Presigned PUT không ép được dung lượng → presigned POST có `content-length-range` (kiểm MinIO hỗ trợ) hoặc stream qua API có trần cứng; worker `HeadObject` kiểm dung lượng trước `GetObject`.
- Ghi dòng upload-intent (`PENDING`) lúc presign; các lệnh sau tham chiếu id, không nhận key từ client.
- Test: quá dung lượng, sai Content-Type, key lạ.

### 10. Kiểm soát bảo mật làm quá trễ — High → phase 04, 08, 01, 11, 12
- Sanitizer rich-text + bộ test XSS chuyển về phase 04 (không được cắt); trước đó lưu/hiển thị `infoBody`, `bio` dạng text thuần. Sanitize khi lưu và khi render.
- Mọi trường URL chỉ nhận `https:` (kiểm ở server).
- Host nhúng video là allowlist trong env/code.
- CSP report-only từ phase 08, enforce ở phase 12.
- CI từ phase 01: `pnpm install --frozen-lockfile`, `pnpm audit --audit-level high`, quét secret; ghim base image.
- Secret tách riêng (auth, revalidate, salt IP), có trong bảng env. `admin-entrypoint.sh` chỉ ghi allowlist khóa không bí mật vào `/config.json`, có test.
- `/api/revalidate` không lộ ra domain công khai (cổng/route nội bộ).
- Kiểm license + bảo trì cho mỗi thư viện "chưa kiểm chứng" trước lần dùng đầu.

### 11. Import Excel và danh tính VĐV — High → phase 05
- Trần dung lượng cho file import; trần kích thước giải nén/số ô khi stream; worker có giới hạn bộ nhớ.
- Commit chạy lại khớp dữ liệu từng dòng trong transaction (kết quả validate chỉ để xem trước), gắn với ETag/SHA-256 của file; khử trùng VĐV mới trong cùng file; advisory lock theo phạm vi import.
- Trạng thái commit theo dòng; thử lại tiếp tục từ dòng chưa commit.
- Import ENTRIES không sửa trường danh tính của `Player` đã có: chỉ liên kết, lệch thì báo lỗi.
- Khớp chỉ theo tên → "cần xác nhận" ở màn xem trước, hiện CLB, người vận hành chọn liên kết hay tạo mới.
- `AuditLog` mỗi lần import (job id, số lượng, id tạo/sửa).
- Từ chối (hoặc cần override) import vào nội dung có draw khác DRAFT; unique seed theo nội dung/giai đoạn ở DB.
- `birthYear` tách khỏi `birthDate`; quy tắc hậu tố slug; template xuất sẵn mã VĐV cũ.
- Gộp VĐV: xem nhóm 5.

### 12. Xếp hạng không tái lập được — High → phase 09, 10, 06, 05
- Đóng băng điểm khi giải kết thúc: lưu điểm đã áp trên dòng sổ, chỉ tính lại khi đổi kết quả; quy tắc có `effectiveFrom`.
- Snapshot lưu kèm breakdown (hoặc id các dòng sổ); trang công khai đọc breakdown từ snapshot, không đọc sổ sống.
- Mã giai đoạn vòng loại tính từ trận cuối section (`QF-1`, `QF-2`…), không theo số vòng. Thêm case section lệch kích thước vào test.
- Chặn UPDATE/DELETE trên dòng snapshot đã công bố (ràng buộc DB hoặc kiểm ở service + test).
- Hạt giống cặp đôi: tổng điểm hiện tại của hai VĐV trong bảng đôi tương ứng, chưa có hạng tính 0; `pointsAtEntry` lưu tổng, `rankingAtEntry` nullable cho cặp. Hỏi BTC xác nhận.
- VĐV loại ở vòng bảng: mã giai đoạn có thể phân biệt theo thứ hạng trong bảng (cấu hình).

### 13. Luật vòng bảng cho walkover/bỏ cuộc/rút lui — High → phase 04, 06, 07
- Tỷ số quy ước cho ván chưa đấu/dở dang là quy tắc cấu hình, đưa vào bộ tính BXH (walkover hiện lưu 0 ván; RETIRED có thể cho người thắng ít ván hơn).
- Thêm `pointsUnfinishedLoss`; xử lý chia cho 0 ở tỷ lệ ván/điểm.
- Rút lui giữa bảng: theo cờ cấu hình (xem bảng quyết định).
- Bổ sung các case này vào ma trận test engine.

### 14. Tô-pô mạng, IP thật, rate limit, health — High → phase 01, 03, 08, 11
- nginx admin chỉ proxy `/api/v1/admin/` và `/api/v1/auth/`; `/public` và `/health` trả 404 trên domain admin.
- Định nghĩa chuỗi proxy tin cậy (Traefik → nginx/Next → API), header IP thật do proxy ghi đè, `trust proxy` tường minh.
- Rate limit site công khai đặt ở Traefik hoặc Next, không ở API (API chỉ thấy IP container); miễn/định danh riêng cho SSR nội bộ.
- Giới hạn độ dài `q`, không cache trang kết quả tìm kiếm.
- Tách `/health/live` (dùng cho healthcheck container) và `/health/ready` (phụ thuộc, không công khai).
- Múi giờ container đặt tường minh (mặc định theo cấu hình giải).

### 15. Audit trail, phạm vi công khai, dữ liệu VĐV nhỏ tuổi, song ngữ — High/Medium → phase 01, 06, 08, 10, 12
- `AuditLog`: thêm `ip`, `userAgent`, `sessionId`, `requestId`, actor không null (có actor `system`); màn xem chỉ đọc cho ADMIN.
- Audit: mọi lần sinh draw kể cả bản bị bỏ (seed + tham số), sửa seed/stage/quota của Entry, đổi lịch, start/save-progress, xóa điểm thủ công.
- Một predicate phạm vi công khai dùng chung (giải đã công bố và không hủy, draw đã công bố, entry CONFIRMED), test cho từng endpoint; tra theo slug/mã dưới giải thay vì id thô; test whitelist toàn bộ trường serialize.
- Cờ `isPublicProfile`/`noindex` theo VĐV + tên hiển thị thay thế; tắt JSON-LD `Person` và sitemap VĐV cho tới khi câu hỏi về đồng ý công khai được trả lời.
- Thời hạn lưu `ContactMessage`; quy tắc che PII trong JSON audit.
- Rà mọi trường hiển thị công khai: thêm `En` hoặc tuyên bố trung tính ngôn ngữ; nhãn placeholder trận lưu dạng tham chiếu có cấu trúc (`{type: WINNER_OF, matchNo}`) render qua từ điển; `displayName` cặp dẫn xuất lúc đọc hoặc làm mới khi đổi tên; `fullNameEn` mặc định là tên bỏ dấu.

## Đã bác

| Ý | Lý do |
|---|---|
| MFA/TOTP cho admin | Quá nặng cho vài nhân viên; thay bằng khóa tạm theo tài khoản + idle timeout + thu hồi phiên |
| Hai người khác nhau mới chốt được snapshot khi có điểm thủ công | Nhóm nhỏ; đã có audit + nhập lại mật khẩu |
| Worker/container riêng cho import | Trần dung lượng + giới hạn bộ nhớ là đủ |
| `AuditLog` INSERT-only bằng trigger/role DB | Chỉ làm nếu hạ tầng cấp được role tách; không là điều kiện ra mắt |

## Câu hỏi chưa giải quyết

1. PostgreSQL/Redis/MinIO có dùng chung với dự án khác không; ai giữ thông tin đăng nhập?
2. Dokploy/Traefik có chuyển IP thật tin cậy vào container không? Có tự deploy khi push không; chạy container profile tools từ thư mục compose được không?
3. BTC: rút lui giữa bảng giữ hay hủy kết quả; quy tắc đặt hạt giống/chia bảng; tiêu chí phá hòa; quy chế điểm thật; cách tính hạt giống cặp đôi.
4. Ngày bắt đầu dự án và lịch nghỉ Tết chính thức.
5. Đồng ý công khai thông tin VĐV, nhất là VĐV nhỏ tuổi.
