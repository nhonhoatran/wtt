# Admin — đối chiếu Figma ↔ app hiện tại

Ngày: 2026-11-25. Nguồn: `figma/admin/*.png` (ảnh phẳng, không có layer — màu/chữ đọc bằng mắt), code `apps/admin/src`, `apps/api/src`, `packages/*`.
Số liệu trong Figma (tên giải, 186 VĐV, 40 phút, Hạng A…) là dữ liệu mẫu; app lấy từ API.

Ký hiệu cột "Gap": **UI** = chỉ sửa giao diện · **API-read** = cần thêm/mở rộng endpoint đọc, không đổi schema · **Mới** = cần dữ liệu/tính năng mới (schema hoặc nghiệp vụ) → xem `admin-open-questions.md`.

Tiền đề: working tree đang có đợt audit admin chưa commit (U1–U11, 46 file `apps/admin`, `packages/ui-tokens/src/antd-theme.ts`, `schedule-keyboard-drag.ts`, `crud-page.tsx`, `back-link.tsx`, `form-instance-host.tsx`). Phải commit đợt đó trước khi bắt đầu phase A1.

---

## Shell (mọi frame)

| Figma | App hiện tại | Gap |
|---|---|---|
| Logo "K" đỏ + "KAMITO / Quản trị giải đấu" | Chữ "Kamito · Quản trị" (`layout/admin-layout.tsx:41-43`) | UI |
| Mỗi mục menu có icon | Menu chỉ có chữ (`admin-layout.tsx:29-37`, `menu-groups.ts:3-9` không có trường icon) | UI |
| Mục đầu "Tổng quan" | "Trang chủ" (`admin-layout.tsx:30`) | UI |
| Nhóm GIẢI ĐẤU: Giải đấu, Hạng giải, Địa điểm & bàn đấu | Nhóm có "Danh sách giải, Địa điểm & bàn, Nhập tỷ số" (`menu-groups.ts:23-31`); "Hạng giải" nằm ở Cấu hình (`menu-groups.ts:67`) | UI (dời mục) |
| VẬN ĐỘNG VIÊN: Vận động viên, Cặp đôi | Có thêm "Lịch sử import" (`menu-groups.ts:38`) | UI — giữ mục import (Figma bỏ sót, xoá là mất chức năng) |
| XẾP HẠNG: Bảng xếp hạng, Quy tắc điểm | Có thêm "Sổ điểm", "Kỳ chốt" (`menu-groups.ts:46-48`) | UI — giữ hai mục này |
| NỘI DUNG: Tin tức, Video, Trang tĩnh | Có thêm "Hộp thư liên hệ" (`menu-groups.ts:58`) | UI — giữ |
| Nhóm đáy: Nhà tài trợ, Cấu hình, Người dùng (một dòng mỗi mục) | Cấu hình 8 mục con, Người dùng 2 mục con (`menu-groups.ts:62-83`) | UI — Cấu hình/Người dùng thành submenu thu gọn |
| Mục đang chọn: nền đỏ bo góc | antd dark menu mặc định | UI. Trắng trên `#EC1E24` ≈ 4.4:1 (< 4.5 AA cho chữ 14 px) → dùng `primaryStrong` `#A31115` (≈ 7.9:1) |
| Focus bàn phím trên sider | Vòng focus navy `#0F285D` (`packages/ui-tokens/src/antd-theme.ts:14`) trên `#0A0A0A` ≈ 1.4:1 | UI — sider cần màu focus sáng (`live` `#E3F42A` ≈ 16:1) |
| Header TRẮNG, breadcrumb, chuông thông báo (chấm đỏ), avatar chữ tắt + tên + vai trò | Header đen (`antd-theme.ts:34` `headerBg: ink`), chỉ có nút tên + Tag vai trò (`admin-layout.tsx:84-101`), không breadcrumb | UI (header, breadcrumb, avatar). Chuông: **Mới** — không có hệ thống thông báo |
| Nhãn vai trò "Điều hành giải" | `ROLE_LABELS` = "Quản trị" / "Nhập kết quả" (`menu-groups.ts:91-94`) | Không đổi — Figma là chữ mẫu |

Xung đột/khả dụng: Figma rút gọn menu bằng cách bỏ 5 màn đang dùng. Giữ đủ mục, chỉ gom và thêm icon. `RESULTS_OPERATOR` vẫn chỉ thấy menu rút gọn (`visibleMenuGroups`, `menu-groups.ts:86-89`); mục "Tổng quan" phải ẩn với vai trò này vì "/" của họ là Nhập tỷ số (`pages/role-home-page.tsx:14`).

---

## 1-57 Tổng quan (dashboard)

| Figma | App hiện tại | Gap |
|---|---|---|
| Tiêu đề + ngày hôm nay + "Hôm nay có N giải đang diễn ra" | "Xin chào, {tên}" + lưới thẻ link (`role-home-page.tsx:19-33`) | UI + API-read |
| Nút "Nhập kết quả", "Tạo giải đấu" | Không có | UI (link `/results`, `/events/create`) |
| 4 KPI: giải đang diễn ra, trận chờ kết quả hôm nay (+ "Cần xử lý"), trận đã xong hôm nay, VĐV đang thi đấu | Chỉ có `GET /admin/events?filter[lifecycle]=ONGOING` (đếm được KPI 1, `events-query.service.ts:23-26`). Danh sách trận chỉ theo từng giải (`matches/admin-matches.controller.ts:15`), không lọc theo ngày | API-read (endpoint tổng hợp mới) |
| Card "Giải đang diễn ra": tên, Tag hạng giải, Tag trạng thái, ngày, địa điểm, thanh tiến độ "Đã xong x/y trận" | Không có số trận theo giải | API-read |
| Bảng "Trận chờ kết quả hôm nay" (giờ/bàn, nội dung · vòng, hai bên, trạng thái, nút Nhập), phân trang | Không có danh sách trận liên giải | API-read (phân trang server) |
| "Thao tác nhanh" 4 ô (Tạo giải, Nhập kết quả, Nhập từ Excel, Xếp lịch) | Không có | UI. "Nhập từ Excel"/"Xếp lịch" cần chọn giải → chỉ đặt trong card từng giải đang diễn ra |
| "Hoạt động gần đây" dạng câu có tên đối tượng ("…xác nhận kết quả trận Tứ kết Đơn nam, Bàn 1") | `GET /admin/audit-logs` có `actorName`, `action`, `entity`, `entityId` (`audit-log-labels.ts:26-39`); nhãn hành động chỉ có cho user/setting (`audit-log-labels.ts:2-16`), không có tên đối tượng | UI (thêm nhãn hành động giải/trận/bốc thăm/xếp hạng) + câu đầy đủ có tên đối tượng = **Mới** (làm giàu audit) |
| Chuông thông báo | — | **Mới** |

Ghi chú: "Hoạt động gần đây" chỉ hiện cho vai trò có `audit-logs.list` (ADMIN). Số giải trong card và số dòng hoạt động là tham số → setting `/settings`, không chôn trong code.

---

## 1-53 Danh sách giải

| Figma | App hiện tại | Gap |
|---|---|---|
| Tiêu đề "Giải đấu" + mô tả; nút "Xuất Excel", "Tạo giải đấu" | `List title="Danh sách giải"`, nút "Thêm giải" (`resources/events/event-list.tsx:35-39`) | UI. Tên nút giữ "Thêm giải" theo quy ước U6 (open-debts-backlog) — Figma lệch quy ước. "Xuất Excel" danh sách giải: **Mới** (`exports` chỉ có entries/schedule/results, `admin-exports.controller.ts`) |
| Thanh lọc: tìm, Năm, Hạng giải, Trạng thái, "Đặt lại", dòng "Đang lọc: [chip ×]" | Có tìm/Hạng giải/Năm/Trạng thái/Công bố (`event-list.tsx:46-50`) qua `ListFilterBar` | UI (chip + Đặt lại trong `list-filter-bar.tsx`) |
| Tab trạng thái có số đếm: Tất cả, Nháp, Đã công bố, Đang diễn ra, Đã kết thúc | Không có tab, không có endpoint đếm | API-read (đếm theo từng giá trị, áp các lọc còn lại) |
| Cột Tên giải + dòng phụ "186 VĐV" | Chỉ tên (`event-list.tsx:54-60`); list chỉ có `_count.subEvents` (`events/event-view.ts:12`) | API-read (đếm entry CONFIRMED theo giải) |
| Hạng giải (Tag màu), Thời gian, Địa điểm (kèm thành phố), Nội dung (số) | Có đủ; màu lấy `colorHex` DB (`event-labels.ts:65`) | UI |
| Trạng thái gộp 1 cột | 2 cột: vòng đời + công bố (`event-list.tsx:74-83`) | UI — xem xung đột |
| Thao tác "Xem | Sửa | …" | Click tên mở hub | UI ("Sửa" → `/events/:id/info`) |
| Phân trang server + "10 / trang" | Đã server-side (`useTable` `syncWithLocation`, `event-list.tsx:25-30`), page size từ setting | Không đổi |

Xung đột: Figma gộp hai trục độc lập vào một dãy tab — "Nháp/Đã công bố" (trạng thái công bố, `publishStatus`) và "Đang diễn ra/Đã kết thúc" (vòng đời suy ra từ ngày, `event-lifecycle-filter.ts:9-20`). Một giải đang diễn ra thì cũng đã công bố → không có tab nào loại trừ nhau; số đếm cộng lại ≠ "Tất cả". Đề xuất: tab = vòng đời (Tất cả · Sắp diễn ra · Đang diễn ra · Đã kết thúc · Đã hủy) có số đếm; công bố giữ là ô lọc + Tag "Nháp" cạnh tên. Figma thiếu "Đã hủy" — thêm vào.

---

## 1-8 Chi tiết giải — header, "Tiến độ chuẩn bị", tab "Nội dung thi đấu"

| Figma | App hiện tại | Gap |
|---|---|---|
| Nút ← + tên giải + Tag hạng giải (màu) + Tag "Nháp/Đã công bố" | `BackLink` chữ + tiêu đề + Tag vòng đời + Tag công bố (`pages/event-hub/event-hub-page.tsx:86-95`) | UI |
| Dòng phụ: ngày · địa điểm · N nội dung · M "VĐV và cặp đôi" | Chỉ ngày (`event-hub-page.tsx:93`) | UI + API-read (tổng entry) |
| Nút "Xem trước trang giải", "Sửa thông tin", "Công bố giải" (đỏ); ở 1-21/1-30 là "Xem trang giải" + "…" | Công bố/Bỏ công bố + Hủy/Bỏ hủy (`event-hub-actions.tsx:27-64`) | UI ("…" chứa Bỏ công bố, Hủy giải). "Xem trước" giải nháp: **Mới** — site công khai không có chế độ preview; `PUBLIC_SITE_URL` có trong `runtime-config.ts:4` nhưng chưa dùng |
| Stepper 5 bước: Thông tin · Nội dung (5) · Danh sách (134) · Bốc thăm (3/5) · Lịch (chưa xếp), trạng thái Đã xong/Đang làm/Chưa bắt đầu, "Còn 2 việc trước khi công bố" | Không có | API-read (1 endpoint tiến độ) + UI |
| Tab: Thông tin, Nội dung thi đấu, Danh sách đăng ký, Bốc thăm, Lịch thi đấu, Kết quả | info, sub-events, "Danh sách", draws, "Lịch & kết quả", "Tài trợ" (`event-hub-page.tsx:31-38`) | UI: đổi nhãn, thêm tab "Kết quả" (dùng lại màn nhập tỷ số theo giải). Giữ tab "Tài trợ" (Figma bỏ sót). Giữ key URL (`/events/:id/entries`… — E2E `apps/client/tests/admin-full-flow/*.ts` dùng) |
| Bảng nội dung: Nội dung · Thể thức (+ mô tả "8 bảng × 4 VĐV…") · Thể thức trận (+ "Ván 11 điểm, cách biệt 2") · Số VĐV · Hạt giống · Bốc thăm (Tag) | Cột: Nội dung, Mã, Thể thức, Thể thức trận (chỉ tên), Luật vòng bảng, BXH, Tối đa, Thao tác (`sub-events-tab.tsx:52-58`). Include `matchFormat` chỉ có `id,name` (`sub-events/sub-event-items.ts:21`) | API-read (thêm `bestOf/pointsPerGame/winBy` vào include; số hạt giống vào `entry-counts`) + UI (ghép `entry-counts` + `events/:id/draws`, đã có) |
| Ghi chú cuối bảng "Thể thức trận đặt riêng cho từng nội dung" | — | UI |

Xung đột: "Còn 2 việc trước khi công bố" ngầm hiểu công bố giải bị chặn bởi bốc thăm/lịch. Nghiệp vụ hiện tại: công bố giải không có điều kiện (`events/events.service.ts:89-91`) và thực tế BTC thường công bố sớm để mở đăng ký. Stepper chỉ là chỉ báo, không chặn; đổi chữ thành "Còn N bước chưa xong". Mô tả "8 bảng × 4 VĐV" chỉ có sau khi đã bốc thăm (tham số nằm ở Draw), trước đó chỉ hiện tên thể thức.

---

## 1-14 Danh sách đăng ký + nhập Excel (1-10…1-13 là các bước)

| Figma | App hiện tại | Gap |
|---|---|---|
| Chọn nội dung bằng thanh pill ngang có số ("Đơn nam 32") | Side menu bên trái (`entries-tab.tsx:63`, `side-menu-layout.tsx`) | UI |
| Hàng công cụ: tìm VĐV/CLB, lọc trạng thái, "Tải file mẫu", "Thêm VĐV", "Nhập từ Excel" | Tìm/lọc trong `EntryTable` (`entry-table.tsx`), form thêm luôn mở (`entries-tab.tsx:85`), "Import Excel" + "Xuất Excel" (`entries-tab.tsx:73-80`) | UI ("Thêm VĐV" mở form thu gọn; giữ "Xuất Excel") |
| Panel nhập Excel nằm ngay trong tab, stepper 3 bước Tải file → Kiểm tra dữ liệu → Xác nhận | Modal 2 bước rồi chuyển hẳn sang `/imports/:id` (`components/import-wizard.tsx:22,50`) | UI — hiển thị bước 3 ngay trong tab qua `?import=<jobId>` (vẫn sống qua reload) |
| Chip "32 dòng hợp lệ / 4 dòng lỗi / 2 dòng trùng VĐV", cảnh báo vàng, bảng lỗi cột "Lỗi" + "Cách sửa" | Tab theo trạng thái dòng + `messages[]` (`import-labels.ts:55`); không có "cách sửa" | UI (chip/cảnh báo). "Cách sửa" theo mã lỗi: **Mới** (worker phải trả mã lỗi) |
| "Tải danh sách lỗi" | Không có | **Mới** (export dòng lỗi) |
| Checkbox "Bỏ qua dòng lỗi, chỉ nhập 32 dòng hợp lệ" | Commit luôn bỏ dòng lỗi, hộp xác nhận nói rõ (`import-commit-bar.tsx:22,53`) | UI — không cần checkbox (thêm 1 click vô nghĩa), giữ câu xác nhận |
| Import theo từng nội dung ("Nhập danh sách từ Excel · Đơn nam") | Import theo cả giải, file mẫu có mã nội dung (`import-wizard.tsx:41-44,66`) | Xung đột — xem dưới |
| Bảng: Hạt giống, VĐV, CLB, Điểm xếp hạng, Trạng thái (Đã xác nhận / Chờ xác nhận / Rút lui), Sửa, … | Có seed, VĐV, CLB, `pointsAtEntry`, trạng thái CONFIRMED/WITHDRAWN (`entry-labels.ts:5,50`) | UI (bố cục). "Chờ xác nhận": **Mới** (enum `EntryStatus` chỉ có 2 giá trị) |

Xung đột: import theo từng nội dung bắt BTC tách file và upload 5 lần cho 5 nội dung; một file cho cả giải nhanh hơn. Giữ import cấp giải; panel hiện tên giải, dòng lỗi vẫn ghi mã nội dung. Figma 1-14 có khối trên bị lặp (lỗi ghép frame) — bỏ qua.

---

## 1-21 Bốc thăm — xem trước (1-16…1-20 là bước chọn hạt giống / chia bảng)

| Figma | App hiện tại | Gap |
|---|---|---|
| Pill nội dung có chấm trạng thái | Side menu + Tag trạng thái (`draws-tab.tsx:66-74`) | UI |
| Dòng tóm tắt "32 VĐV · 8 bảng × 4 · 8 hạt giống · 2 VĐV mỗi bảng vào vòng loại trực tiếp" | `drawSummaryText` có sẵn (`draw-summary-text.ts`) | UI |
| Stepper 4 bước: Chọn hạt giống → Chia bảng/xếp nhánh → Xem trước → Công bố | Wizard modal 3 bước (Thông số, Hạt giống, Bốc thăm) (`draw-wizard.tsx:13`) rồi panel hiển thị bản nháp | UI (stepper trạng thái suy từ draw) |
| Cảnh báo "2 VĐV cùng CLB … chung Bảng C · Đổi chỗ", Tag "Trùng CLB" trên thẻ bảng | Không có; dữ liệu CLB đã có trong group view (`draw-types.ts:41`) | UI (tính trên dữ liệu bảng đã tải). Tách VĐV cùng CLB khi sinh bảng: **Mới** (thuật toán) |
| Lưới thẻ bảng 4 cột, hạt giống `[1]`, tên + CLB | `GroupTablesView`/`group-card.tsx` | UI |
| Nhánh loại trực tiếp (Nhất bảng A vs Nhì bảng H…) hiện cùng lúc với vòng bảng | Tab riêng theo loại draw (`draws-tab.tsx:91`) | Xung đột — xem dưới |
| Thanh đáy dính: Quay lại · Bốc thăm lại · Công bố + popconfirm "VĐV và khán giả sẽ thấy…" | `DrawActionBar` có Bốc lại + Công bố có xác nhận (`draw-action-bar.tsx:77-82`) | UI |

Xung đột: nhánh chính của thể thức vòng bảng chỉ sinh được SAU khi vòng bảng đã công bố (`draws/draw-params.service.ts:61`, 409 `GROUP_DRAW_NOT_PUBLISHED`). Figma ngụ ý một lần công bố cả hai. Giữ hai bước công bố; được phép xếp chồng hai khu (Vòng bảng, rồi Vòng loại trực tiếp) trên một trang thay vì tab, khu nhánh chính hiện trạng thái trống "Công bố vòng bảng trước".

---

## 1-30 Lịch thi đấu (1-23…1-29 là trạng thái kéo/thả)

| Figma | App hiện tại | Gap |
|---|---|---|
| Pill ngày "T4 11/11", pill buổi "Buổi sáng 08:00–12:00" | Radio ngày `DD/MM/YYYY`, radio buổi (`session-toolbar.tsx:23-24`) | UI |
| "Mỗi khung 40 phút" + cột "Khung" 08:00/08:40… | Lưới theo thứ tự ô; giờ mỗi trận server tính từ thời lượng thể thức (`docs/scheduling.md:31-32,147-149`; `session-grid.tsx:22`) | Xung đột — xem dưới |
| "Tự động xếp" | Không có | **Mới** |
| "Lưu lịch" | Mỗi lần thả lưu ngay, khoá lạc quan `scheduleVersion` (`docs/scheduling.md:137`) | Xung đột — bỏ nút, hiện "Đã lưu tự động" |
| "Đã xếp 24/36 trận" + thanh tiến độ | Không có | API-read (dùng endpoint tiến độ phase A4) |
| Banner "Có 1 trận trùng giờ cần sửa", ô đỏ + tooltip | Cảnh báo theo từng ô (`session-grid-cell.tsx:117-125`) | UI (đếm tổng trong buổi) |
| Viền trái ô + chú giải màu theo nội dung (Đơn nam xanh, Đơn nữ hồng…) | Không có màu; `Discipline` không có cột màu (`packages/db/prisma/schema/tournament-catalog.prisma:77-89`) | **Mới** (cột `colorHex` nullable, theo quy ước "màu theo loại là dữ liệu DB", `docs/code-standards.md` mục Frontend) |
| "Bàn 1 Sân chính" | `VenueTable` không có cờ sân chính (`tournament-catalog.prisma:155-169`) | Bỏ — dùng `displayName` sẵn có |
| Panel "Trận chưa xếp lịch (12)" + lọc nội dung, gợi ý kéo | Có, kèm lọc vòng + tìm (`unscheduled-panel.tsx:75-122`) | UI |

Xung đột: lưới khung giờ cố định giả định mọi trận dài bằng nhau. Thực tế thời lượng theo thể thức (BO3 ≠ BO5), trận đánh xong sớm/muộn; server tính giờ từng bàn theo dãy. Bắt khung 40 phút sẽ hiện giờ sai và là một giá trị nghiệp vụ chôn cứng. Giữ hàng = lượt (thứ tự) và hiện giờ dự kiến trong từng ô. "Lưu lịch" gom thay đổi làm mất việc khi hai người xếp cùng lúc hoặc đóng tab; lưu ngay an toàn hơn. Giữ nguyên kéo bằng bàn phím (`schedule-keyboard-drag.ts`).

---

## 1-34 Nhập kết quả trận

| Figma | App hiện tại | Gap |
|---|---|---|
| Trang riêng, breadcrumb "…/Kết quả/Nhập kết quả", "Trận 3/14 chờ kết quả", Trận trước/Trận sau | Danh sách + Drawer 520 px (`results-entry-page.tsx:161-167`, `match-score-drawer.tsx:19`); tự mở trận kế tiếp cùng bàn sau khi xác nhận (`results-entry-page.tsx:72-82`) | Xung đột — giữ drawer, thêm Trận trước/sau trong drawer |
| Header tỉ số lớn "2 – 1" + tên, seed, CLB hai bên; Tag nội dung + vòng; dòng bàn · giờ · thể thức | Có dữ liệu trong chi tiết trận | UI |
| Lưới ván (cột Ván 1…5, "Ván thắng"), lỗi đỏ dưới bảng nêu rõ ván + ví dụ | `game-score-inputs.tsx` + lỗi theo ván (`score-draft.ts:14,40`) | UI |
| Ô "Người thắng: chưa xác định" + giải thích tự tính | — | UI |
| "Kết thúc trận" select (Thi đấu bình thường…) | `ResultType` NORMAL/WALKOVER/RETIRED/DISQUALIFIED (schema), modal bỏ cuộc riêng (`match-abandon-modal.tsx`) | UI |
| "Ghi chú" | `Match` không có cột ghi chú | **Mới** |
| "Lưu nháp" / "Xác nhận kết quả" (khoá khi lỗi + lý do dưới nút) | save-progress/confirm có (`admin-match-results.controller.ts:36,43`) | UI |
| Tab "Kết quả" trong hub | Chỉ có `/results` toàn cục | UI |

Xung đột: trang riêng làm mất ngữ cảnh danh sách và thêm thao tác quay lại; trọng tài bàn nhập liên tục nên drawer + tự mở trận kế tiếp nhanh hơn. Giữ drawer, áp bố cục Figma vào trong. Deep link `/results?event=&match=` cho nút "Nhập" ở dashboard.

---

## 1-40 Quy tắc điểm xếp hạng

| Figma | App hiện tại | Gap |
|---|---|---|
| Header + mô tả "Thay đổi chỉ áp dụng…" | Tiêu đề trơn (`ranking-rules-matrix-page.tsx:46`) | UI |
| Toggle Đơn/Đôi | Có (`:48`), thêm toggle Vòng chính/Vòng loại (`:49`) và chọn phiên bản (`:50-57`) | UI — giữ cả hai control Figma bỏ sót |
| Cột = hạng giải (Tag màu), hàng = vòng | Có (`ranking-rules-grid.tsx:27-31`), màu từ DB | UI |
| Ô đã sửa nền vàng + "trước: 320" | Có cờ `isEdited`; giá trị gốc có trong state (`ranking-rules-state.ts`) | UI |
| Lỗi tại ô "Nhập số điểm, từ 0 trở lên" | Ô trống = giữ giá trị cũ (`ranking-rules-matrix-page.tsx:75`) | UI (chỉ báo lỗi cho giá trị âm/không hợp lệ; ô trống vẫn = giữ) |
| "+ Thêm vòng đấu" | Mã vòng suy từ cấu trúc nhánh (W, F, SF…; `rankings.prisma` comment `stageCode`) | Xung đột — bỏ |
| "Khôi phục mặc định" | Không có khái niệm bộ mặc định; quy tắc có phiên bản theo ngày hiệu lực | **Mới** — bỏ khỏi bản này |
| "Thời hạn hiệu lực của điểm: 12 tháng" (toàn cục) | `validityDays` theo từng BXH (`rankings.prisma` `RankingList.validityDays`; form `ranking-list-form.tsx:48`) | Xung đột — hiện bảng tóm tắt chỉ đọc theo BXH + link sửa |
| Thanh đáy dính "3 thay đổi chưa lưu · 1 ô cần sửa · Huỷ · Lưu thay đổi" | Hàng nút cuối trang (`:72-83`), guard rời trang (`ranking-rules-unsaved-guard.ts`) | UI. Giữ modal lưu có ngày hiệu lực (`ranking-rules-save-modal.tsx:30,50`) |

---

## 1-46 / 1-49 Bảng xếp hạng (quản trị)

| Figma | App hiện tại | Gap |
|---|---|---|
| Trang "Bảng xếp hạng" theo từng BXH (pill Đơn nam/Đơn nữ…), Tag "Tạm tính", dòng "Kỳ 46/2026 · Tạm tính đến 10:45 · Kỳ trước 45/2026 chốt ngày…" | Menu "Bảng xếp hạng" mở danh mục BXH (`/ranking-lists`); bảng hạng ở `/ranking-snapshots/:id` (`snapshot-preview-page.tsx`) | UI (trang mới ghép dữ liệu sẵn có) |
| "Lịch sử các kỳ" | `/ranking-snapshots` có lọc `listId` (`ranking-snapshots-query.service.ts:11`) | UI (link) — dữ liệu đã có |
| "Xuất Excel" | Không có export BXH | **Mới** |
| "Chốt bảng kỳ này" + popconfirm nêu số VĐV đổi hạng | Công bố bản nháp qua hộp xác nhận + step-up mật khẩu (`snapshot-preview-page.tsx:84-104`; controller `@RequireStepUp`) | UI — giữ step-up |
| 4 KPI: VĐV có điểm, thay đổi thứ hạng, VĐV mới, điểm hết hạn trong kỳ | Chỉ có `_count.rows`, `dirtySubEvents` | API-read (đếm `movement≠0`, `previousRank IS NULL`, tổng điểm `expiresAt` trong (kỳ trước, kỳ này]) |
| Tìm VĐV/CLB, lọc CLB, "Chỉ hiện VĐV có thay đổi", Đặt lại | `q` theo tên/mã (`ranking-snapshots-query.service.ts:58`) | API-read (lọc `club`, `changedOnly`; tìm theo CLB) |
| Cột: Hạng, So với kỳ trước (▲/▼ + "kỳ trước: hạng x", "Mới"), VĐV, CLB, Điểm, Điểm kỳ trước, Chênh lệch, Số giải tính điểm, "Chi tiết điểm" | Có hạng, `movement`, VĐV, điểm, `resultsCounted` (`snapshot-rank-table.tsx:39-43`); có `previousRank` trong schema; không có CLB trong include (`ranking-snapshots-query.service.ts:67`), không có điểm kỳ trước | API-read (thêm `club`; `previousPoints` đọc từ kỳ đã công bố trước của cùng BXH) |

Xung đột nhỏ: "Kỳ 46/2026" là số tuần — hệ thống không có khái niệm kỳ đánh số, kỳ = `asOfDate`. Hiện "Kỳ ngày 11/11/2026" thay vì bịa cách đánh số.

---

## Tổng hợp mức thay đổi

| Loại | Màn |
|---|---|
| Chỉ UI | Shell (trừ chuông), danh sách đăng ký (bố cục), bốc thăm, lịch (trừ màu/tự xếp), nhập kết quả (trừ ghi chú), quy tắc điểm |
| Cần API đọc (không đổi schema) | Dashboard, đếm tab + số entry danh sách giải, tiến độ giải, include thể thức trận + số hạt giống, KPI/cột/lọc bảng xếp hạng |
| Cần quyết định trước (Mới) | Chuông, xem trước giải nháp, xuất Excel (giải, BXH, dòng lỗi), "Cách sửa" theo mã lỗi, trạng thái "Chờ xác nhận", tách CLB khi bốc thăm, tự động xếp lịch, màu nội dung, ghi chú trận, khôi phục mặc định quy tắc, câu hoạt động có tên đối tượng |
| Không cần migration nếu chọn theo khuyến nghị | Tất cả, trừ màu nội dung (1 cột nullable) nếu được duyệt |
