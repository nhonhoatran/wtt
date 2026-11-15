# Review cuối — xử lý nợ phase 08 còn lại

Ngày: 2026-11-15. Đối chiếu [plan](./plan-261115-phase08-remaining-debts.md), các review lát cắt/đợt 1–3 và diff cuối đang có. Không stage, commit, push hoặc triển khai staging trong lượt review này.

## Kết luận

**Đạt phần code local — 9,5/10.** Không còn phát hiện critical/high/medium chưa xử lý trong phạm vi các nợ code được giao. Các cổng staging vẫn mở; điểm này không xác nhận hạ tầng production, IP thật qua Traefik hoặc hiệu năng dưới tải thật.

## Đối chiếu nợ đã xử lý

| Nợ | Bằng chứng implementation / kiểm chứng |
|---|---|
| Lifecycle theo timezone trước phân trang | `public-event-list-filter.ts` SQL tham số hóa tính ngày riêng từng giải; count và ID trang cùng predicate. `public-events-list.query.ts` chỉ hydrate trang đã cắt. Serializer nhận cùng timestamp chụp đầu request. Bảy timezone gồm IANA và offset cố định có test count/page/badge. |
| Ngày DST | `public-query-params.ts.zonedDayRange` tìm hai mốc độc lập, không cộng cứng 24 giờ. Test 23/25 giờ, mất nửa đêm, bỏ ngày Apia và offset lẻ. API trận kiểm giờ cuối ngày được lấy và nửa đêm sau bị loại. |
| Ngày đầu vào gây 500 | Review cuối phát hiện ngày đúng hình thức nhưng sai tháng (`2026-99-99`) khiến `toISOString` ném lỗi. Đã kiểm `Number.isFinite` trước khi chuyển; unit và API thật xác nhận tham số sai bị bỏ qua, trả 200. |
| Tìm alias không dấu / tên thật bị ẩn | Migration `20261115032757_add_player_public_name_key` tạo khóa chuẩn hóa effective public name, trigger mọi INSERT/UPDATE và backfill. Public matches tìm khóa này, không dùng tên thật khi có alias. Suite đơn/cặp kiểm có dấu, không dấu, NFC/NFD, Đ/đ và loại tên thật. |
| Thứ tự entry / phân trang | `public-entry-page.query.ts` sort seed rồi khóa tên công khai đơn/cặp và ID ổn định trong PostgreSQL trước LIMIT/OFFSET; hydrate whitelist theo ID trang. EXPLAIN fixture nhỏ xác nhận Limit đúng hai hàng. Không tải hết entry về ứng dụng để sắp. |
| Settings nhiều API instance | `AppSettingsService.get` đọc DB, bỏ RAM TTL riêng instance. Test hai service instance kiểm ghi/reset phía thứ nhất được đọc ngay phía thứ hai. |
| Cache nhiều client instance / timeout nền | `api-client.ts` luôn fetch no-store với AbortSignal timeout; Redis giữ JSON TTL/tag, bỏ Next persistent fetch cache riêng từng instance. Tag version vĩnh viễn tránh resurrection khi TTL đổi; epoch chặn late writer. Redis đọc lỗi đọc upstream, invalidation lỗi trả 503 cho worker retry. |
| Rate limit nhiều client instance | Lua atomic áp page/search, dùng Redis TIME, prune registry trước admission cap. Hai connection và smoke hai process Next kiểm budget dùng chung. IPv6 canonical/mapped/scope có regression test; header thiếu chỉ cảnh báo một lần. Redis lỗi dùng local fallback. |
| Giới hạn ngày 62 / tab mặc định | FilterForm nhận date input có min/max ngày giải; `dateWithin` kiểm ngày thật, không dựng danh sách 62 ngày. `loadMatchList` chọn trạng thái đầu tiên có kết quả theo lifecycle khi không có yêu cầu rõ trong URL; tab chọn rõ không bị tự đổi. |
| Code URL, mặc định main, nhãn/SEO | API/client dùng chung validator gồm leading `_`/`-` và mã ghép 81 ký tự; traversal vẫn bị loại. Normalize stage main, draw không có dữ liệu 404 sớm, lỗi /en tiếng Anh, nav aria-current, nhãn cột riêng. Canonical calendar/sitemap khớp, ảnh test dùng outputPath. |
| Tổ chức contract | Tách contract event/competition có re-export tương thích; import vòng là type-only, không thêm runtime cycle. Home dựng trạng thái từ hợp đồng typed. |

## Review adversarial và sửa trong lượt này

- SQL động chỉ gồm mảnh cố định `Prisma.sql`; giá trị đầu vào, timestamp, LIMIT/OFFSET được bind. Nhánh timezone offset tránh quy ước đảo dấu của PostgreSQL khi nhận offset dạng text. Predicate public được giữ ở query ID và bước hydrate.
- Cột normalizedPublicName không ra serializer công khai. Trigger bảo vệ key khỏi ghi trực tiếp sai và đồng bộ alias/name/import/merge. Migration được tạo create-only, review SQL rồi deploy DB local từ `.env`; không dùng db push. Chi tiết: [kiểm tên công khai](./tester-261115-phase08-public-player-names.md).
- Redis key dùng `QUEUE_PREFIX:public:v1`, response key băm SHA-256; không chứa secret hoặc nội dung tìm kiếm thô trong key. Response có TTL, tag version tồn tại theo tập tag thực thể do invalidation nội bộ cung cấp. Không đặt TTL version theo TTL hiện tại để tránh cache cũ sống lại.
- Đã bắt và sửa listener Redis bị gắn nhiều lần, finite tag expiry, admission check trước prune và clock skew score registry. Epoch Lua cùng GET/SET giữ fence nguyên tử; invalidation tag khác không xóa response đã lưu không liên quan.
- CSP parser giới hạn byte thực, kiểm sớm Content-Length, bỏ shape sai; matcher vẫn tính dotted page path, bỏ prefetch. 429 no-store. Redis mất kết nối không được báo như invalidation thành công.
- Tổng và page là query riêng như thiết kế trước; không đưa ra cam kết snapshot transaction khi admin sửa dữ liệu đúng giữa các query. Không thấy query DB trong vòng lặp hiển thị, không có N+1 theo số card/entry.

## Bằng chứng kiểm chứng

| Kiểm tra | Kết quả / nguồn |
|---|---|
| API hồi quy 8 spec: events, timezone, DST, public names, matches, groups/entries, schedule, site | **50 ca đạt**, lượt chạy tuần tự do tác vụ điều phối cung cấp; không báo là toàn bộ API suite. |
| Sau sửa ngày không hợp lệ | API `public-match-dst.e2e-spec.ts` **3/3 đạt**, unit `public-query-params.test.ts` **11/11 đạt**; chạy trực tiếp trong tác vụ review. |
| Client unit cuối sau bổ sung fault-path | **8 file / 41 ca đạt**, chạy trực tiếp; fault-path mới **6/6 đạt**, Redis cache/rate subset **7/7 đạt** với Redis thật. |
| Hai API service instance | `settings-replica-consistency.e2e-spec.ts` **1/1 đạt**, lưu/khôi phục nguyên hàng setting ban đầu. |
| Production build | Đạt, tác vụ điều phối. Build không cần kết nối Redis khi tạo module; kết nối tạo lười lúc request. |
| Hai Next production process | Đọc artifact `apps/client/test-results/multi-instance/result.json`: **5/5 check true**, Next 3101/3102, API 3200. Kiểm cache cũ ở cả hai, invalidate một replica làm mới cả hai, budget search chung, dotted path không né, prefetch/IP khác không bị ảnh hưởng. |
| Typecheck/lint/diff | API và client typecheck đạt; lint source/test liên quan đạt; `git diff --check` không lỗi whitespace, chỉ cảnh báo CRLF/LF. |

Smoke hai process dùng namespace Redis riêng và dọn đúng prefix; seed/cleanup theo fixture. Nó kết nối Next trực tiếp với header IP có chủ ý, chứng minh bộ đếm dùng chung, không chứng minh Traefik chống giả header.

Lượt Playwright đầy đủ cuối chạy Next production và API đã build (`dist`) trên cặp port riêng 3115/3215, `CI=1` để không dùng lại server cũ, JavaScript bật: **51 đạt, 7 bỏ qua theo viewport, 0 lỗi**, 31,3 giây. Đã đọc log `apps/client/test-results/phase08-production-dist-final.log`. Các lượt trước có lỗi kết nối/tiến trình hoặc dev tải lại được ghi trong báo cáo tester; không dùng unit/build để thay cho kết quả trình duyệt.

## Cổng hạ tầng chưa đạt

- Chưa có staging target/preflight hoàn chỉnh trong repo; không triển khai hay áp migration lên staging. M1/M2 vẫn chưa đạt.
- Cần kiểm rule chặn `/api/revalidate`, trusted forwarded headers/CDN và IP thật ở Traefik staging. Direct Next smoke không thay thế bước này.
- Chưa benchmark tải production; EXPLAIN fixture nhỏ và test concurrent Redis chỉ chứng minh thuộc tính được assert. Cần quan sát tải DB sau bỏ settings RAM và dung lượng Redis/noeviction theo cấu hình thật.
- Khi Redis ngừng hoạt động, response đọc upstream và rate limit fallback theo process; đây là chế độ giảm chức năng đã khai rõ, không phải bảo đảm rate limit toàn cụm trong outage.

Các chốt kỹ thuật còn giữ có lý do: URL length/search/page bounds bảo vệ parser/cache, timeout env cần trước khi đọc API/settings, CSP body/log cap bảo vệ endpoint report-only. Không dùng chúng để giấu nợ nghiệp vụ chưa làm.

## Kiểm lỗi phụ thuộc bổ sung

`public-cache-failures.test.ts` cô lập phụ thuộc để kiểm đường lỗi có chủ đích; không thay đổi mã runtime hoặc source client khi suite trình duyệt đang chạy. Sáu ca kiểm: Redis read lỗi vẫn fetch upstream no-store có AbortSignal timeout; cached null không gọi upstream; Redis write lỗi vẫn trả dữ liệu mới; upstream 503 không được cache; shared invalidation lỗi trả 503/Retry-After/no-store và chưa gọi revalidateTag; shared invalidation thành công mới xác nhận từng tag duy nhất. Đây là fault injection qua mock, được ghi riêng với integration Redis thật và smoke hai Next process.

Lệnh `pnpm --filter @kamito/client test public-cache-failures.test.ts` đạt 6/6; chạy tiếp toàn bộ client unit đạt 41/41 ở 8 file. Client typecheck và ESLint file fault-path mới đạt.
