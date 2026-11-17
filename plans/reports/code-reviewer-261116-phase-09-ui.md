# Code review — Phase 09 UI (admin Xếp hạng) + API nhỏ — 2026-11-16

Phạm vi: diff chưa commit (23 file sửa + 26 file mới admin/shared). Chỉ đọc code, không chạy server/DB. Typecheck/lint/e2e đã xanh theo `tester-261116-phase-09-ui-and-api-changes.md`.

**Điểm: 7.5/10** — cấu trúc gọn, scope sửa ma trận đúng, step-up/permission đúng, API thay đổi an toàn. Trừ điểm vì câu ảnh hưởng khi lưu quy tắc sai với ngày quá khứ, và vài chỗ dính `placeholderData: keepPreviousData` mặc định toàn cục của Refine.

## Critical
Không có.

## High

**H1. Lưu quy tắc với ngày áp dụng trong quá khứ: câu xác nhận sai + mốc so sánh lệch**
`ranking-rules-save-modal.tsx:95-104` (DatePicker không có `disabledDate`), `:108` (câu Alert), API `ranking-rules-impact.ts:17`.
- API tính lại mọi nội dung có `event.endDate >= effectiveFrom`, kể cả giải **đã kết thúc**; rule được chọn theo `effectiveFrom <= endDate`. Chọn ngày quá khứ thì giải đã xong sau ngày đó bị tính lại điểm, trong khi modal ghi "giải đã kết thúc giữ nguyên".
- Lưới luôn so với giá trị **hôm nay** (`use-ranking-rules-matrix.ts:73`, `setCell` bỏ edit khi `points === original`), nhưng lưu dưới ngày khác. (a) Ngày trước phiên bản hiện hành: lưu xong không thấy đổi gì (phiên bản sau đè lên). (b) Ngày trùng một phiên bản tương lai: ô sửa về đúng giá trị hôm nay bị bỏ im lặng, dù ở ngày đó giá trị khác.
- Cách sửa: chặn ngày < hôm nay (`disabledDate`) nếu không chủ đích hồi tố; nếu có chủ đích thì đổi câu khi `effectiveIso < today` ("… kể cả giải đã kết thúc từ ngày này") và cảnh báo khi `effectiveIso` < phiên bản mới nhất ≤ hôm nay hoặc trùng phiên bản tương lai. Đúng chuẩn hơn: lấy ma trận `asOf=effectiveIso` làm mốc so sánh khi người dùng đổi ngày.

## Medium

**M1. Ô chỉ đọc vẫn đổi được bằng phím mũi tên / nút tăng giảm** — `ranking-rules-grid.tsx:44-50`. Theo source `rc-input-number@9.5.0` (`onInternalStep` và `onKeyDown` không xét `readOnly`), ArrowUp/Down hoặc nút step vẫn gọi `onChange`. Hệ quả: xem phiên bản cũ/tương lai, hoặc lúc `stale`, vẫn tạo edit. Không lưu nhầm được (nút Lưu ẩn khi readOnly, bị tắt khi stale), nhưng guard sẽ hỏi lại vô cớ. Riêng lúc `stale`, edit rơi vào scope mới với mốc `original` của dữ liệu cũ. Sửa: `onChange={readOnly ? undefined : …}` hoặc `disabled` (chưa kiểm trên trình duyệt).

**M2. `useCatalogRows` có filter nhận dữ liệu cũ khi đổi filter** — `use-catalog-options.ts:45-58` + mặc định của Refine (`placeholderData: keepPreviousData`, `@refinedev/core` QueryClient). Trong `sub-event-ranking-field.tsx:22-33`, lúc đổi loại từ SINGLES sang DOUBLES, `rows` tạm thời vẫn là danh sách **đơn**. Bulk `autoFill` có thể gợi ý hoặc giữ list sai loại. Bấm Tạo trong khoảng đó thì nhận 422 "không cùng loại" (API chặn, không hỏng dữ liệu). Khi dữ liệu thật về, ô bị xóa và vì `return` sớm nên không tự gợi ý lại. Sửa: bỏ qua khi `lists.isPlaceholderData` (hoặc `placeholderData: undefined` cho query có filter), và sau khi xóa thì đi tiếp nhánh gợi ý.

**M3. Trang xem trước kỳ chốt hiện dữ liệu kỳ cũ sau khi dựng lại** — `snapshot-preview-page.tsx:31-44`. Cùng route nên component không remount. Theo mặc định toàn cục, `snapshotKey(B)` hiện placeholder của A (A đã bị worker xóa, `write-snapshot-rows.ts:14`): title/nút Công bố trỏ `snapshot.id = A`, bấm thì nhận 404. Ngoài ra `jobs` không reset nên Alert "chưa tính lại" của B bị ẩn. Sửa: `placeholderData: undefined` cho query này, `setJobs([])` khi `id` đổi (hoặc `key={id}` ở route).

**M4. "Gợi ý theo BXH" bật cả ở wizard vòng loại** — `draw-seeds-step.tsx:43-47`. API chỉ gán hạt giống cho entry `stage === 'MAIN'` (`draw-seed-suggestion.service.ts`), trong khi bảng ở bước này lọc `QUALIFYING`. Người dùng áp dụng xong không thấy hạt giống nào đổi, và nhánh chính bị ghi đè ngầm. Sửa: chỉ bật khi `kind !== 'QUALIFYING'`, hoặc ghi rõ trong modal là áp cho nhánh chính.

**M5. Nhãn phụ thuộc khi xóa bảng XH hiện key thô** — `components/confirm-action-button.tsx:6-13` thiếu `pointsEarned`, `snapshots` (`ranking-lists.service.ts` `usage()`). Người dùng sẽ thấy "3 pointsEarned". Sửa: thêm `pointsEarned: 'dòng điểm'`, `snapshots: 'kỳ chốt'`.

**M6. "Hôm nay" lệch múi giờ giữa admin và API** — API dùng `todayIso()` theo UTC (`iso-date-field.ts:16`); admin dùng `dayjs()` local. Từ 00:00 đến 07:00 giờ VN, "Hiện hành" (`asOf` rỗng) là ngày hôm qua theo UTC, nên phiên bản vừa lưu "từ hôm nay" chưa hiện ra. Tag "Hết hạn" (`ranking-points-page.tsx:31`) và filter `active` cũng lệch một ngày. Sửa nhanh phía UI: luôn gửi `filter[asOf]=dayjs().format(DATE_ONLY_FORMAT)` cho chế độ hiện hành. Về lâu dài nên tính "hôm nay" theo múi giờ nghiệp vụ.

**M7. "Tính lại ngay" không có trạng thái đang gửi** — `snapshot-preview-page.tsx:62-74,140`. Bấm 2 lần sẽ tạo 2 job cùng (list, asOf); job xong sau xóa draft của job xong trước. Tracker theo job của response cuối nên có thể điều hướng tới id đã bị xóa (404). Sửa: thêm state `loading` và disable nút.

## Low
- L1 `ranking-rules-unsaved-guard.ts:21-36` không bọc `navigator.replace` (redirect kiểu replace sẽ đi qua mà không hỏi). Back/forward trình duyệt làm mất edit im lặng (đã ghi trong comment).
- L2 Xóa trắng một ô đã sửa thì ô nhảy về giá trị gốc ngay lúc đang gõ (`setCell(null)` xóa edit, `value` đổi nên rc-input-number đồng bộ lại). Không xóa được rule, nên thêm gợi ý.
- L3 `copyColumn` bỏ qua ô nguồn trống, nên cột đích không giống hẳn cột nguồn (`use-ranking-rules-matrix.ts:89-97`).
- L4 Trang ma trận không xét `rankings.update` cho nút Lưu (hiện ADMIN có mọi quyền nên chưa lộ).
- L5 `snapshot-list-options.ts` lặp lại `'catalog-rows'`, `FALLBACK_PAGE_SIZE` và vòng phân trang của `useCatalogRows`. Nên mở rộng `useCatalogRows` (vd `includeHidden`). `NOTE_MAX_LENGTH = 500` (`ranking-rules-save-modal.tsx:11`) trùng `max(500)` ở API, chưa đưa vào shared như `RANKING_REASON_*`.
- L6 Công bố lỗi 409 `RANKING_SNAPSHOT_STALE` không refetch, nên số "chưa tính lại" và nút Công bố vẫn hiển thị số cũ.
- L7 Bảng XH: gõ số vào "Thời hạn điểm" rồi xóa thì gửi `validityDays: null`, zod `.optional()` trả 422 (`ranking-list-dtos.ts:15`).
- L8 `RankingSnapshotsQueryService.rows()` gọi `get()` (đếm dirty + tra publisher) ở mỗi trang/lần tìm. Chỉ cần kiểm tra tồn tại.
- L9 `catalog-crud.ts` `remove()` vẫn đọc `existing` không có include, nên audit xóa (venue `tableCount`, ranking-list `category`) không đồng nhất với update.
- L10 Impact query dùng placeholder của ngày trước, nên trong lúc tải câu Alert hiện ngày mới với số cũ (`ranking-rules-save-modal.tsx:52-57`).

## API (mục 5) — ổn
- `catalog-crud.ts:115` load `existing` có include: `prepare()` của event-types không dùng `existing`; ranking-lists chỉ đọc scalar (`competitorKind`, `validityDays`, `groupStageByRank`, `id`). `publicTags` vẫn lấy từ `refreshed()` không include nên không ảnh hưởng. Ngoài ra còn sửa luôn lỗi cũ: audit `before` của venue trước đây có `tableCount: 0`.
- `publishersOf` gộp 1 query, xử lý được user đã bị xóa. `subEvent`, `rankingList`, `discipline.competitorKind/genderRule` chỉ có ở endpoint admin, không lộ dữ liệu ra ngoài.
- `assertRankingListFits` chỉ chạy khi `rankingListId` đổi (`sub-events.service.ts:115`), nên sửa sub-event đang gắn list đã ẩn vẫn lưu được (khớp với `current` trong field).

## Đã kiểm, đúng
- Edit ma trận gắn với scope `kind|draw|asOf`; Lưu bị tắt khi `stale`, ẩn khi readOnly; `cells.N` map đúng ô. Không thấy đường nào lưu nhầm (kind, draw).
- Guard khôi phục `push`/`go` và gỡ `beforeunload` khi cleanup. `UnsavedChangesNotifier` của Refine không được mount nên không bọc chồng.
- Công bố: confirm, rồi `runStepUp`, nút tắt khi dirty, API chặn lại lần nữa (`RANKING_SNAPSHOT_STALE`). POST/DELETE điểm thủ công có step-up ở API, UI đi qua `useStepUp`.
- Lý do: UI và API cùng dùng `RANKING_REASON_*`. `expiresAt > earnedAt` khớp hai phía.
- `useCatalogAccess(permission = 'tournaments')`: 7 catalog cũ gọi không tham số nên giữ nguyên hành vi.
- `useCatalogRows`: 2 caller cũ (disciplines, snapshot draft) chỉ thêm `{}` vào key, invalidation theo prefix vẫn đúng.
- Sửa sub-event: xóa chọn thì gửi `null`, không tự điền (chỉ gợi ý + nút "Dùng"). `suggest-seeds` chỉ chạy khi mở modal hoặc bấm Áp dụng. `refetchOnWindowFocus` mặc định false (Refine), chỉ còn `refetchOnReconnect` có thể gọi lại `apply:false` lúc modal đang mở (ghi `rankingAtEntry/pointsAtEntry`, idempotent).
- Polling job dừng khi xong/lỗi, unmount thì dừng. Job ID là UUID nên không dính cache cũ.
- Rows kỳ chốt phân trang, tìm, sắp xếp ở server. Mọi file < 200 dòng. Không có chuỗi xưng hô riêng tư. Comment ít.

## Câu hỏi còn mở
1. Hồi tố quy tắc (ngày áp dụng < hôm nay) có được phép không? Câu trả lời quyết định cách sửa H1.
2. Có cho phép "Ngày chốt" kỳ chốt và "Ngày đạt điểm" thủ công ở tương lai không? Hiện cả UI lẫn API đều không chặn.
