# Phase 07 lát cắt — review + test (2026-11-13)

## Test (tester)
- typecheck, lint, build: pass toàn repo (admin chunk > 500 kB chỉ là cảnh báo).
- ui-tokens 3/3, shared 86/86, competition-engine 209/209, api 320/320 (e2e trên Postgres/Redis local `localhost:5433/kamito_tt_dev`, đã xác nhận trước khi chạy), admin 5/5, scripts 4/4.
- worker lần đầu rớt 2 test `media-worker.test.ts` (fixture thiếu `CLIENT_INTERNAL_URL`, `REVALIDATE_SECRET`) → đã sửa fixture, 34/34.
- Sau sửa review: `match-results.e2e-spec.ts` 11/11 + revalidation unit 3/3 pass.

## Review (code-reviewer): 7.5/10, 0 Critical
Đã sửa:
- H2 trận vòng bảng `isVoided` vẫn start/chốt được → chặn trong `assertReady`, `isReadyForResult`, bỏ khỏi danh sách; thêm e2e.
- M4 drawer mất tỷ số đang gõ sau "Bắt đầu" (key theo version) → key theo `match.id`.
- M5 lỗi từ modal "Không đến / Bỏ cuộc" bị che → đóng modal khi gửi, lỗi hiện ở drawer; modal mount lại nên reset state (L14).
- M6 một tag sai làm rớt cả lô → lọc từng tag, vẫn trả cảnh báo.
- M3 comment `cache-tags.ts` nhắc test phủ chưa có → sửa comment; test phủ thuộc phần còn lại phase 07.
- L7 `winBy = 1` nhận 22–21 → chặn, thêm test.

Chưa sửa (ghi nợ):
- H1 client chưa có route `/api/revalidate` → theo plan thuộc phase 08; tới lúc đó job revalidate nhận 404, retry 5 lần rồi fail, trang công khai cập nhật theo TTL.
- Mutation draw sau công bố (place qualifiers/group qualifiers, unpublish, withdraw) chưa revalidate → khi làm test phủ cache-tags.
- L8 thể thức: `confirm` dùng round ?? draw ?? subEvent, `GroupStandingsService.compute` bỏ qua round.
- L10 `settleDeferredWalkover` không tăng `version` trận được điền (có từ phase 06).
- L11 `new URL('/api/revalidate', base)` bỏ path con của `CLIENT_INTERNAL_URL`.
- L12 hằng vận hành fix cứng: timeout enqueue 2 s, attempts 5 / backoff 2 s (plan đã chốt), page size picker 100, debounce tìm kiếm.
- L13 picker giải lấy tối đa 100 giải, lọc phía client.
- L15 tag còn thiếu: `match.start` không có tag VĐV; VĐV thua walkover trong chuỗi cascade; `draw.publish` không có tag `match-*`.
- e2e còn thiếu: chốt đồng thời 2 trận cùng bảng, cascade walkover khi đẩy nhánh, RETIRED có ván dở, RESULTS_OPERATOR bị 403 khi reopen.

## Lỗi có sẵn phát hiện thêm
- `apps/api/test/draws.e2e-spec.ts:325` đậu/rớt ngẫu nhiên: test đoán hạt `${randomSeed}:qualifiers`, service dùng `randomBytes(16)` (`draw-edit.service.ts:78`). Có từ commit `2013e67`, không do lát cắt này.

## Câu hỏi chưa giải quyết
- Route `/api/revalidate` của client: giữ ở phase 08 hay kéo vào lát cắt này?
- UI "Nhập tỷ số" chưa chạy trên trình duyệt, chưa thử ở 1024 px; chưa chạy `ui-consistency:finding-patterns`/`verifying` (agent làm UI không có công cụ skill, chỉ đọc code tay để theo mẫu sẵn có).
