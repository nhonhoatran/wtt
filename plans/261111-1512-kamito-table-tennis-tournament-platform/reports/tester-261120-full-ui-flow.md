# Kiểm thử luồng quản trị giải đủ tám bước — 2026-11-20

## Trạng thái hiện tại

Đã đối chiếu kịch bản tám bước tại [phase 12](../phase-12-english-seo-hardening-and-launch.md). Đã bổ sung mã kiểm thử trình duyệt và sửa thiếu thao tác rút VĐV vòng bảng. **Bốn lượt desktop đầu chưa đạt; lượt bốn hoàn tất bước 1–5, có 52 mẫu refresh công khai, rồi lỗi helper đóng drawer ở bước 6. Chưa có kết luận E2E đạt.** Cleanup cả bốn lượt đạt. Ngoài lỗi helper, trace phát hiện lỗi sản phẩm giữ nhầm cấu hình vòng loại giữa hai nội dung; đã sửa hẹp và bổ sung assertion hồi quy, chờ lượt chạy mới chứng minh.

Không thay thế cổng staging, quyết định nghiệp vụ G1/G2 hoặc nghiệm thu của BTC. Số lượng, điểm và thể thức dưới đây là dữ liệu kiểm thử mẫu riêng, không sửa mặc định nghiệp vụ chung.

## Phạm vi và cách chứng minh

- Test chính: `apps/client/tests/admin-full-flow/full-tournament.spec.ts`; cấu hình `apps/client/playwright.admin-full-flow.config.ts`. Mỗi lần chỉ chạy một project `desktop` 1440 hoặc `mobile` 390, với reference world mới và cleanup riêng; không lấy smoke mobile thay luồng đầy đủ.
- `ADMIN` và `RESULTS_OPERATOR` đăng nhập qua form thật. Tạo/sửa giải, nội dung, upload/kiểm tra/quyết định/commit Excel, bốc thăm/công bố/thay VĐV, session/xếp lịch, nhập/sửa/mở lại kết quả, rút VĐV, xếp suất, snapshot và quy tắc đều qua thao tác UI.
- Setup API chỉ tạo tài khoản, catalog/luật/venue/bảng xếp hạng riêng và hai file Excel. Không seed sẵn giải, entry, draw, kết quả hoặc snapshot dùng để giả vượt bước UI. Worker chỉ dùng production processors import/ranking/revalidate trong UUID namespace riêng, không chạy scheduler quét chung.
- Ngoại lệ có khai báo: nút mở lại bị ẩn với operator đúng RBAC. Test xác nhận UI ẩn rồi gửi **một yêu cầu bổ sung từ browser context của operator** để kiểm HTTP 403; không gọi đó là thao tác UI của nút bị cấm.
- UI response được đọc để chọn bản ghi và lưu ID cleanup. Journal lưu sau mỗi bước và ngay khi tạo đối tượng. Credentials chỉ ở manifest ignored, không in báo cáo/stdout.
- Public match được mở/nóng trước mỗi lần chốt và sửa tỷ số; test tải lại trang thật, kiểm từng ô điểm và trạng thái trong tối đa 5 giây. Không bấm “Làm mới trang công khai” hoặc gọi tay revalidation sau mutation.

## Trình tự tám bước

1. Tạo giải kết thúc hôm qua, MS knockout có vòng loại và WD vòng bảng. Import 40 đăng ký MS và 12 cặp WD, xử lý một dòng cần xác nhận.
2. MS có 32 VĐV vòng loại, 8 VĐV trực tiếp và 8 suất vòng loại: 24 trận vòng loại + 15 trận nhánh chính = 39. WD có bốn bảng ba cặp, hai cặp đi tiếp mỗi bảng và nhánh chính tám cặp. Công bố bốn draw và giải, thêm entry thay thế bằng UI, thay một VĐV chưa thi đấu.
3. Tạo session, tự tay xếp ba trận bằng nút chọn trận/“Xếp vào đây”, mở trang phiếu trận và xuất PDF qua Chromium print thật.
4. Operator chốt vòng đầu vòng loại và các trận bảng sẵn sàng; sửa điểm một trận cùng người thắng; UI ẩn mở lại, yêu cầu bổ sung trả 403.
5. Giữ vòng kế của một trận vòng loại chưa đấu để ADMIN xem tác động downstream, nhập lại mật khẩu, mở lại và chốt lại. Giữ một trận bảng chưa chốt để rút một VĐV theo private rule `KEEP_PLAYED_RESULTS`: preview và commit phải tạo walkover + tính lại bảng, không hủy kết quả đã đấu.
6. Hoàn tất vòng loại, xếp tám suất vòng loại và suất đi tiếp từ bảng; chỉ sau đó chơi MAIN tới hai trận chung kết. Không chốt MAIN sớm vì sẽ khóa cấu trúc trước placement.
7. Tạo và công bố hai snapshot tại ngày kết thúc giải cũ; kiểm thứ tự công khai và breakdown theo luật mẫu.
8. Sửa một ô W trong ma trận MS áp dụng từ ngày hôm nay do server trả về. Tạo giải nhỏ mới kết thúc hôm nay qua UI, cho hai VĐV cũ thi đấu, tạo/công bố snapshot hôm nay; breakdown giải cũ phải giữ điểm cũ, giải mới dùng điểm mới. Không giả clock hoặc sửa snapshot đã công bố.

Các bước 4–6 giữ đúng quan hệ phụ thuộc: trận chưa đủ suất không thể chốt trước placement; một downstream và một trận bảng được dành lại để bước 5 kiểm tác động thật. Báo cáo kết quả sẽ giữ rõ thứ tự này.

## Thiếu UI đã xác định và sửa hẹp

Trước sửa, `DrawPanel` chỉ nối thao tác entry cho knockout; `GroupCard` có tính lại BXH/phá hòa nhưng không có nút rút, trong khi `GroupWithdrawalService` đã hỗ trợ luật cấu hình. Không dùng PATCH trạng thái entry chung thay cho endpoint rút draw có transaction và tác động.

- `apps/admin/src/pages/event-hub/group-card.tsx:83`: native button có tên entry/bảng rõ, không hiện cho entry đã rút; table cuộn trong vùng riêng khi có thêm cột thao tác.
- `apps/admin/src/pages/event-hub/group-tables-view.tsx:26`: chỉ cấp khả năng rút khi có quyền cập nhật và draw đã công bố.
- `apps/admin/src/pages/event-hub/draw-panel.tsx:94`: callback group member mở modal sẵn có.
- `apps/admin/src/pages/event-hub/draw-entry-action-modal.tsx:39`: group member luôn là rút, không mở thay VĐV; dùng đúng `entryId`, `expectedVersion`, lý do và `dryRun`; query key chứa entry ID để không dùng nhầm preview của thành viên khác.

Không sửa backend policy, schema, root `.env`, G1/G2, CSP frontend hoặc default catalog trong gói UI này. Root đã đọc độc lập delta bốn file và chưa thấy blocker static; runtime còn cần luồng thật.

Nhãn hành động mới “Rút khỏi bảng” và tên truy cập của nút theo mẫu nhãn tĩnh hiện có của admin. Đây là ngoại lệ copy giao diện ít thay đổi: admin chưa có registry i18n, nên không thêm bảng CRUD DB chỉ để quản lý nhãn nút hoặc refactor hàng loạt ngoài phạm vi. Không gọi nhãn này là cấu hình động. Luật rút, điểm, thể thức và ngày hiệu lực vẫn đọc cấu hình DB/reference riêng.

## Kiểm tra tĩnh đã thực hiện

| Lệnh | Kết quả đã đọc |
|---|---|
| `pnpm --filter @kamito/admin typecheck` | exit 0 sau delta group action ban đầu |
| `pnpm --filter @kamito/admin lint` | exit 0 sau delta group action ban đầu |
| `pnpm --filter @kamito/admin test` trên Windows PATH ban đầu | 25/29 đạt, bốn lỗi `spawnSync sh ENOENT` ở kiểm shell entrypoint; không coi là lỗi assertion sản phẩm |
| Thêm `C:\Program Files\Git\bin` vào PATH tiến trình, chạy lại cùng admin test | 29/29 đạt, exit 0; không sửa/skip test |
| `pnpm --filter @kamito/client exec vitest run tests/unit/admin-group-withdrawal.test.ts` | bốn kiểm SSR đạt; native action, entry đã rút, capability ẩn, standing không còn member |
| Typecheck test SSR lần đầu | phát hiện callback test chưa giữ generic `DrawCall`; đã sửa callback fixture, không sửa API/product để né typecheck |
| Playwright `--list` với config riêng | liệt kê đúng một test desktop; chỉ kiểm discovery, chưa tính E2E sản phẩm đạt |
| `pnpm --filter @kamito/client exec tsc --project tsconfig.admin-full-flow.json --noEmit` | exit 0; kiểm cả helpers, Playwright config và Vite test config |
| ESLint riêng toàn bộ helpers, hai file unit và config mới | exit 0 |
| Unit cuối `admin-group-withdrawal.test.ts` + `admin-full-flow-guard.test.ts` | 9/9 đạt, gồm bốn SSR và năm guard không dùng mạng/DB |
| Admin typecheck + lint + Vite production build qua config riêng | exit 0; giữ cảnh báo chunk lớn của bundle, không hạ ngưỡng/ẩn cảnh báo |
| Playwright `--list` với `E2E_FULL_UI_PROJECT=mobile` | đúng một test mobile; chưa chạy trình duyệt trên sản phẩm |

Review độc lập của root phát hiện một lỗi trong assertion test trước runtime: xếp hạng có đồng điểm nên không được đòi rank liên tiếp 1,2,3. Test đã sửa theo competition rank 1,1,3 từ engine thật và đọc toàn bộ các trang snapshot qua UI; công khai đối chiếu từng dòng đang hiển thị theo thứ tự `rank ASC, playerId ASC` chung của hai query, không suy toàn bộ thứ tự từ dòng đầu. Phần sửa tỷ số cũng kiểm điểm cũ công khai trước mutation. Không đổi engine để phục vụ test.

## Runtime desktop lượt đầu — giữ bằng chứng lỗi

- UUID `41f54572-0abd-4353-825f-6687ac41a78e`, thư mục `test-results/261120-full-ui-desktop-41f54572-0abd-4353-825f-6687ac41a78e/`.
- Setup exit 0; API 3371 PID 31256, admin 3372 PID 12844, client 3373 PID 9228 đều health 200; workers UUID ready lúc `2026-11-20T08:04:11.913Z`.
- Browser một test desktop **không đạt sau 18,1 s**, tại bước 1 trước mutation tạo giải. `error-context.md` có accessible name thực `save Lưu nháp`; test tìm exact `Lưu nháp` nên không thấy nút. Installed Refine `SaveButton` có `SaveOutlined` với tên SVG, không phải app đổi/mất nhãn.
- Đã sửa locator suffix cho các action có icon Save/Plus/Upload/Printer trong cả tám helpers, sau khi đọc component thật. Không đổi copy/app để khớp test. Modal confirm và match actions không có icon giữ exact. `uiResponse` chờ action + response bằng `Promise.all` để không phát lỗi timeout thứ hai không được consume khi click lỗi. Dedicated typecheck, scoped lint và discovery sau sửa đều exit 0.
- Không có giải/import/draw/bước core nào được ghi hoàn tất. `full-ui-worker-stopped.json` xác nhận stopped true, failures rỗng, ba queue không có job; `full-ui-cleanup.json` xác nhận mười nhóm hậu kiểm đều 0. `result.json`: cleanup passed, `.env` hash không đổi, cleanupErrors rỗng. Không diễn giải lượt lỗi này là pass sản phẩm hoặc lỗi sản phẩm.

Lượt chạy mới phải dùng fresh UUID sau cleanup; giữ nguyên log, JSON, ba ảnh và trace của lượt đầu. Packet runtime tiếp theo sẽ được bổ sung sau khi đọc output thực.

## Runtime desktop lượt hai — control Select có giá trị sẵn

- UUID `a9c28329-027a-4f88-9b49-f120f7c59123`, cùng cấu trúc thư mục artifact. Browser không đạt sau **19,5 s** tại bước thêm nội dung; giải đã được tạo qua UI, journal giữ đúng ID.
- Raw log chỉ rõ input combobox `matchFormatId` thấy/enable nhưng span giá trị hiện tại “5 ván, 11 điểm, cách 2” chặn pointer của `field.click()`. Đây là cách dùng helper chưa phù hợp Ant Design preselected Select; không có lỗi API được báo trong bước này.
- Shared `pickOption` đã đổi sang focus + phím ArrowDown để mở control bằng bàn phím, sau đó điền search và bấm option đang hiển thị. Áp dụng cho control rỗng/có giá trị sẵn/không search; không dùng force click hoặc evaluate click. Typecheck và lint sau sửa exit 0.
- `full-ui-cleanup.json` xác nhận journalEvents 1, cleanupEvents 1, mười nhóm hậu kiểm 0; `result.json` cleanup passed, envUnchanged true, cleanupErrors rỗng. Giữ log/error-context/ba ảnh/trace, không ghi đè bằng lượt sau.

## Runtime desktop lượt ba — hợp đồng mở lại kết quả

- UUID `78c18e19-1776-48ac-936b-d49de3794d24`; browser hoàn tất bước 1–4 rồi không đạt ở bước 5 sau khoảng 3,2 phút. Đã thực hiện import 40 MS + 12 WD, bốn draw, thay VĐV, lịch ba trận, kết quả operator, sửa tỷ số và kiểm 403. Journal giữ 28 lần refresh công khai, từ 467 đến 966 ms.
- Assertion test đòi selected match trở về `SCHEDULED`, trong khi service thật `apps/api/src/modules/match-results/match-reopen.service.ts` đặt `LIVE`, xóa tổng điểm/người thắng nhưng giữ từng ván để sửa. Chỉ downstream trở về `SCHEDULED`. Đây là kỳ vọng test sai; review static trước đó cũng chưa phát hiện, runtime đã bắt đúng.
- Đã sửa assertion `LIVE`, fields kết quả null, games giữ nguyên, version tăng và downstream `CLEAR_SIDE/SCHEDULED`; warm-up trước reconfirm dùng nhãn “Đang đấu”. Không thay engine hoặc service để khớp test.
- Đọc PDF bằng pypdf và mở ảnh trang in: ba phiếu nằm trên hai trang A4 (2 + 1), không có trang đầu trắng. Không tuyên bố mỗi trận một trang.
- `result.json` và cleanup hậu kiểm: mười nhóm về 0, envUnchanged true, cleanupErrors rỗng. Giữ nguyên trace/ảnh/log trước sửa.

## Runtime desktop lượt bốn — drawer tự đóng và lỗi cấu hình được phát hiện

- UUID `cbf43ba1-c9ef-4552-9874-820a97cdd8e3`; browser hoàn tất bước 1–5, gồm preview tác động thật, nhập lại mật khẩu, mở lại/reconfirm và group withdrawal sinh `WALKOVER`. Bước 6 đang chốt các trận cuối thì `closeDrawer` bấm đúng lúc drawer tự đóng: phần tử chưa ổn định rồi detach, hết 15 giây. Đây là race helper, không mở lại drawer hoặc force click để né.
- Journal giữ 52 lần refresh công khai từ 387 đến 1010 ms; chưa có snapshot hoặc kết luận đủ tám bước. Cleanup mười nhóm về 0, envUnchanged true, cleanupErrors rỗng.
- Helper đóng đã giới hạn thời gian click; nếu click lỗi thì bắt buộc assert drawer thật sự ẩn. Drawer còn mở vẫn làm test không đạt.
- Ảnh bước 5 hiện WD có tab vòng loại ngoài dự kiến. Đã đối chiếu trace R03: bulk tạo MS/WD đều `hasQualifying=false`, nhưng sau sửa MS thành true, PATCH của WD cũng gửi true dù test không bật. Root cause tại `SubEventEditModal`: `Form.useForm()` còn sống ngoài Modal, `destroyOnHidden` không xóa store mặc định preserve. Đã thêm `preserve={false}` theo convention modal khác; regression trình duyệt kiểm giá trị ban đầu của từng record, giá trị trước lưu và response PATCH (MS true, WD false), không chủ động ép WD false để che lỗi.
- Reviewer độc lập phase08 đọc installed Ant Design 5.29.3 và rc-field-form 2.7.1: `setInitialValues` merge store cũ; `destroyForm` ghi các field không preserve để lần mount sau lấy initialValues mới. Xác nhận sửa một dòng phù hợp lifecycle; runtime hồi quy còn chờ lượt mới.
- Cùng batch test: lọc snapshot qua UI theo private `listId` trước tạo, lắng nghe job GET trước POST để không bỏ completion nhanh, và bấm link đúng snapshot ID. Không dùng request API trực tiếp để mở snapshot, không suy từ dòng cùng tên đầu tiên.
- Typecheck admin + dedicated test, lint scoped và 9/9 unit đều đạt sau batch; Vite admin build exit 0, giữ cảnh báo chunk lớn. Không build Next hoặc đổi backend ở batch này. Từ lượt tiếp theo: handshake READY → START, source giữ nguyên tới browser exit và runner ghi hash trước/sau.

## Ranh giới an toàn trước runtime

Target được cho phép duy nhất: `localhost:5433/kamito_tt_phase12_test`. Chạy dưới `APP_ENV=test`, lease rõ, prefix `kamito-tt:test:full-ui:<UUID>` và origin API/admin/public riêng `3371/3372/3373`. Manifest/journal bắt buộc thuộc root `test-results`, cleanup theo IDs của lượt chạy; worker đóng trước khi obliterate queue UUID, không quét/xóa queue chung. PostgreSQL và Redis dùng chung phải được giữ nguyên dịch vụ.

Không stage/commit/push. File Word untracked không thuộc phạm vi. Chưa đánh dấu hoàn thành luồng tám bước khi chưa có kết quả trình duyệt và hậu kiểm dọn dữ liệu.

## Tiếp tục ngày 2026-11-21

- Lượt desktop `1c79929f-4523-4bb4-80fc-0b9640adad9b` trước đó hết thời gian chờ API, chưa khởi chạy trình duyệt. Hậu kiểm riêng theo UUID trong `full-ui-cleanup.json` xác nhận cả 10 nhóm về 0.
- Lượt desktop `c074686c-bad0-453a-b7fb-c458f661f606` hoàn tất bước 1–6, gồm xếp người vượt vòng loại vào nhánh chính và chốt hai trận chung kết. `run.json` ghi 59 lần cập nhật công khai, 305–824 ms. Bước 7 dừng khi chọn danh sách xếp hạng: tùy chọn đúng đã xuất hiện nhưng biến mất trước khi Playwright bấm được (`browser.log`). Chưa có bằng chứng xuất bản snapshot hoặc bước 8 trong lượt này.
- `result.json` xác nhận `.env` không đổi, dọn thành công; `full-ui-cleanup.json` xác nhận cả 10 nhóm về 0, đã dọn 198 khóa Redis theo lượt. Các cổng 3371–3373 không còn listener sau lượt này.

## Tiếp tục xác minh bước 7–8 ngày 2026-11-21

- Lượt `d519e7d8-89f0-469e-8263-140b814545c9` đạt bước 1–6; bước 7 vấp khi chọn list xếp hạng. Lượt `06aa5335-4a3a-4b66-8dc6-9b3c00b2e309` tiếp tục dừng ở bước 7: menu ảo hóa dùng listbox accessibility ẩn; nút mũi tên qua locator không cập nhật mục active. Cả hai lượt cleanup đạt.
- Lượt `7a2989ad-ada9-4546-bc05-2814dd1ed352` đạt bước 1–6, sau đó dừng ở bước 7 vì request lọc list không phát ra khi menu ảo hóa chưa được chọn. Trace chỉ ra menu `rc-select` điều khiển một listbox hỗ trợ truy cập có chủ ý bị ẩn; popup hiển thị riêng. Cả lượt cleanup đạt.
- Lượt `d3e3db24-b910-4345-9677-2f0982a571f8` vượt qua bước 7, dừng ở bước 8 trước thao tác thêm VĐV vì selector `Thêm VĐV` trùng hai input. Snapshot cho thấy cùng một panel có hai hàng đơn; nguyên nhân duplicate chưa được chứng minh. Cleanup đạt.
- Lượt `bf920c53-c143-4841-9bb7-8a96d03629f5` dừng sớm ở bước 3: UI chọn nội dung thi đấu trước khi request thông thường tải xong danh sách. Test được đồng bộ với request thật của UI.
- Lượt `8689cfd1-4fd9-4225-bf21-a7482731bb53` đạt bước 1–7. Bước 8 thêm người đầu tiên thành công; lượt toàn luồng dừng khi chờ lần tra cứu tiếp theo. Không kết luận test bắt đầu quá sớm là nguyên nhân sản phẩm.
- Lượt `80bab70c-fb89-40d6-acb8-6deb2febe1da` ghi nhận POST 201, GET danh sách và bộ đếm 200, trong khi snapshot cuối vẫn thấy nút loading quá 15 giây. Chẩn đoán tập trung một thao tác riêng sau đó (`35179d38-c5dd-40fe-a90f-56bdf2cef319`) ghi `onAdded`, invalidation, refetch bộ đếm, `saving-cleared` và submit đều hoàn tất trong khoảng 40 ms; nút ở DOM cuối không loading. Vì vậy giả thuyết promise còn chờ trong `onAdded()` không được xác nhận và không dùng làm root cause.
- Lượt chẩn đoán tiếp (`15a0a605-e82c-4f7e-818a-4ce2fddb926b`) chưa gửi POST: chờ GET tra cứu hết thời gian. Snapshot DOM đã lọc cho thấy hai input chọn VĐV và hai nút thêm dưới panel MS; cả hai input rỗng, nút đều disabled/non-loading, input đầu được focus. API fixture xác nhận nội dung MS là SINGLES, còn source có một call-site `<AddEntryForm>`. Có hiện tượng duplicate UI control nhưng nguồn duplicate chưa xác định. Cleanup cả hai lượt chẩn đoán đạt; không thay mã sản phẩm.
- Helper full-flow giờ kiểm tra đúng một input và một nút thêm cho nội dung đơn; không chọn phần tử đầu để che duplicate. Typecheck, ESLint và Playwright discovery đạt; chưa chạy lại luồng tám bước.
- Chưa có lượt đủ tám bước. Không đóng checkbox E2E; giữ các trace và receipt riêng theo UUID, không ghi đè artifact.

## Hoàn tất ngày 2026-11-24 — đạt đủ tám bước desktop + mobile

**Kết quả:** trên cùng bản build cuối, lượt desktop `b617886c-4311-41e5-8fe5-5b22e4f62b52` (4,7 phút) và mobile `dcbe5f6f-31c1-477e-b2c9-1b4b1d06cb80` (4,6 phút) đều **1/1 đạt đủ tám bước**, cleanup đạt (10 nhóm hậu kiểm về 0; xóa 206/219 khóa Redis theo UUID), `.env` không đổi, manifest source trước/sau browser khớp. Refresh công khai: desktop 60 lần 272–761 ms, mobile 60 lần 254–594 ms. Target duy nhất `localhost:5433/kamito_tt_phase12_test` (đã xác nhận trước khi chạy), Redis local prefix UUID.

### Lỗi sản phẩm tìm ra và đã sửa

1. **Duplicate "Thêm VĐV" (nguồn chưa xác định ở lượt trước):** `entries-tab.tsx` để `AddEntryForm` và `EntryTable` là hai sibling cùng `key={selected.id}`. React `mapRemainingChildren` ghi đè fiber cùng key nên fiber `AddEntryForm` cũ không nằm trong map và không bị xóa → mỗi lần re-render để lại một form thừa trong DOM (build production không cảnh báo). Sửa: key `add-${id}` / `table-${id}`. Reviewer độc lập đối chiếu source React xác nhận cơ chế. Lượt desktop `d4caaeeb…` và các lượt sau qua bước 2/8 không còn duplicate.
2. **Admin tràn ngang ở 390 px:** chỉ 3/31 bảng antd có `scroll.x`; bảng "Nội dung thi đấu" 9 cột đẩy nút "Sửa" ra ngoài khung (lượt mobile `94a86621…`). Thêm `scroll={{ x: true }}` cho 29 file bảng còn thiếu; giữ `max-content` ở 3 bảng có sẵn. Ban đầu dùng `max-content`, review chỉ ra nó tắt xuống dòng trên desktop (audit log JSON, cột ellipsis liên hệ) nên đổi sang `x: true`.
3. **Menu nội dung chiếm chỗ ở 390 px:** tab Danh sách/Bốc thăm/Lịch để side panel rộng cố định 260 px cạnh nội dung, còn ~66 px cho phần chính, tab "Vòng loại" bị đè (lượt `267e8741…`). Thêm `side-menu-layout.tsx` (`Grid.useBreakpoint().md`): từ md trở lên giữ hai cột (lịch vẫn sticky), dưới md xếp panel lên trên; panel lịch giới hạn 50vh. Cấu trúc cây không đổi khi đổi breakpoint nên không remount DnD/bảng (review xác nhận theo source antd 5.29.3).

Admin typecheck/lint/build đạt; admin test 29/29 (PATH có Git `sh`).

### Lượt không đạt trong ngày — giữ nguyên artifact

| UUID | Kết quả | Nguyên nhân |
|---|---|---|
| desktop `07189a8d…` | setup lỗi, không ghi DB (`owned` rỗng) | Container PostgreSQL/Redis Kamito đã dừng; bật lại đúng hai container cũ, giữ volume |
| desktop `d4caaeeb…` | bước 4, `ERR_CONNECTION_REFUSED` cổng 3373 sau 20 trận refresh đạt | Next local mất listener, log không có lỗi |
| mobile `94a86621…`, `267e8741…` | bước 1, bước 2 | Lỗi sản phẩm 2 và 3 ở trên |
| mobile `a2d3d797…` | bước 1, `ERR_CONNECTION_REFUSED` cổng 3372 | Admin preview mất listener sau đăng nhập đạt |
| mobile `3f4b85c0…` | bước 1, `ERR_CONNECTION_RESET` cổng 3372 ngay sau PATCH 200 | Như trên |

Ba lượt mất listener không có log crash và không có Windows event. Trên máy có phiên Claude khác chạy song song, nhưng **chưa chứng minh nguyên nhân**. Không retry trong test; mỗi lần là một lượt mới UUID mới, cleanup đều đạt. Lượt `282a6ed6…` (desktop) và `5b76b173…` (mobile, bản `max-content`) cũng đạt, nhưng không tính là bằng chứng code cuối.

**Ranh giới:** đây là luồng tám bước trên dịch vụ local thật, không thay nghiệm thu staging, M1/M2, G1/G2 hoặc BTC.
