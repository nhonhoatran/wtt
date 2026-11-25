# Báo cáo phase A5 — tab "Nội dung thi đấu" (2026-11-25)

## Đã làm
API (chỉ thêm trường, không schema/migration, không route mới):
- `sub-events/sub-event-items.ts`: `SUB_EVENT_INCLUDE.matchFormat` thêm `bestOf, pointsPerGame, winBy`.
- `entries/entries-query.service.ts`: `entry-counts` thêm `seeded` (CONFIRMED, `seed != null`; thêm 1 `groupBy` trong cùng `Promise.all`).
- e2e: `entries.e2e-spec.ts` (seeded khớp đếm trực tiếp từng nội dung, MS > 0), `sub-events.e2e-spec.ts` (3 trường format trận).

Admin (`apps/admin/src/pages/event-hub/`):
- `sub-event-labels.ts`: type `matchFormat` + `matchFormatSummary()` (dựng từ số, "N ván, ván X điểm, cách biệt Y") + `entryUnit()` (VĐV/cặp theo `competitorKind`).
- `entry-labels.ts`: `EntryCount.seeded`.
- `sub-event-columns.tsx` (mới): Nội dung (+ Tag mã, dòng phụ Luật vòng bảng / BXH) · Thể thức (+ "Có vòng loại") · Thể thức trận (+ tóm tắt) · Số VĐV/cặp (`confirmed / maxEntries`, link tab Danh sách `?subEvent=`) · Hạt giống · Bốc thăm (Tag `OVERALL_*`, link tab Bốc thăm `?subEvent=`) · Thao tác (Sửa / Xóa, giữ khóa khi đã công bố).
- `sub-events-tab.tsx`: Card "N nội dung thi đấu", nút "Thêm nội dung" (outline khi có dữ liệu, primary khi rỗng), ghi chú cuối bảng; thêm 2 query dùng chung key (`entryCountsKey`, `drawsOverviewKey`). Sau thêm/sửa/xóa: refetch + invalidate 2 key trên + `onChanged()` (làm mới progress/stepper).
- Test mới `test/sub-event-labels.test.mjs` (2 test).
- Không đưa mô tả "8 bảng × 4 VĐV..." vào cột Thể thức: overview bốc thăm không có tham số (chỉ có ở preview/draw chi tiết), tránh thêm request.
- Đã đánh dấu todo/trạng thái trong `phase-A5-*.md`.

## Kiểm tra (chạy thật)
- admin: `pnpm typecheck` sạch, `pnpm lint` sạch, `pnpm test` 56/56 (có 2 test mới), `pnpm build` OK (chỉ cảnh báo chunk > 500 kB có sẵn).
- api: `tsc --noEmit` sạch; eslint 4 file đã sửa sạch.
- api e2e qua wrapper (dòng đầu `localhost:5433/kamito_tt_phase12_test`), từng file: `entries.e2e-spec.ts` 19/19, `sub-events.e2e-spec.ts` 8/8.
- Trình duyệt (`scratchpad/check-a5-sub-events.mjs`, ảnh `scratchpad/a5/`), 1280 + 390, một context đăng nhập:
  - Rỗng: nút "Thêm nội dung" là primary. Tạo 5 nội dung qua modal UI ("Chọn tất cả").
  - Dữ liệu thật trên TEST DB: nội dung MS có 4 đăng ký, 2 hạt giống; cột hiện 4 và 2, khớp số dòng `seed != null` ở tab Danh sách (API: 2).
  - Link: Số VĐV -> `/events/<id>/entries?subEvent=<id>`; Tag Bốc thăm -> `/events/<id>/draws?subEvent=<id>`.
  - Mỗi lần mở tab: đúng 3 GET dữ liệu (sub-events, entry-counts, draws).
  - Overflow ngang 0 ở 1280 và 390. Stepper cập nhật theo dữ liệu thật (4 lượt đăng ký, "1/5 nội dung đủ VĐV"). Xóa nội dung qua UI: số trong Card giảm, progress được gọi lại (4 lần gọi trong lúc xóa + tải lại).
  - Console: không warning/error của app. Còn 2 dòng không do A5: `Warning: There may be circular references` đến từ `/@vite/client` (HMR khi các phase song song sửa file), và 409 do script thử xóa nội dung đã có đăng ký (dự kiến).

## Nói thẳng về giới hạn
- API :3000 chạy code cũ (thiếu `seeded`, format trận). Em KHÔNG sửa :3000; thay vào đó chạy thêm 1 API code mới trên cổng 3010 (cùng TEST DB, qua wrapper, prefix queue riêng) và Playwright `route` chuyển `/api/v1/**` từ 5173 sang 3010. Tức trình duyệt dùng API mới ở :3010, không phải :3000. Đã tắt 3010 sau khi kiểm. Có restart 3010 một lần vì một phase khác sửa `auth.service.ts` (identity thêm `siteName`) làm sider vỡ trên bản cũ.
- Dữ liệu để lại trên TEST DB (event debts): 5 nội dung (MS, WS, MD, WD, XD), 4 VĐV "A5 check ..." + 4 đăng ký MS (2 hạt giống), cộng thêm vài VĐV "A5 check" mồ côi từ các lần chạy script lỗi giữa chừng (mỗi lần lỗi tạo thêm 4 VĐV; đăng ký thất bại do gửi 4 id một lần, giới hạn 2/lần). Không đụng DB dev.
- Chưa kiểm: tài khoản không có quyền sửa/xóa (cột Thao tác ẩn) trên trình duyệt; trạng thái giải đã công bố (nút Xóa bị khóa) chỉ giữ nguyên logic cũ, không chụp.
- Cột Thể thức trận lặp chữ khi tên format trận trùng tóm tắt (dữ liệu seed đặt tên "5 ván, 11 điểm, cách 2"); là do tên dữ liệu, không sửa.
- Không commit; không đụng file của A10/C3.

## Câu hỏi mở
- Có muốn dọn VĐV/nội dung test "A5 check" trên TEST DB không?

**Status:** DONE_WITH_CONCERNS
**Summary:** A5 xong: API thêm `seeded` + 3 trường format trận (e2e xanh), tab Nội dung thi đấu theo Figma 1-8, link sang Danh sách/Bốc thăm, làm mới stepper; typecheck/lint/test/build xanh.
**Concerns:** Trình duyệt dùng API mới ở :3010 (route từ 5173), không phải :3000 cũ; để lại dữ liệu test "A5 check" trên TEST DB.
