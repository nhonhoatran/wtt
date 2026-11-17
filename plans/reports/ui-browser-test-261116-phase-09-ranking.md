# UI browser test: phase 09, các trang admin Xếp hạng (2026-11-16)

**Kết quả: DONE_WITH_CONCERNS.** Cả 7 flow chạy được và đạt chức năng chính. Không có bug chặn. Tìm thấy 1 lỗi mức Trung bình và vài lỗi mức Thấp. Phần lớn lỗi Thấp đã có từ trước, không thuộc phase 09.

## Môi trường

- Kiểm có neo `grep -n '^DATABASE_URL=' .env`: dòng 23 trỏ `localhost:5433/kamito_tt_dev`. Không sửa `.env`. Không chạy migrate, seed hay db push.
- Đã khởi động `pnpm --filter @kamito/{api,worker,admin} dev` (API 3000, admin Vite 5173). Xong thì tắt hết và dừng process theo PID. Port 3000, 3010, 5173 đã trống.
- Worker log có cảnh báo `revalidate job failed ... timeout` vì site công khai không chạy. Không liên quan phase 09.
- Khoảng 16:59, API tự khởi động lại (`--watch`, PID đổi) do có người sửa file API trong lúc test. Một lần tải `/events/:id` hiện "Không kết nối được máy chủ", tải lại thì bình thường.
- Đăng nhập bằng tài khoản dev `ui-test-admin@example.com`, do dispatcher tạo theo chỉ đạo của chủ repo. Mật khẩu chỉ đi từ file scratchpad vào ô nhập trong trình duyệt, qua một helper loopback tạm (đã xóa). Report, ảnh và log không chứa mật khẩu.
- Viewport desktop 1440×900. Kiểm mobile ở 375px.

## Kết quả theo flow

| # | Flow | Kết quả | Ảnh (`screenshots-261116-phase-09/`) |
|---|---|---|---|
| 1 | Menu "Xếp hạng" có 4 mục: Bảng xếp hạng, Quy tắc điểm, Sổ điểm, Kỳ chốt | PASS | `01-menu-xep-hang.png` |
| 2 | Bảng xếp hạng: tạo, lọc, sửa thời hạn, ẩn/hiện | PASS (toast chữ sai: B2) | `02a`…`02d` |
| 3 | Quy tắc điểm: ma trận, bỏ thay đổi, sao chép cột, lưu, phiên bản cũ, chặn rời trang | PASS (Enter trong ô ngày lưu luôn: B1) | `03a`…`03i` |
| 4 | Sổ điểm: lọc theo URL, thêm và xóa điểm thủ công, step-up | PASS | `04a`…`04f` |
| 5 | Kỳ chốt: tạo nháp, xem trước, công bố, xóa nháp | PASS | `05a`…`05k` |
| 6 | Event hub: field BXH, cột BXH, gợi ý hạt giống | PASS | `06a`…`06h` |
| 7 | Lỗi console và màn hình 375px | PASS (chỉ có cảnh báo dev đã có sẵn; nút menu đè tiêu đề: B5) | `07a`…`07c` |

### Chi tiết

**1. Menu.** Nhóm "Xếp hạng" có đúng 4 mục. Trang chủ cũng có 4 thẻ tương ứng.

**2. Bảng xếp hạng**
- Tạo bảng `UITEST1` / "UI-TEST bảng đơn nam" (Đơn, Nam, để trống thời hạn) thì chuyển về danh sách. Cột Thời hạn hiện "365 ngày": API chép giá trị mặc định trong Cài đặt vào bảng lúc tạo.
- Lọc đều đúng và ghi lên URL:
  - Tìm "UI-TEST" ra 1 dòng.
  - Lọc Đôi ra MD, WD, XD.
  - Lọc "Đã ẩn" ra danh sách trống.
- Sửa thời hạn 365 → 180, sau đó 180 → 200: báo "Đã lưu…". Không có toast cảnh báo. Hợp lý, vì API chỉ trả `warnings` khi làm mới hoặc đưa job tính lại vào hàng đợi bị lỗi (`ranking-lists.service.ts:88-90`).
- Ẩn qua menu dòng: có hộp xác nhận "Ẩn "UI-TEST bảng đơn nam"?", toast "Đã ẩn…", trạng thái thành "Đã ẩn". "Hiện lại" có tác dụng ngay, không hỏi xác nhận.
- Có một lần trang tự nhảy sang `/ranking-snapshots` ngay sau khi Hiện lại. Chạy lại toàn bộ thao tác ẩn/hiện thì không lặp lại. Coi là nhiễu của lúc test, không ghi thành bug.

**3. Quy tắc điểm**
- Đổi Đơn/Đôi và Nhánh chính / Vòng loại / Vòng bảng đều cập nhật URL (`?draw=…&kind=…`):
  - Vòng loại có 4 dòng (QF-1…QF-4).
  - Vòng bảng có 9 dòng (GROUP, GROUP-1…8).
- Sửa ô R128 – Giải mở rộng (6 → 7): ô nền vàng nhạt, thanh dưới hiện "1 ô đã sửa". "Bỏ thay đổi" trả về 6 ngay, không hỏi.
- "Sao chép cột từ…" mở popover gồm nguồn, đích và nút "Sao chép". Đích tự loại cột nguồn. Chép cột "Giải vô địch" sang "Giải mở rộng" thì 8 ô đổi, thanh dưới hiện "8 ô đã sửa".
- Khi còn thay đổi chưa lưu, hộp "Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?" (Ở lại / Bỏ thay đổi) hiện khi:
  - bấm menu Sổ điểm;
  - đổi sang Đôi;
  - chọn phiên bản 01/01/2026.

  Bấm "Ở lại" thì URL, radio và các ô đã sửa giữ nguyên.
- Hộp lưu:
  - Tiêu đề "Lưu phiên bản quy tắc". Ngày mặc định 16/11/2026.
  - Câu ảnh hưởng: "Áp cho giải kết thúc từ 16/11/2026; 0 giải (0 nội dung) đang diễn ra hoặc chưa diễn ra sẽ tính lại; giải đã kết thúc giữ nguyên."
  - **Ngày trong quá khứ:** trên lịch, 01–15/11 bị tắt, từ 16/11 trở đi chọn được (`03f`). Bấm thẳng vào ô 10/11 hay gõ "10/11/2026" đều không nhận. Request vẫn gửi `effectiveFrom: "2026-11-16"`.
  - Lưu xong: toast "Đã lưu phiên bản quy tắc" (`03i`).
- Xem phiên bản 01/01/2026:
  - Có Alert "Đang xem quy tắc hiệu lực ngày 01/01/2026 · Về hiện hành". URL có `asOf=2026-01-01`.
  - Ô ở trạng thái `disabled`. Không còn thanh lưu và sao chép.
  - **Bấm phím mũi tên:** nhấn ArrowUp ×2 rồi ArrowDown ×3 trên ô R128, giá trị vẫn là 6 (`03h`).
- Ghi chú: chọn phiên bản "16/11/2026" (trùng hôm nay, cũng là phiên bản hiện hành) cũng ra chế độ chỉ xem. Không sai, chỉ hơi thừa vì đã có mục "Hiện hành".

**4. Sổ điểm**
- 5 bộ lọc (Bảng, VĐV, Giải, Nguồn, Hiệu lực) đều ghi `filters[...]` lên URL. Tải lại trang vẫn giữ. VĐV và Giải tìm phía server.
- Thêm điểm thủ công (UITEST1, KMT87868, 50 điểm, có lý do):
  - Hiện hộp "Nhập lại mật khẩu để tiếp tục". Xác nhận xong, toast "Đã thêm điểm thủ công".
  - Dòng mới có Tag "Thủ công", ngày đạt 16/11/2026, hết hạn 15/05/2027 (= +180 ngày, đúng thời hạn bảng lúc đó).
- Xóa dòng đó:
  - Hộp "Xóa 50 điểm của … ? Không hoàn tác được." Lý do 2 ký tự thì nút OK tắt, lý do đủ dài thì bật.
  - Toast "Đã xóa dòng điểm thủ công", dòng biến mất.
  - Lần xóa này không hỏi lại mật khẩu, vì step-up còn hiệu lực (`auth.stepUp.ttlMinutes` mặc định 5 phút, `docs/auth-and-rbac.md:166`).
- Thêm 2 dòng nữa (80 và 40 điểm) để làm dữ liệu cho kỳ chốt.

**5. Kỳ chốt**
- "Tạo bản nháp": mặc định "Tất cả bảng" và ngày hôm nay. Đã chọn **chỉ UITEST1**.
- Sau khi gửi: toast "Đã gửi yêu cầu tạo bản nháp", Alert "Đang dựng bản nháp (0/1)…". Khoảng 2 giây sau có dòng "Bản nháp · 2 VĐV".
- Trang xem trước (vào bằng Link, `/ranking-snapshots/:id`):
  - Có Descriptions và bảng hạng: 1 → 80, 2 → 40, cột Biến động "Mới".
  - Mở breakdown thấy "— — 80 16/11/2026 → 15/05/2027".
  - Tìm "Bạn Đôi" và "KMT87868" đều đúng, giá trị tìm ghi lên URL.
- Công bố:
  - Câu xác nhận "Công bố BXH UI-TEST bảng đơn nam ngày 16/11/2026? Trang công khai sẽ hiện bảng này; không sửa được sau khi công bố." Toast "Đã công bố bảng xếp hạng".
  - Trang sau khi công bố không còn nút ghi nào. Hiện "Đã công bố lúc 16:55 16/11/2026 bởi UI-TEST Admin" (`05h`).
  - Lần này không hỏi mật khẩu vì step-up còn hạn.
- Bản nháp thứ hai (cùng ngày):
  - Tạo được. Cột Biến động "—" (thứ hạng không đổi so với bản đã công bố).
  - "Xóa bản nháp" → "Xóa bản nháp này? Không khôi phục được sau khi xóa." → toast "Đã xóa bản nháp", quay về danh sách. Chỉ còn bản đã công bố.

**6. Event hub** (giải test e2e "Entries 98567b", đang là bản nháp)
- Tab "Nội dung thi đấu" có cột "Bảng xếp hạng".
- Sửa "Đơn nam – Entries 98567b":
  - Option chỉ có bảng Đơn (UI-TEST bảng đơn nam, Đơn nam (mẫu), Đơn nữ (mẫu)).
  - Không hiện "Gợi ý", vì có 2 bảng Nam không phân nhóm tuổi (MS mẫu và UITEST1) nên gợi ý không chọn được một bảng duy nhất. Logic này đúng (`use-ranking-list-options.ts:30`).
- Sửa "Đơn nữ": hiện "Gợi ý: Đơn nữ (mẫu) · Dùng". Bấm "Dùng" thì ô được điền. Sau đó bấm Hủy, không lưu.
- Wizard bốc thăm, bước Hạt giống, khi nội dung chưa gắn bảng: nút "Gợi ý theo BXH" bị tắt, tooltip "Nội dung chưa gắn bảng xếp hạng".
- Gắn tạm UITEST1 vào nội dung đó rồi mở lại wizard:
  - Nút bật. Modal "Gợi ý hạt giống theo BXH" ghi "Theo BXH UITEST1 công bố ngày 16/11/2026 · 2 hạt giống".
  - Cả 5 VĐV đều chưa có điểm (hạng "—", điểm 0), nên nút "Áp dụng" tắt.
  - Không bấm Áp dụng. Bấm Hủy, rồi bỏ gắn bảng (về "—").
- Chưa thử gợi ý trong wizard vòng loại.

**7. Lỗi console và 375px**
- Trang mới của phase 09 không có lỗi runtime. Các cảnh báo thấy được đều đã có trước phase 09:
  - `Instance created by useForm is not connected to any Form element`: thấy cả trên `/disciplines`, `/events` (có từ trước, khả năng cao đến từ thanh lọc dùng chung), lẫn `/ranking-lists`, `/ranking-points`, `/ranking-snapshots`, trang xem trước. `/ranking-rules` không có.
  - `[useForm] … pass the id prop`: cả trang sửa `/disciplines` lẫn `/ranking-lists` đều có. Đây là kiểu chung của form catalog.
  - `[antd: InputNumber] addonAfter is deprecated`: ở `ranking-list-form.tsx:54`. Cùng kiểu với `match-format-form.tsx:31-40` và `setting-value-editors.tsx:23`.
  - `403 POST /admin/ranking-points`: đây là bước đầu của step-up (`STEP_UP_REQUIRED`), mong đợi.
  - `Warning: There may be circular references`: xuất hiện một lần khi mở modal gợi ý hạt giống. Mở wizard khi chưa gắn bảng thì không có. Chưa xác định nguồn.
  - `404 /favicon.ico`, `401 /auth/me` trước khi đăng nhập: có từ trước.
- 375px:
  - Quy tắc điểm: `scrollWidth` 360 = `clientWidth` 360, trang không cuộn ngang. Lưới tự cuộn (`ant-table-content` 480/311, `overflow-x: auto`) (`07a`).
  - Xem trước kỳ chốt: trang 360/360, bảng tự cuộn 471/312 (`07b`).

## Bug

| ID | Mức | Bước | Mong đợi | Thực tế | File nghi ngờ |
|---|---|---|---|---|---|
| B1 | **Trung bình** | Quy tắc điểm → sửa 1 ô → Lưu → gõ ngày vào ô "Áp dụng từ ngày" rồi nhấn Enter | Enter chỉ xác nhận ngày. Phải bấm "Lưu phiên bản" mới lưu | Hộp đóng và **lưu phiên bản ngay**: PUT `/admin/ranking-rules/matrix` trả 200, `effectiveFrom` 2026-11-16 (ngày đã gõ là quá khứ nên bị bỏ, giữ hôm nay). Người dùng gõ ngày tương lai rồi Enter thì sẽ lưu luôn mà chưa đọc lại câu ảnh hưởng | `pages/ranking/ranking-rules-save-modal.tsx:104,110-112` (`Form onFinish={submit}`: Enter trong input submit form). Có thể chặn submit bằng Enter trong DatePicker, hoặc chỉ lưu khi bấm nút |
| B2 | Thấp (có từ trước) | Tạo hoặc sửa bảng xếp hạng | Toast "Đã tạo Bảng xếp hạng" | Toast "Đã tạo ranking-lists.ranking-lists" / "Đã lưu ranking-lists.ranking-lists" (`02a`) | `i18n/vi.ts:43`: Refine gọi `translate("<res>.<res>", resourceSingular)`, tức chuỗi mặc định nằm ở tham số thứ 2, nhưng `translate` lại coi tham số đó là `options`. Theo code thì mọi resource catalog đều bị (chưa tạo thử ở catalog khác để xác nhận) |
| B3 | Thấp (có từ trước) | Tạo bảng, để trống "Thứ tự hiển thị" (gợi ý ghi "Bỏ trống để xếp cuối") | Bảng xếp cuối | Lưu `order = 0`, bảng **xếp đầu** danh sách (trước MS=1) | Schema `rankings.prisma:16` `@default(0)`. Các catalog khác cùng kiểu (`tournament-catalog.prisma` `@default(0)`) với cùng câu gợi ý |
| B4 | Thấp | Breakdown của dòng điểm thủ công trong trang xem trước kỳ chốt | Nhận ra được đây là điểm thủ công (vd "Thủ công" + lý do) | Chỉ hiện "— —" ở cột Giải và Vòng (`05f`) | `pages/ranking/snapshot-*` (phần breakdown) |
| B5 | Thấp (có từ trước) | Màn 375px, mọi trang | Tiêu đề và link quay lại không bị che | Nút mở menu (góc trái) đè lên chữ đầu tiêu đề và mũi tên "← Kỳ chốt" / "← Danh sách giải" (`07a`, `07b`, `07c`) | Layout chung `layout/admin-layout*` |
| B6 | Thấp | Sổ điểm đang lọc theo bảng UITEST1 → "Thêm điểm thủ công" | Ô "Bảng xếp hạng" điền sẵn bảng đang lọc | Ô để trống | `pages/ranking/manual-points-form.tsx` (gợi ý UX, không phải lỗi) |

Các thay đổi sau code review đã kiểm và đều đúng:
- Ngày quá khứ bị tắt trong hộp lưu.
- Phiên bản cũ ở chế độ chỉ xem, phím mũi tên không đổi giá trị.
- Trang xem trước dùng id trên URL.
- "Gợi ý theo BXH" tắt khi nội dung chưa gắn bảng.

Chưa kiểm:
- Trạng thái đang tải của "Tính lại ngay": không có nội dung nào chưa tính lại (số đếm 0).
- Gợi ý trong wizard vòng loại.

## Dữ liệu test còn lại (DB `localhost:5433/kamito_tt_dev`)

| Loại | Chi tiết | Gỡ được? |
|---|---|---|
| Tài khoản | `ui-test-admin@example.com` "UI-TEST Admin" (ADMIN), do dispatcher tạo | Có, khóa hoặc xóa qua "Tài khoản nhân viên" |
| Bảng xếp hạng | `UITEST1` "UI-TEST bảng đơn nam", id `40ecf596-2e15-4191-9fcd-22fc1ed7f3da`. Đơn, Nam, thời hạn hiện 200 ngày, order 0, đang hiện | Có thể ẩn. Khó xóa vì đã có kỳ chốt công bố. **Lưu ý:** khi bảng này còn hiện, hint gợi ý bảng cho nội dung Đơn nam không còn xuất hiện (vì có 2 bảng khớp) |
| Điểm thủ công | 2 dòng trên UITEST1: KMT87868 = 80, KMT114046 = 40, lý do "UI-TEST điểm cho kỳ chốt". Thêm 1 dòng 50 điểm đã xóa (còn trong nhật ký thao tác) | Có, xóa trong Sổ điểm |
| Kỳ chốt | **Đã công bố**: id `2e0f3e7a-db8d-410a-9fc5-cf53e12f364b` (UITEST1, 16/11/2026). Không đổi được do trigger DB. Bản nháp thứ hai `354d0e03-…` đã xóa | Không |
| Quy tắc điểm | Đơn · Nhánh chính · ô **R128 × "Giải mở rộng"** (eventTypeId `5d56045e-f5c0-4c96-9bdc-9c6ea46e60cb`). Lưu lần 1: 6 → 7, áp dụng từ **2026-11-16** (qua lỗi B1). Lưu lần 2 (bấm nút): 7 → 6, cùng ngày 2026-11-16. Còn lại phiên bản "16/11/2026" với giá trị 6, bằng phiên bản 01/01/2026. Không ô nào khác đổi giá trị | Giá trị đã về như cũ. Chỉ còn dòng phiên bản ngày 2026-11-16 |
| Nội dung thi đấu | "Đơn nam – Entries 98567b" (sub-event `22f6ba65-7cb1-4bf7-bd29-45f297b978bd`, giải test e2e): gắn UITEST1 rồi bỏ gắn, hiện là "—" | Đã trả lại như cũ |
| Nhật ký thao tác | Có log cho mọi thao tác trên | Không cần xử lý |

## Dọn dẹp

- Đã tắt api, worker, admin và helper. Port 3000, 3010, 5173, 47913 đã trống. Đã đóng trình duyệt Playwright.
- Không sửa code ứng dụng. Không đổi git state. Chỉ thêm report này và thư mục `screenshots-261116-phase-09/` (43 ảnh, có `00-login-blocked.png` của lần trước).
