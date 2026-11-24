# Thực thi tiếp với dịch vụ thật — 2026-11-20

## Phạm vi và ủy quyền

Tiếp nối báo cáo `execution-261120-phases-08-12.md`. Yêu cầu tiếp tục sau đề nghị target được hiểu là cho phép chạy kiểm tích hợp trên **`localhost:5433/kamito_tt_phase12_test`**. Chỉ đổi pathname từ cấu hình hoạt động trong môi trường process; không sửa `.env`, không migrate/seed/query dữ liệu DB dev.

## Kế hoạch đã rà

1. Bật lại PostgreSQL/Redis bằng compose hiện có, giữ volume; kiểm đúng target, migration status và seed danh mục riêng trên DB test. Nếu có migration thiếu, sao lưu test DB trước khi áp.
2. Agent `phase1112` giữ DB độc quyền: publishing → CMS/security API → public/rankings API. Sửa nguyên nhân thật của ca lỗi; không mock DB/queue.
3. Trong lúc đó agent `phase08` chuẩn bị runner public production và axe; agent `phase0910` rà gói vertical slice thiếu và review độc lập.
4. Sau khi API dọn fixture và nhường DB, chạy public E2E/CMS/home/contact/axe; giữ world và server cho Lighthouse bốn trang chính.
5. Chạy Lighthouse mobile local đúng ngưỡng kế hoạch và smoke 5 request/giây trong 120 giây bằng image k6 đã có; chỉ sửa vấn đề có bằng chứng, rồi kiểm lại phần ảnh hưởng. Local không thay staging.
6. Review, cập nhật docs và sweep đủ 12 phase theo kết quả thật; giữ các cổng quy chế, consent, CSP/staging/rollback chưa đạt.

## Kết quả

| Nhóm | Kết quả hiện tại |
|---|---|
| Setup | PostgreSQL/Redis compose hiện có healthy; target test xác nhận. Đủ 18 migration, không cần migrate thêm; seed danh mục test đạt; hash `.env` không đổi |
| API | 21 spec / 132 ca duy nhất đạt: publishing 5, CMS/security 32, public/ranking 95. Teardown 21 spec cuối đạt; TypeScript/lint phần sửa đạt |
| Browser/axe | `full-03` sau sửa accessibility, trước metadata: 96 đạt/8 skip/0 lỗi/0 flaky. Build metadata cuối: 83 unit đạt, typecheck/lint/build đạt; browser focused 27 đạt/5 skip/0 lỗi/0 flaky trong 32 ca. Axe quét lại 36 scan có 0 violation ở mọi mức được phát hiện, giữ incomplete. Không cộng hai lượt thành tổng duy nhất |
| Lighthouse | `r02` sau sửa metadata: 4/4 đạt, exit 0. Performance home/event/draw/BXH = 100/99/100/100; Accessibility và SEO đều 100. Mobile simulate, giữ ngưỡng 85/90/95. `r01` fail SEO92 và native crash ranking giữ nguyên làm baseline, không gọi là đã sửa nguyên nhân Windows |
| Smoke tải local | Exit 0, cấu hình 5 arrivals/giây ×120 giây; 600 requests/600 iterations, 600 checks HTTP 200 đạt; 0 failed/5xx/dropped, mọi threshold đạt. P95 14,125 ms; p99 30,986 ms; max 79,964 ms. Raw aggregate 4,659093 request/giây, wrapper 131.997 ms; không đổi raw rate thành 5. `.env` không đổi, container riêng đã tự xóa |
| Vertical slice | 1/1 đạt: tạo giải/nội dung/bốn entry và công bố bằng ADMIN API, RESULTS_OPERATOR chốt; BullMQ processor thật làm SSR nhánh/trận đổi sau 133 ms, cache trước chốt còn 29.978/29.947 ms; job hoàn tất +1. Cleanup cuối event/player/cache/UUID queues/auth TTL keys đều 0; `.env` không đổi |

Một lượt API chạy gộp gặp native Windows crash `0xC0000409`, giữ nguyên log lỗi. Các spec cuối chạy từng process riêng, không sửa assertion hoặc giả dịch vụ. Chưa chứng minh được cleanup toàn bộ phần fixture dở của lượt crash; không xóa row/queue không xác định chủ sở hữu.

Hai spec legacy ghi đè hai JSON generated/ignored cũ trước khi phát hiện; không tuyên bố đã khôi phục bản cũ. Raw Vitest logs/JSON lịch sử vẫn giữ nguyên. Đã bổ sung `API_TEST_ARTIFACT_DIR` và chạy lại hai spec với thư mục mới để các lượt sau không lặp việc này. Các artifact khác dùng nhãn riêng `261120-real`.

Browser trước sửa accessibility (`full-02`) và sau sửa (`full-03`) là hai lượt độc lập, không cộng thành 192 ca duy nhất. World/probe/log của `full-02` được sao chép vào artifact retained của chính lượt đó trước khi cleanup; world cũ dọn đúng fixture 1/1 đạt, rồi build lại và tạo world mới. Publish BXH qua admin/BullMQ/SSR ở lượt cuối đạt 209 ms desktop và 218 ms mobile (giới hạn riêng của probe đó 10 giây), không lấy thời gian này thay cho kiểm chốt tỷ số 5 giây.

## Những lỗi sản phẩm đã sửa theo bằng chứng

- Axe baseline có 16 serious rule-occurrence: nhãn nút phát thiếu tương phản và `aria-label` bị cấm trên generic span của thay đổi thứ hạng. Dùng token nền đậm sẵn có; chuyển nhãn đọc sang text ẩn trực quan cạnh glyph `aria-hidden`. Gate mới chặn cả critical và serious, không tắt rule hoặc loại node.
- Lighthouse phát hiện home/event/draw thiếu meta description khi summary trống. Thêm copy/template trong dictionary vi/en, ưu tiên summary quản trị đã nhập, chỉ fallback khi null/rỗng/whitespace; giữ canonical/hreflang và nội dung hợp lệ nguyên vẹn. Regression trước sửa: 7 unit fail/5 pass và hai browser fail; sau sửa toàn client 83/83, browser focused 27/5 đạt, Lighthouse 4/4 đạt.
- CLI Lighthouse nay ghi exit/signal khi native process không phát stderr/stdout. Đây là sửa độ rõ của log, không che crash hoặc đổi ngưỡng nghiệm thu.

## Tình trạng bàn giao

API, browser/axe, probe dọc, sửa metadata, Lighthouse và smoke local đều có artifact thật. Agent review đã đọc chéo source/JSON trong phạm vi thay đổi; docs-manager và PM đồng bộ theo số đo cuối. Sweep đủ 12 phase vẫn **134/163 checkbox, 82,2 %, 29 mở**: các cổng G1/G2, staging/M1/M2, consent, CSP enforce, full E2E tám bước, toàn bộ ma trận CMS/admin/storage và rollback/restore không được đóng bằng kết quả local.

Cleanup hiện hành đã đạt **1/1** sau k6. Kiểm trước/sau theo đúng IDs của retained world: ba event, sáu sub-event, 73 player, sáu draw, 72 entry, hai ranking list, bốn snapshot và rule/venue/tier/type riêng đã về **0**; ranking points thuộc fixture cũng 0. Root đọc `exact-fixtures-after.json` và `outcome.json` tại `apps/client/test-results/261120-real-public-and-axe/cleanup-20261120-final-01/`. Đã backup world/probe/log/PID metadata trước cleanup, xóa world active, retire server metadata; dừng đúng API 10388/client 23360 theo identity, hai cổng 3313/3314 không còn listener. `.env` khớp hash đầu lượt, giữ PostgreSQL/Redis shared. Không khẳng định đã dọn các fixture chưa xác định của lượt native crash API trước đó.

Kiểm cuối của điều phối: đếm lại đủ 12 phase đúng 134/163; kiểm liên kết file Markdown trong tập thay đổi không có target thiếu; rà cụm xưng hô riêng tư không có match; `git diff --check` exit 0, chỉ có warning chuẩn hóa CRLF. So hash `.env` khớp đầu lượt; không có schema/migration Prisma thay đổi. Hai cổng test được kiểm đọc độc lập và không có listener. Không commit/push; tài liệu `.docx` untracked có sẵn được giữ ngoài phạm vi.

## Báo cáo liên quan

- [API thật 132 ca](./tester-261120-real-api.md)
- [Public browser, axe và regression metadata](./tester-261120-real-public-and-axe.md)
- [Lát cắt API admin/operator → BullMQ → SSR](./tester-261120-local-vertical-slice.md)
- [Lighthouse mobile bốn trang](./tester-261120-real-lighthouse.md)
- [Smoke tải nhẹ local](./tester-261120-real-smoke.md)
- [Review độc lập](./code-reviewer-261120-real-services.md)
- [PM sweep đủ 12 phase](../../reports/pm-261120-real-services-sync.md)
