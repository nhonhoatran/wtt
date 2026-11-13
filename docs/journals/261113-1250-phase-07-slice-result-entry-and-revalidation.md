# 2026-11-13 — Phase 07 lát cắt: nhập và chốt tỷ số, revalidate cache

**Date**: 2026-11-13 12:50
**Severity**: High
**Component**: apps/api (match-results, matches, revalidation), apps/worker, apps/admin (results), packages/competition-engine, packages/shared
**Status**: Ongoing (code đã commit trên main, `2bfc0d9..1c4d4fb`; chưa deploy staging)

## What Happened

Làm lát cắt phase 07: nhập và chốt tỷ số cho trận đã đủ hai bên. Chủ repo chọn chỉ làm lát cắt; lịch thi đấu, bàn, sửa và mở lại tỷ số, lưu tiến độ ván dở chuyển sang đợt 2. Không có migration. Dùng cột `Match` và bảng `Game` có sẵn từ phase 06.

Gồm: API `start` và `confirm`, validator `validateMatchScore` trong `competition-engine` (admin dùng lại để báo lỗi trước khi gửi), đẩy người thắng vào trận kế, tính lại bảng vòng bảng, revalidate cache công khai qua queue, và màn "Nhập tỷ số" trong admin.

## The Brutal Truth

Test xanh, nhưng đường đi từ admin tới trang công khai chưa thông. Client chưa có route `/api/revalidate` (theo kế hoạch thuộc phase 08). Job revalidate nhận 404, retry 5 lần rồi failed. Trang công khai chỉ cập nhật khi hết TTL. Nên nói thẳng: "đổi tỷ số là trang công khai đổi ngay" hiện chưa đúng.

Màn admin chưa ai mở trên trình duyệt. Tester chạy test, không chạy UI. Skill `ui-consistency` không chạy.

Reviewer cho 7.5/10 và bắt một lỗi nghiệp vụ thật: trận vòng bảng đã hủy (`isVoided`) vẫn start và chốt được. Lỗi này lọt qua test đơn vị vì không ai viết ca "VĐV rút khỏi bảng, rồi bấm chốt trận cũ".

## Technical Details

- Test: shared 86/86, competition-engine 209/209, api 320/320 (e2e trên Postgres local), admin 5/5, scripts 4/4, ui-tokens 3/3, worker 34/34 sau sửa.
- Worker lần đầu rớt 2 test `media-worker.test.ts`: fixture thiếu `CLIENT_INTERNAL_URL` và `REVALIDATE_SECRET`, là hai env bắt buộc mới.
- Enqueue có timeout 2 s (`apps/api/src/modules/revalidation/revalidation-enqueue.service.ts:15`), dùng `Promise.race`. Khi Redis chết, lỗi không trả ngay mà chờ đủ 2 s rồi mới trả `PUBLIC_REFRESH_DELAYED`. Thao tác đã commit nên không hỏng, nhưng mỗi lần chốt tỷ số bị trễ thêm 2 s.
- Mỗi job có `jobId` riêng (`reval-<uuid>`), không cố định.
- Lỗi có sẵn, không do lát cắt này: `apps/api/test/draws.e2e-spec.ts:325` đoán hạt RNG `${randomSeed}:qualifiers`, còn `draw-edit.service.ts:78` dùng `randomBytes(16)`. Test đậu rớt ngẫu nhiên. Có từ commit `2013e67`.

## What We Tried

- Chặn trận `isVoided` trong `assertReady` và `isReadyForResult`, bỏ khỏi danh sách, thêm e2e. Sau sửa, `match-results.e2e-spec.ts` 11/11.
- Lọc từng tag khi enqueue. Trước đó một tag sai làm rớt cả lô.
- Chặn `winBy = 1`: trước đó 22–21 vẫn được nhận. Thêm test.

## Root Cause Analysis

- Test được viết theo luồng chính và các lỗi đã nghĩ tới. Ca vòng đời (VĐV rút rồi chốt trận cũ) không có test trước khi review.
- Thêm env bắt buộc mới mà không cập nhật fixture của worker, nên test worker rớt.
- Revalidate phụ thuộc hai đầu (API/worker và client). Đầu client bị đẩy sang phase 08, nên chuỗi chưa chạy đầu cuối lần nào.

## Lessons Learned

- Mỗi luật vòng đời cần một e2e nhiều bước. Lỗi này lặp lại đúng bài học đã ghi ở phase 06.
- Khi thêm env bắt buộc, cập nhật fixture trong cùng commit.
- Đừng gọi tính năng là "xong" khi một đầu của chuỗi chưa tồn tại. Ghi "chưa end-to-end" ngay trong tài liệu phase.
- Timeout 2 s và các hằng vận hành khác đang viết cứng. Theo quy tắc repo, nên chuyển thành setting trên `/settings`.
- `docs/match-results.md` ghi "code chưa commit", nhưng git log cho thấy 5 commit đã có trên main. Tài liệu đang lệch thực tế.

## Next Steps

1. Chốt: route `/api/revalidate` giữ ở phase 08 hay kéo lên lát cắt. Owner: chủ repo.
2. Mở màn "Nhập tỷ số" trên trình duyệt, thử ở 1024 px. Owner: chưa phân công.
3. Viết e2e còn thiếu: hai trận cùng bảng chốt đồng thời, cascade walkover khi đẩy nhánh, RETIRED có ván dở, RESULTS_OPERATOR bị 403 khi reopen. Owner: chưa phân công.
4. Sửa `draws.e2e-spec.ts:325` (test đoán seed). Owner: chưa phân công.
5. Cập nhật dòng trạng thái trong `docs/match-results.md`. Owner: chưa phân công.
6. Chuyển timeout enqueue, số lần thử, backoff và page size thành setting. Owner: chưa phân công.
7. Deploy staging sau khi phase 08 xong. Owner: chủ repo.

## Status

- Code: đã commit trên main, chưa deploy staging.
- Test: pass toàn bộ, trừ `draws.e2e-spec.ts:325` là lỗi có sẵn, đậu rớt ngẫu nhiên.
- Revalidate: không end-to-end cho tới khi có route client.

**Status:** Ongoing
