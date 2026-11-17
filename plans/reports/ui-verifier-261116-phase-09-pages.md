# UI verifier — phase 09, các trang admin Xếp hạng + hub (2026-11-16)

Skill: `ui-consistency:verifying`. Checker độc lập (không viết các trang này). Read-only: không sửa file dự án, không đổi git state, không đọc `.env`.
So với: `ui/phase-09-ui-checklists.md` (A–F + "Chữ người dùng đọc"), bound `apps/admin/src`, code thắng khi lệch snapshot. Calibration đã qua cho catalog list / list / modal; **ma trận (B) và trang xem trước kỳ chốt (D) chưa được hiệu chỉnh** — kết quả ở 2 trang đó tin ở mức thấp hơn.
Không báo các lệch đã duyệt (guard tự viết, "Tính lại ngay" dựng lại nháp, nút gợi ý chỉ tắt khi không có bảng, `onSaved` trên CatalogCreate/EditPage) — chỉ ghi khi cách làm có điểm chưa hợp lý. Bỏ qua "bởi <tên>" (publishedBy).

Mức: **TB** = trung bình (lệch family / có thể làm người dùng hiểu sai), **Thấp** = nhỏ, sửa khi tiện.

## Task 1–2 — Bảng xếp hạng (catalog list + form)

| Mức | Vị trí | Dòng checklist | Khác biệt / family làm gì |
|---|---|---|---|
| Thấp | `resources/ranking-lists/ranking-list-list.tsx:23,32`, `ranking-list-form.tsx:38` | Chữ: một tên cho một thứ; nhãn Đơn/Đôi lấy của `disciplines` | Cột + field ghi "Loại", placeholder "Đơn hoặc đôi". Màn duy nhất khác có field này (`discipline-list.tsx:30,39`, `discipline-form.tsx:38`) ghi "Đơn / đôi" (cột + placeholder) và "Đơn hay đôi" (field). Checklist ghi "cột Loại" → cần chốt một tên. |
| Thấp | `ranking-list-list.tsx:36` | Chữ: một tên cho một thứ | Cột "Nhóm tuổi"; chính form (`ranking-list-form.tsx:44`), menu (`menu-groups.ts:60`), `catalog-routes.tsx:31`, `bulk-sub-event-modal.tsx:130` đều ghi "Nhóm tuổi / trình độ". |

Đúng checklist: mở rộng `useCatalogAccess(permission = 'tournaments')` / `CatalogRowActions.permission` giữ mặc định cũ, `actionsColumn` truyền xuống qua spread (`catalog-table.tsx:65`); nhãn re-export từ `discipline-form` (không bản thứ hai); thời hạn để trống → API lấy setting `ranking.defaultValidityDays` (`ranking-lists.service.ts:60`), không chôn 365; khóa đổi Đơn/Đôi: API không báo "đang dùng" khi GET, chỉ trả field error khi lưu (`ranking-lists.service.ts:69`) → hợp với "chỉ khi API có". `onSaved` dùng hợp lý (gọi `showWarnings`).
Ngoài UI: `catalog-form-pages.tsx:22,50` xuống dòng lạ giữa object `useForm({ resource, action: 'create',` — chỉ là format.

## Task 3 — Khung nhóm Xếp hạng

Không thấy khác biệt. `ranking-routes.tsx`, `app.tsx` là route table — **không phải loại trang**, không đo như trang. Tên menu 4 mục khớp `menu-groups.ts:45-48` và `meta.label`; quyền `rankings` (action `show`/`edit` được `access-control-provider.ts` map sang `read`/`update`, giống `catalog-routes`).

## Task 4 — Sổ điểm (list + 2 modal)

| Mức | Vị trí | Dòng checklist | Khác biệt / family làm gì |
|---|---|---|---|
| TB | `pages/ranking/ranking-points-page.tsx:71-80` | Bảng — `useTable` như list family | Bọc `Table` bằng `Skeleton active` khi tải và `Result status="error"` khi lỗi. 0/13 trang `List`+`useTable` dùng Skeleton (chúng để `Table` tự hiện loading); `Result` trong list chỉ có `entry-table.tsx` (1). Lần tải đầu mất cả bảng + phân trang. |
| TB | `manual-points-form.tsx:128,131`; `ranking-points-delete-modal.tsx:13,68` | Lý do bắt buộc (family modal) | Độ dài lý do viết cứng `min: 3`, `maxLength={500}`, `MIN_REASON_LENGTH = 3` (API cũng literal: `ranking-points` DTO dòng 4). 5/5 modal lý do của family lấy từ `@kamito/shared` (`DRAW_REASON_MIN/MAX_LENGTH`, `MATCH_REASON_MIN/MAX_LENGTH`). Nên thêm hằng số ranking vào shared, dùng chung admin + API. |
| Thấp | `ranking-points-delete-modal.tsx:41,49-71` | Family modal | (a) Không có `width={640}` — 5/5 modal lý do đặt 640. (b) Gõ lý do ngắn chỉ thấy nút OK tắt, không có help "Lý do tối thiểu N ký tự" — 4/4 (`draw-entry-action:152`, `manual-tiebreak:106`, `amend-scores:76`, `reopen-preview:120`) có. (c) Lỗi API không phải lỗi lý do (vd 409) hiện dưới ô lý do, family hiện `Alert type="error"` ở đầu modal (4/4). (d) `<p>` trần — chỉ 1 chỗ khác trong admin (`confirm-action-button.tsx:29`). |
| Thấp | `ranking-points-page.tsx:82,141`; `use-ranking-points-filter-options.ts:32` | Chữ: một tên cho một thứ | Viết tay `${code} – ${fullName}` 3 lần; helper `playerCodeName` (`player-labels.ts:65`) đã có, 3 file dùng. Cùng phase, `snapshot-rank-table.tsx:38` ghi kiểu khác `${fullName} (${code})`. |
| Thấp | `ranking-points-page.tsx:96-102` | — (không có trong checklist) | Cột "Điểm" không `align="right"`; 4/4 cột "Điểm" khác (group-card, gợi ý hạt giống, breakdown, bảng hạng) canh phải. |

Đúng checklist: `ListFilterBar` 5 lọc, VĐV/Giải/Bảng tìm phía server qua `useSelect`+`onSearch`, `syncWithLocation: true`, `useListPageSize`, sort `earnedAt desc` — API hỗ trợ đủ filter/sort (`RANKING_POINTS_SPEC`); `Tag` Thủ công `blue`; hết hạn = secondary + Tag; modal thêm 640/`destroyOnHidden`/`cancelText="Hủy"`/`useStepUp`/`form.setFields`; xóa chỉ dòng MANUAL qua modal lý do + step-up. `message.error(failure instanceof Error …)` (`manual-points-form.tsx:67`) khác dòng carried (`ApiError`) nhưng hợp lý vì step-up hủy ném `Error('Đã hủy xác nhận mật khẩu')`; player-merge cũng làm vậy.

## Task 5 — Quy tắc điểm (trang tự gọi API; chưa hiệu chỉnh)

| Mức | Vị trí | Dòng checklist | Khác biệt / family làm gì |
|---|---|---|---|
| TB | `ranking-rules-save-modal.tsx:94-105` | Hộp thoại lưu — câu Alert từ `/impact` | Gọi `/impact` lỗi thì không hiện gì: người dùng lưu mà không thấy câu ảnh hưởng, không biết vì sao. Family hiện `Alert type="error"` khi xem trước lỗi (`draw-entry-action:134`, `player-merge:103`). |
| TB | `ranking-rules-matrix-page.tsx:64-68`, `use-ranking-rules-matrix.ts:54` | Tải / lỗi | Với `keepPreviousData`, đổi Đơn/Đôi hoặc nhánh: trong lúc tải, lưới cũ (của loại trước) vẫn hiện và **sửa được**; nếu tải lỗi thì `isError && !data` = false → không báo lỗi, lưới cũ ở lại dưới bộ chọn mới. Ô sửa lúc đó sẽ được lưu theo loại mới. Nên khóa lưới khi `isPlaceholderData` và hiện lỗi cả khi còn data cũ. (Chưa render để xác nhận.) |
| Thấp | `ranking-rules-save-modal.tsx:106,109` | Family modal | `Alert` lỗi ô ở **cuối** modal; 4/4 modal family đặt ở đầu (`player-merge:85`, `draw-entry-action:100`, `manual-tiebreak:77`, `bulk-sub-event:113`). Khoảng cách viết bằng `style={{ marginTop: token.margin }}` thay vì bọc `Flex vertical gap={token.margin}` như các modal đó. |
| Thấp | `ranking-rules-copy-column.tsx:27-45` | Thanh lưu — "Sao chép cột từ…" (`Dropdown`) | Dùng `Popover` + 2 `Select` + nút. Hợp lý (Dropdown không chứa được 2 bộ chọn) nhưng là component mới (0 `Popover` khác trong admin) — cần ghi vào `## Decided`. |
| Thấp | `use-ranking-rules-matrix.ts:34`, `ranking-rules-save-modal.tsx:11`, `snapshot-draft-modal.tsx:9` | DRY | `ISO_DATE = 'YYYY-MM-DD'` định nghĩa lại 3 lần; đã có `DATE_ONLY_FORMAT` (`event-labels.ts:40`), `manual-points-form` dùng nó. |
| Thấp | `ranking-rules-grid.tsx:37`, `ranking-rules-copy-column.tsx:18` | — (không có trong checklist) | Hạng giải đang ẩn bị lọc khỏi lưới + sao chép → quy tắc có sẵn của chúng không xem/sửa được ở đây. Không ai yêu cầu; cần xác nhận là cố ý. |
| Thấp | `use-ranking-rules-matrix.ts:46` | Chế độ xem phiên bản cũ | `readOnly` chỉ khi `asOf` < hôm nay; chọn một phiên bản **tương lai** thì lưới sửa được trên nền phiên bản đó nhưng ngày lưu mặc định hôm nay. Chưa rõ ý đồ. |

Lệch đã duyệt — guard: bọc `push` + `go` (không bọc `replace`), `setSearchParams` mặc định push nên đổi bộ chọn có hỏi; back/forward trình duyệt không chặn (đã ghi trong comment). Hợp lý.
Đúng checklist: Title 3 + `Flex vertical gap="middle"`; Radio button 2 bộ chọn + Select phiên bản giữ ở URL; Table `size="small" bordered pagination={false} rowKey="stageCode" scroll x`; `RULE_COLUMN_WIDTH`, `STAGE_COLUMN_WIDTH`, `VERSION_SELECT_WIDTH`, `PICKER_WIDTH` đặt tên; InputNumber `min=0 precision=0 borderless`, placeholder "—", `aria-label`, nền `token.colorWarningBg`; nhãn vòng dùng lại `roundTitle` của `draw-labels`; Alert info + "Về hiện hành"; modal lưu 640, DatePicker `DISPLAY_DATE_FORMAT`, `message.success('Đã lưu phiên bản quy tắc')` + `showWarnings`, lỗi `cells.N.points` → Alert.

## Task 6 — Kỳ chốt (list + trang xem trước; xem trước chưa hiệu chỉnh)

| Mức | Vị trí | Dòng checklist | Khác biệt / family làm gì |
|---|---|---|---|
| Thấp–TB | `snapshot-preview-page.tsx:107-109` | Công bố — tắt + Tooltip khi còn bẩn | `Tooltip` bọc thẳng `Button disabled`; 5/5 tooltip trên nút có thể tắt trong admin bọc `<span>` (`draw-action-bar:57,66`, `draw-panel:45`, `draw-seeds-step:44`, `sub-events-tab:69`). Có thể tooltip không hiện khi nút tắt — chưa render để xác nhận. |
| Thấp | `ranking-labels.ts:13` | Danh sách — Trạng thái như `PUBLISH_LABELS` | Nhãn "Nháp"; `PUBLISH_LABELS.DRAFT` (`event-labels.ts:45`) là "Bản nháp", và chính trang ghi "Tạo bản nháp", "Xóa bản nháp", "Bản nháp này…". **Sửa checklist**: dòng ghi "Nháp" nhưng dẫn `PUBLISH_LABELS`. |
| Thấp | `ranking-snapshots-page.tsx:60` | Bấm dòng → xem trước (tham chiếu import-list) | Có cả `onRow onClick` + `cursor: pointer` lẫn `Link` ở ô đầu. `import-list.tsx:65` chỉ dùng `Link`; list Refine khác không bắt click cả dòng; chỗ duy nhất khác (`results-entry-page:152`) có kèm `tabIndex` + `onKeyDown`. Click cả dòng chỉ dùng được bằng chuột. |
| Thấp | `ranking-snapshots-page.tsx:50`; `snapshot-rank-table.tsx` trong `snapshot-preview-page.tsx:96` | — | `ListFilterBar` + Table nằm trong `Flex vertical gap="middle"`, mà `ListFilterBar` đã có `marginBottom: token.margin` (`list-filter-bar.tsx:49`) → khoảng lọc–bảng gấp đôi. 13/15 nơi dùng khác đặt thẳng; `entry-table.tsx:71` cũng bị như vậy (1). |
| Thấp | `snapshot-preview-page.tsx:99-102` | Trang xem trước — Title 3 + link về (theo hub) | Tag trạng thái nằm cùng hàng với Title; 2/2 trang chi tiết (`event-hub-page.tsx:86-90`, `import-detail-page.tsx:57-61`) đặt Title trong `Flex vertical gap="small"`, tag ở dòng dưới. |
| Thấp | `snapshot-preview-page.tsx:105` | Xóa bản nháp `ConfirmActionButton danger` | Confirm chỉ có title "Xóa bản nháp này?", không có `content`; xóa trong catalog ghi thêm "Không khôi phục được sau khi xóa." (`catalog-row-actions.tsx:76`). |
| Thấp | `ranking-snapshots-page.tsx:56`, `snapshot-draft-modal.tsx:27` | Lọc theo bảng | Option lấy từ `useCatalogRows` → chỉ bảng đang hiện (`filter[isActive]=true`); kỳ chốt của bảng đã ẩn không lọc được. |
| Thấp | `snapshot-jobs-tracker.tsx:45-52` | Theo dõi job | Lỗi khác 404 khi hỏi trạng thái job: vẫn poll, không báo gì (spinner đứng mãi). |
| Thấp | `snapshot-movement-cell.tsx:7` | Biến động — `Tag` "Mới" | Tag "Mới" màu `blue`; checklist không nói màu, và `blue` đã là "Thủ công" ở Sổ điểm. |

Đúng checklist: `List title="Kỳ chốt"` + nút "Tạo bản nháp", modal chọn nhiều bảng / "Tất cả bảng" + DatePicker hôm nay, `message.success('Đã gửi yêu cầu tạo bản nháp')`, poll job → refetch, job lỗi → Alert liệt kê; bảng có `Tag orange` "N nội dung chưa tính lại"; xem trước: link `ArrowLeftOutlined` "Kỳ chốt", `Descriptions size="small" bordered`, Alert warning + action, bảng hạng server-side (`syncWithLocation`, page size, `rank asc`, search "Tìm theo tên VĐV" — API có `q`), mũi tên `token.colorSuccess/colorError`, breakdown `Table size="small" pagination={false}`, công bố `useConfirmAction` + `useStepUp`, câu xác nhận đúng chữ checklist. Lệch đã duyệt "Tính lại ngay" → dựng lại nháp, điều hướng `replace` sang nháp mới: hợp lý.

## Task 7–8 — Hub: chọn bảng XH + gợi ý hạt giống

| Mức | Vị trí | Dòng checklist | Khác biệt / family làm gì |
|---|---|---|---|
| TB | `pages/event-hub/use-ranking-list-options.ts:34-55` | Field — cơ chế `useCatalogSelect`/shared piece | Viết lại gần nguyên `useCatalogRows` (`use-catalog-options.ts:43-56`), chép luôn 2 hằng số riêng của nó (`FALLBACK_PAGE_SIZE = 20`, `STALE_MS = 60_000`), chỉ thêm `filter[competitorKind]`. Nên mở rộng `useCatalogRows` nhận thêm filter (như đã làm với `useCatalogAccess`). Query key vẫn dùng tiền tố `catalog-rows` nên invalidate còn chạy. |
| Thấp | `draw-seed-suggestion-modal.tsx:86` | Độ rộng cố định = hằng số UPPER_CASE | `width={140}` không đặt tên. |
| Thấp | `draw-seed-suggestion-modal.tsx:51-55` | `showWarnings` sau ghi | Áp dụng (`apply:true`) không gọi `showWarnings(message, warningsOf(response))`. |
| Thấp | `sub-event-ranking-field.tsx:43` | Field — `useCatalogSelect` tìm phía server | `showSearch optionFilterProp="label"` lọc phía client trên danh sách đã tải hết theo loại. Chấp nhận được (danh mục nhỏ, cố định trong form) nhưng là ngoại lệ so với 6+ file tìm server. |

Ghi chú hành vi (không phải lệch — checklist yêu cầu): `sub-event-ranking-field.tsx:20-29` gợi ý lại mỗi lần mở sửa khi ô trống → nội dung đã cố ý bỏ trống (không tính điểm) sẽ bị điền lại mỗi lần mở modal, lưu là gắn bảng. Cần người chốt.
Đúng checklist: field `label`/`extra` đúng chữ, chỉ bảng đang hiện cùng loại, giữ option đang lưu dù đã ẩn; bulk: ô chung chỉ khi cùng loại, khác loại → text secondary, gửi `rankingListId` chỉ khi cùng loại; tab cột hiện `rankingList.name ?? '—'`, API đã thêm `rankingList` vào `SUB_EVENT_INCLUDE`; modal gợi ý 640, `destroyOnHidden`, text secondary đầu modal, Table nhỏ, `useConfirmAction` "Ghi đè hạt giống hiện có?", `message.success('Đã áp dụng N hạt giống')`, invalidate bảng seed, lỗi → Alert ở đầu. Lệch đã duyệt (nút chỉ tắt khi chưa gắn bảng, "Bảng chưa có kỳ chốt công bố" trong modal): hợp lý.

## Đúng, nhưng không thuộc task này
- `snapshot-jobs-tracker.tsx:7` `SNAPSHOT_JOB_POLL_MS = 2_000` viết cứng — family làm y vậy (`import-labels.ts:110` `IMPORT_POLL_MS = 2000`). Theo luật dự án đây là tham số vận hành nên lên `/settings`; drift có sẵn.
- `'HH:mm DD/MM/YYYY'` literal (`ranking-snapshots-page.tsx:30`, `snapshot-preview-page.tsx:117`) — `import-list`, `user-list`, `temp-password-modal` cũng literal; chưa có hằng số chung.
- `entry-table.tsx:71` cũng bọc `ListFilterBar` trong `Flex gap` (khoảng gấp đôi).

## Sửa checklist
- D: "Trạng thái `Tag` (Nháp …) — như `PUBLISH_LABELS`": `PUBLISH_LABELS.DRAFT` là "Bản nháp".
- A: "Giới" → code family ghi "Giới tính" (discipline list/form, player list/form); trang đã theo code.

## Toàn bộ theo loại (so cả bộ)
- **List** (4: ranking-list-list, ranking-points-page, ranking-snapshots-page, snapshot-rank-table): 1 khớp hẳn (ranking-list-list, trừ chữ). ranking-points-page là trang duy nhất bọc Skeleton/Result; ranking-snapshots-page là trang duy nhất click cả dòng và bọc lọc+bảng trong Flex gap. Nút header tự dựng `Button primary + PlusOutlined` ở 2 trang không có resource create — khớp hub (`draws-tab`, `entries-tab`, `schedule-tab`).
- **Modal** (5 mới: thêm điểm, xóa điểm, lưu quy tắc, tạo nháp, gợi ý hạt giống): 640 ở 3/5 (xóa điểm, tạo nháp không đặt width); Alert lỗi ở đầu ở 2/5 có Alert (lưu quy tắc để cuối; xóa điểm để dưới field).
- **Trang tự gọi API** (2: ma trận, xem trước): cùng Title 3 `margin: 0`, Skeleton/Result "Thử lại"; xem trước khác hub ở bố cục Title + Tag.
- Không trang nào parked.

## Chữ người dùng tự nghĩ ra (cần người đọc lại)
- Bảng XH form: "Bỏ trống để dùng thời hạn mặc định trong Cài đặt hệ thống."; "Bỏ trống nếu bảng áp dụng cho mọi nhóm tuổi."; "Bật để điểm vòng bảng khác nhau theo thứ hạng chung cuộc của bảng (nhất, nhì...)."
- Sổ điểm: "Nhập số âm để trừ điểm."; "Điểm phải khác 0"; "Bỏ trống để tính theo ngày tính cộng thời hạn của bảng xếp hạng."; "Ngày hết hạn phải sau ngày tính"; placeholder lọc "Hiệu lực"; modal xóa "Xóa dòng điểm thủ công" / "Xóa {N} điểm của {VĐV}? Không hoàn tác được." / "Lý do xóa" / "Đã xóa dòng điểm thủ công".
- Quy tắc điểm: "Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?" + "Bỏ thay đổi" / "Ở lại"; "Hiện hành"; "Áp dụng từ ngày"; câu ảnh hưởng **khác checklist**: "Áp cho giải kết thúc từ …; N giải (M nội dung) đang diễn ra hoặc chưa diễn ra sẽ tính lại; giải đã kết thúc giữ nguyên."; "Có ô chưa hợp lệ"; "Sao chép cột" / "Chép điểm từ hạng giải" / "sang hạng giải"; nhãn vòng mới "Vòng bảng – hạng N", "Vòng loại – vòng cuối", "Vòng loại – trước vòng cuối N vòng".
- Kỳ chốt: "Tính đến ngày" (cột list ghi "Ngày tính", mà Sổ điểm cũng dùng "Ngày tính" cho ngày được điểm — một tên hai nghĩa); tooltip "Còn N nội dung chưa tính lại, hãy tính lại trước khi công bố"; "Bản nháp này chưa phản ánh kết quả mới nhất. Tính lại sẽ dựng lại bản nháp."; "Đã gửi yêu cầu tính lại"; "Đang dựng bản nháp (x/y)…" / "Trang tự cập nhật khi xong." / "Không dựng được bản nháp" / "N nội dung chưa tính lại được"; "Xóa bản nháp này?".
- Hub: "Bảng XH" (cột tab; cột bên cạnh ghi tên đủ "Thể thức thi đấu", "Luật vòng bảng"); "BXH" giờ có hai nghĩa — bảng xếp hạng ("Gợi ý theo BXH") và bảng điểm vòng bảng ("Tính lại BXH bảng …", `group-card.tsx:30,47`); "Ghi đè" (okText); "Bảng chưa có kỳ chốt công bố".

## Quét thêm theo yêu cầu
- Hex / literal khoảng cách: không có trong file phase 09. Độ rộng không tên: 1 (`draw-seed-suggestion-modal.tsx:86`).
- Lọc/sort/phân trang phía client cho list của server: không có. Chỉ có option Select nhỏ lọc client (`sub-event-ranking-field`, `snapshot-draft-modal`).
- Giá trị nghiệp vụ viết cứng: độ dài lý do 3/500 (task 4), poll 2s (drift có sẵn). Thời hạn điểm, số hạt giống, page size lấy từ API/setting.
- File > 200 dòng: không có (lớn nhất `ranking-points-page.tsx` 155).
- Chuỗi xưng hô riêng tư: không có trong file được theo dõi; chỉ gặp ở `GEMINI.md` ở gốc repo — file này bị `.gitignore` dòng 21 bỏ qua, không thuộc repo.

## Chưa kiểm được
- Không render: kích thước, tràn, khoảng cách thực tế (gap gấp đôi suy từ code), tooltip trên nút tắt ở trang xem trước, focus / thứ tự Tab, bẫy focus của Popover sao chép cột, tương phản (chữ trên `colorWarningBg`, chữ `colorSuccess/colorError`) — chưa đánh giá. Theme `antdTheme` không resolve lại; không biết có chế độ tối hay không.
- Chưa chạy typecheck/lint/test; chưa gọi API thật (luồng 3 bước kỳ chốt, lưu ma trận).
- Ma trận và trang xem trước chưa có calibration (không có trang cùng loại để plant).
- publishedBy ("bởi <tên>") bỏ qua theo brief.

## Chi phí
~40 trang/vùng được so (35 file trong danh sách); ~60 file dự án mở (gồm tham chiếu tiers, disciplines, audit-log, import list/detail, event-hub, các modal family, shared permissions, API ranking specs); ~40 lệnh tìm/diff. Một checker, không gọi sub-agent. Số liệu ước lượng.
