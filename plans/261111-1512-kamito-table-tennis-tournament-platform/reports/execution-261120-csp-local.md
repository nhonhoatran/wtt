# CSP frontend cục bộ — 2026-11-20

## Phạm vi và trạng thái

Đã triển khai source theo review của điều phối và reviewer độc lập. Production local chạy `CSP_MODE=enforce`: **112 ca được liệt kê, 104 đạt, 8 skip có chủ đích, 0 lỗi**, gồm 6 ca CSP và 36 lượt axe. Chỉ làm CSP frontend và test liên quan, không đổi `.env`, schema/migration, không commit/push. DB/HTTP/build/server chỉ dùng lease được cấp trên test target cũ. Gate staging vẫn mở; không bật enforce mặc định production.

## Bằng chứng trước sửa

- `apps/client/next.config.ts`: policy Report-Only cố định có `script-src 'self' 'unsafe-inline'`; chưa có nonce theo request.
- `apps/client/src/proxy.ts`: xử lý locale, giới hạn lượt xem, host revalidation và redirect profile; matcher hiện bỏ qua prefetch toàn bộ.
- `apps/client/src/components/content/structured-data.tsx`: JSON-LD script chưa nhận nonce.
- Next cài thực tế **16.4.5** (`apps/client/node_modules/next/package.json`). Source `dist/server/app-render/get-script-nonce-from-header.js` đọc nonce từ CSP/Report-Only của request; `use-flight-response.js` gắn nonce vào inline Flight script. `dist/server/request/connection.js` hỗ trợ buộc render khi có request.
- `VIDEO_EMBED_HOSTS` là allowlist đầu vào video hiện có (`.env.example`, parser backend). Iframe thực tế chỉ dùng hai origin được provider quy định: YouTube nocookie và Facebook. Không chèn raw chuỗi env vào policy.
- Có style attributes cho màu tier và honeypot contact; font Archivo được Next tự host. Giữ ngoại lệ inline style trong phạm vi này, không giả định có thể chặn mọi inline CSS mà không ảnh hưởng giao diện.
- Tham khảo chính thức: [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy). Dùng nonce yêu cầu render theo request; đối chiếu thêm source cài thực tế thay vì suy từ tài liệu phiên bản khác.

## Phương án đã review trước source write

1. Tạo CSP per-request trong proxy bằng nonce ngẫu nhiên CSPRNG 128-bit. Ghi đè request CSP và `x-nonce` do client gửi trước khi chuyển vào Next; response dùng nonce cùng request. Không ghi nonce vào log, cache key hoặc API business.
2. `CSP_MODE` chỉ nhận `report-only` hoặc `enforce`, mặc định Report-Only; mode sai bị từ chối. Enforce chỉ bật khi operator chọn env rõ ràng, không sửa `.env` hoặc deploy trong lượt này. Quyết định mở production nằm ở gate staging/vận hành, không hard-code cấm production vĩnh viễn trong source.
3. Production script policy dùng nonce + `strict-dynamic`, không `unsafe-inline`/`unsafe-eval`; `script-src-attr 'none'`. Giữ style inline và nguồn ảnh HTTPS hiện có, ghi rõ đó là giới hạn. Frame origin suy từ allowlist provider hiện có, không thêm wildcard.
4. Bỏ policy static cũ trong Next config để tránh header mâu thuẫn. Giữ các security header còn lại. HTML động và private/no-store; JSON public có tag vẫn giữ Redis `PublicResponseCache` hiện hành. Key cache không chứa nonce/request CSP; upstream fetch vẫn `no-store` theo thiết kế cache chung của dự án.
5. Prefetch vẫn qua bước CSP, nhưng tách bypass page limiter để giữ hành vi tính lượt xem. Route API/XML/framework/static không bị biến thành trang HTML có nonce.
6. JSON-LD nhận nonce từ request header qua API `headers()`; layout dùng `connection()` để không tái sử dụng HTML/nonce ở thời điểm build.
7. Unit: mode guard, header spoof, nonce mới, allowlist provider, cache và prefetch. Browser production: full/client navigation và back-forward, hydration, menu/video/contact/fonts, không có violation ngoài probe có chủ đích; script thiếu/sai nonce bị chặn và script nonce đúng chạy. Giữ nguyên CSP và rule trong lúc kiểm.

Reviewer đã nhắc kiểm nonce qua RSC/client navigation và bỏ policy static cũ. Source và build đã được review; review tĩnh không đồng nghĩa runtime đã đạt.

## Chẩn đoán và sửa hẹp từ lượt enforce đầu

- `enforce-01` phát hiện 112 ca: **92 đạt, 8 skip, 12 thất bại**. Giữ nguyên log/trace/result của lượt này, không dùng các ca đạt để che các lỗi còn lại.
- Assertion đòi mọi script trong DOM đều có nonce sai với trusted external descendants do Turbopack tạo dưới `strict-dynamic`. Đã chuyển kiểm toàn bộ script trong HTML SSR ban đầu và inline script; không bắt script ngoài được loader tin cậy sinh động phải có nonce.
- Negative control append qua `page.evaluate` không tạo violation, nên chưa chứng minh được parser chặn script. Context của spec đặt `bypassCSP: false`; đã đọc Playwright 1.64.1 `coreBundle.js`, chỉ bật `Page.setBypassCSP` khi option đó true. Không suy diễn một control qua CDP thành bằng chứng browser enforce. Thay bằng controlled parser attack vào HTML thật lấy từ server, giữ nguyên status/CSP header; script thiếu/sai nonce phải bị chặn, nonce đúng là positive control. Chỉ probe tấn công thay HTML, không mock API/DB/queue.
- Phát hiện regression thật khi cho prefetch qua proxy: Next 16.4.5 `dist/server/web/adapter.js` strip `FLIGHT_HEADERS` trước khi gọi proxy ở chế độ normalize mặc định. Vì vậy `next-router-prefetch` không còn hiện cho nhánh bypass limiter.
- Đo chính xác Redis key của IP fixture mới: trước sửa normal search tạo page/search **1/1**, `purpose: prefetch` giữ **1/1**, nhưng `next-router-prefetch: 1` tăng thành **2/2**. Cấu hình đang hoạt động là cửa sổ **60 giây**, page **600**, search **60**; không thay setting hoặc nới hạn mức.
- Sau review, bật `skipProxyUrlNormalize: true` (đã kiểm type/schema của Next cài thực tế và [tài liệu Proxy chính thức](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). Đo lại cả hai loại prefetch giữ **1/1**, chỉ normal GET tiếp theo tăng **2/2**, **3/3**. Raw trước/sau: `enforce-01/debug-rate-counters.json` và `enforce-02/debug-rate-counters.json`.
- Unit bổ sung giữ POST contact không được bypass bằng header prefetch; canonical test thêm `_rsc` query. Lượt đầu còn được giữ làm baseline, không chỉ đổi IP để tuyên bố đã sửa limiter.

## Kết quả thực thi

Artifact gốc: `apps/client/test-results/261120-csp-local/` (ignored). Unit source hiện hành **95/95 đạt**, typecheck/scoped ESLint và production build đạt. Hai kiểm localization từng lỗi vì renderer sync không chờ Server Component async; harness đã dùng renderer async và request-header fixture, không bỏ component. Có lỗi type ở test/env mới trong lúc triển khai, đã sửa trước typecheck đạt.

Lượt `enforce-02` dùng world/PID mới, không ghi đè `enforce-01`. World đầu đã backup và cleanup 1/1 trước restart; stack mới API **22168**, client **2976** được kiểm ownership. Sau khi seed 1/1 đạt, tiến trình Windows thoát native với mã `-1073740791` trước khi chạy ca browser; đây là lỗi runner trước test, không tính thành lỗi sản phẩm. Giữ metadata world bằng `enforce-02/retained-world-after-native-exit.json` và chạy lại bằng retained-world config bỏ global setup/teardown, không tạo thêm world hay ghi đè danh sách ID cũ.

Lượt cuối `enforce-03` đạt **104/104 ca thực chạy**, 8 skip, 0 unexpected/flaky; thời gian **118.064 giây**, exit 0. Raw: `enforce-03/results.json`, `browser.log`, `skipped-reasons.json`. Các skip là nhánh viewport hoặc tác vụ chung chỉ chạy một lần: home settings, HTTP limiter, PDF schedule/bracket, desktop navigation và ba kiểm tra tràn ngang chỉ dành mobile. Không có skip CSP hoặc privacy. Đã kiểm lại source cuối bằng typecheck exit 0 (`typecheck-final-r04.log`) và scoped ESLint exit 0 (`lint-final-r03.log`); production build ở `enforce-02/client-build.log` và unit **95/95** ở `unit-r02.log`.

### CSP thực trên Chromium production

- Cả desktop 1440×900 và mobile 390×844 đều đạt 3 ca riêng. Mỗi viewport kiểm 6 full navigation: home, event overview, draw EN, ranking, contact và home lần nữa. **6 nonce khác nhau mỗi viewport**; toàn bộ script trong HTML SSR và script inline khớp nonce response, font tự host tải được, `Cache-Control` thực có `private` và `no-store`. Không có violation trong thao tác bình thường; response không chứa đồng thời Report-Only header.
- Negative control chèn script vào HTML thật lấy từ server, giữ nguyên status và CSP: script thiếu nonce và nonce sai đều bị chặn; script nonce đúng chạy. Mỗi viewport ghi đúng **2 violation dự kiến**, `script-src-elem`, `blockedURI=inline`, `disposition=enforce`. `addInitScript` chỉ đăng ký listener, không đưa payload tấn công qua CDP.
- React hydration, nút phát video, Next Link đổi VI→EN, back/forward đều hoạt động. Marker DOM xác nhận cùng document; response RSC có nonce mới khác nonce document, không phát sinh violation. Không ép trusted external descendants của `strict-dynamic` phải có nonce trong DOM.
- Raw tổng hợp: `enforce-03/csp-controls-extracted.json` trích trực tiếp attachment của cả 6 ca; giữ nguyên trace/result gốc. Không lưu giá trị nonce vào report/log tổng hợp.

Full suite còn kiểm Server Actions contact và POST limiter, search bucket/prefetch, canonical có `_rsc`, locale/EN404, profile redirect 301, private profile 404/noindex/no Person JSON-LD/no sitemap. Hai probe admin publish → BullMQ revalidation worker → warmed SSR đo **223 ms** và **200 ms**, mỗi probe có 1 job hoàn tất (`enforce-03/ranking-publish-refresh-37712.json`, `ranking-publish-refresh-9040.json`). Không mock API/DB/queue; iframe YouTube bên thứ ba được stub theo convention fixture để kiểm ứng dụng, không phải chứng minh nhà cung cấp bên ngoài tương thích toàn bộ CSP. Riêng negative control thay HTML có chủ đích như mô tả trên.

### Axe và ảnh chụp

`enforce-03/axe-summary-extracted.json`: 9 route × VI/EN × desktop/mobile = **36 lượt scan**, mỗi nhóm 9 lượt; **0 critical, 0 serious, 0 moderate, 0 minor**. Kết quả `incomplete` vẫn giữ: `link-in-text-block` ở profile trên cả hai locale/viewport; `color-contrast` ở event overview/draw trên mobile hai locale. Không gọi đây là chứng nhận WCAG toàn site.

Đã mở trực tiếp 8 ảnh `enforce-03/artifacts/accessibility-public-acces-a92de-l-or-serious-axe-violations-{desktop,mobile}/accessibility-{0,1,2,3}.png`: home, event overview, draw và ranking. Font, màu tier, nút play, bảng/filter/pagination vẫn hiển thị; draw mobile dùng vùng cuộn ngang có hướng dẫn sẵn. Không thấy mất style/font hay trang trống do CSP trong các ảnh đã kiểm.

### Cleanup sau khi được cấp lease

Đã backup 48 file world/probe/log/server identity vào `apps/client/test-results/261120-csp-local/cleanup-20261120-csp-final-01/` trước cleanup. Cleanup seed **1/1 đạt**. Đọc exact ID trước/sau xác nhận 3 event, 6 subevent, 73 player, 6 draw, 72 entry, 2 ranking list, 4 snapshot cùng rule/venue/tier/event type riêng đều về 0. Không dùng điều kiện xóa rộng theo tên hoặc dọn row/queue không rõ chủ từ native crash cũ.

Đã đối chiếu PID, creation time, executable và command line trước khi dừng đúng API **22168** và client **2976**; cả hai process không còn, cổng **3313/3314 không còn listener**, world file hiện hành đã được cleanup seed gỡ. `.env` SHA256 vẫn `A77D3711A901E6A9690BC6E301CB40248EEF0BD8E8EA8BB4324BD4D1A7E1C931`, khớp đầu lượt. Giữ nguyên PostgreSQL/Redis dùng chung. Bằng chứng: `cleanup.log`, `exact-fixtures-before.json`, `exact-fixtures-after.json`, `outcome.json` trong thư mục cleanup; shared DB/HTTP đã được nhường để đội tiếp tục full UI.

## Gate còn mở

- CSP enforce mặc định production, staging violation review và hệ thống CDN/proxy production chưa được xác nhận trong phạm vi local.
- Inline style và nguồn ảnh HTTPS là ngoại lệ được giữ có chủ đích; không gọi đây là policy chặn mọi nguồn nội dung bên thứ ba.

## Bổ sung wiring Compose sau review

Review cuối phát hiện `docker-compose.yml` chưa chuyển `CSP_MODE` và `VIDEO_EMBED_HOSTS` vào environment của service client; opt-in và mapping origin khi đó chỉ được chứng minh bằng direct process env local. Điều phối đã thêm hai biến ở `docker-compose.yml:121`–`122`, mặc định Report-Only và allowlist provider đồng nhất với API; `.env.example:80` khai cấu hình mẫu. Không đổi root `.env` hoặc bật enforce trên môi trường phát hành.

Đã tự đọc delta và chạy lại `node test-results/261120-csp-compose-check.mjs`: cả `report-only` và `enforce` cùng custom host `youtu.be` được render đúng vào client environment; 0 service khởi động, 0 DB connection. Đây là kiểm Compose config, chưa phải container deployment runtime. Docs đã phân biệt HTML per-request/private với Redis data cache và giữ gate staging. Kết quả Lighthouse/k6 trước nonce build thuộc lượt trước; cần packet đo lại riêng để tuyên bố hiệu năng của build CSP.
