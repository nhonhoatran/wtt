# Spike B - Refine 5 + @refinedev/antd + antd 5 - Kết quả

Ngày chạy: 2026-11-12. Thư mục spike: `spikes/refine-antd/` (ngoài workspace, `pnpm install --ignore-workspace`; `git status` chỉ thêm `spikes/`, root lockfile không đổi).

## Kết luận

**ĐẠT - tiếp tục dùng Refine** (không cần antd 6, build sạch lỗi). 18/18 kiểm tra tự động qua trình duyệt thật (Chromium + Playwright 1.65) PASS ở lần chạy cuối. Có 1 điểm hạ tầng cần xử lý riêng: upload trực tiếp từ trình duyệt lên S3 cục bộ bị chặn CORS (mục 4.6), không phải lỗi Refine/antd.

## 1. Phiên bản đã cài

| Gói | Phiên bản | Ghi chú |
|---|---|---|
| react / react-dom | 19.3.1 | khớp apps/admin |
| antd | 5.29.3 | khớp apps/admin (6.7.0 có sẵn, không dùng) |
| @refinedev/core | 5.0.12 | dist-tag latest |
| @refinedev/antd | 6.0.3 | peer `antd ^5.23.0`; dependencies kéo thêm `@ant-design/pro-layout`, `react-markdown`, `sunflower-antd` (beta) |
| @refinedev/react-router | 2.0.4 | cần để menu/điều hướng; peer `react-router ^7.0.2` |
| react-router | 7.18.5 | phải ghim v7 (xem mục 5) |
| @tanstack/react-query | 5.107.1 | |
| @ant-design/v5-patch-for-react-19 | 1.0.3 | thêm cho React 19 (mục 4.8) |
| vite / @vitejs/plugin-react / typescript | 8.3.5 / 6.1.2 / 6.0.3 | khớp admin |

## 2. License + bảo trì

Giấy phép đọc bằng `pnpm licenses list` (từ package đã cài); ngày publish từ `npm view ... time.modified`; repo từ `gh api repos/refinedev/refine`.

| Gói | License | Publish gần nhất | Ghi chú bảo trì |
|---|---|---|---|
| @refinedev/core 5.0.12 | MIT | 2026-04-20 (release GitHub 2026-04-02) | không deprecated |
| @refinedev/antd 6.0.3 | MIT | 2025-10-23 (6.0.1 -> 6.0.3 trong 2 tháng) | **>12 tháng chưa có bản mới**, không deprecated |
| @refinedev/react-router 2.0.4 | MIT | 2026-04-20 | |
| @tanstack/react-query 5.107.1 | MIT | 2026-11-06 | |
| antd 5.29.3 | MIT | (6.7.0 modified 2026-11-04) | 5.x vẫn được hỗ trợ |
| @ant-design/v5-patch-for-react-19 | MIT | 2026-04-02 | |

Repo refinedev/refine: MIT, không archived, push cuối 2026-09-10, 66 issue mở, ~36k sao, 5 maintainer trên npm.

## 3. Cách dựng

- Data provider: `src/data-provider.ts` (54 dòng, <=120). Map: `pagination.currentPage/pageSize` -> `page,pageSize`; `sorters` -> `sort=-field,field2`; filter field `q` -> `q=`; filter khác -> `filter[field]=a,b`; trả `{data,total}`; lỗi HTTP -> `HttpError{statusCode,message,errors}`.
- API stub: Express 5 + `pg` (`server/server.mjs`), whitelist cột sort/filter, tham số hóa SQL.
- DB (in trước khi chạy, dòng `DATABASE_URL=` không comment trong `.env`, đã được duyệt): `host=localhost:5433 db=kamito_tt_dev schema=spike_refine`. Chỉ schema `spike_refine`, bảng `player`, 200 dòng seed; không đụng `public`/packages/db. Dữ liệu test sinh thêm trong lúc chạy đã xóa sạch (`cleanup: deleted 1 test rows`).
- Upload: presign bằng `@aws-sdk/s3-request-presigner` tới S3 cục bộ. **Cổng dùng là 9010** (`S3_ENDPOINT` trong `.env`), không phải 9000 như đề bài. Cổng 9000 cũng trả 200 ở `/minio/health/live` nhưng không phải endpoint của dự án. Dịch vụ ở 9010 thực chất là **RustFS 1.0.4**, không phải MinIO (`curl /minio/health/live` -> `{"service":"rustfs-endpoint",...,"version":"1.0.4"}`).

## 4. Từng tiêu chí

Lệnh kiểm: `CHROME_PATH=<chrome.exe> node --env-file=../../.env e2e/check.mjs` (log request: `e2e/requests.log`, ảnh: `e2e/shots/`).

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|---|
| 4.1 | Bảng antd phân trang/sắp xếp/lọc/tìm phía server | PASS | Tải đầu: `GET /api/players?page=1&pageSize=10&sort=-created_at` (10 dòng/200). Sang trang 2: `page=2&...`. Bấm cột Họ tên: `sort=full_name`, bấm lần 2: `sort=-full_name`. Tìm: `...&q=Player+07`. Lọc trạng thái: `...&filter[status]=banned`. Mỗi thao tác = 1 request mới, luôn `pageSize=10`, không tải hết. URL trình duyệt đồng bộ (`syncWithLocation`): `?pageSize=10&currentPage=1&sorters[0][field]=...&filters[0][field]=status&filters[0][operator]=in&filters[0][value][0]=banned`. |
| 4.2 | `ConfigProvider locale={viVN}` | PASS (sau chỉnh import) | Phân trang `10 / trang`; trạng thái rỗng `Trống`. **Lưu ý import**: `import viVN from 'antd/locale/vi_VN'` trong Vite KHÔNG áp locale (hiện `10 / page`, `No data`; quan sát ở lần chạy đầu). Đổi sang `antd/es/locale/vi_VN` thì đúng. |
| 4.3 | Theme từ `packages/ui-tokens` | PASS | Import `@kamito/ui-tokens/antd-theme` (alias tới `packages/ui-tokens/src/antd-theme.ts`, chỉ đọc). Nút primary = `rgb(236, 30, 36)` = `#EC1E24` (`tokens.color.primary`). **Sider vẫn trắng** (`rgb(255,255,255)`), không phải `ink #0A0A0A` như token `Layout.siderBg`: `ThemedSider` của Refine tự dùng `colorBgContainer`. Cần tự dựng Sider hoặc ghi đè nếu muốn sider tối. |
| 4.4 | `accessControlProvider` ẩn menu theo role | PASS | ADMIN: menu `Cau thu | Nguoi dung (ADMIN)`. Đổi sang RESULTS_OPERATOR: menu `Cau thu` (mục users biến mất). **Chưa kiểm**: truy cập thẳng URL `/users` (route chưa bọc `CanAccess`; menu ẩn không đồng nghĩa chặn route). Role trong spike lấy từ localStorage (stub), thật sẽ lấy từ session/`authProvider`. |
| 4.5 | Form: validate inline + map lỗi field từ API | PASS | Gửi form rỗng -> `["Nhap ho ten","Nhap email","Chon thanh pho"]` hiện ngay tại từng field. Email trùng -> API trả `422 {"message":"Validation failed","errors":{"email":"Email da ton tai"}}` -> `useForm` của @refinedev/antd tự gắn lỗi `Email da ton tai` vào field email (kèm toast `Validation failed`), không cần code map. Điều kiện: data provider ném `{statusCode:422, errors:{field:msg}}`. |
| 4.6 | `Upload customRequest` -> PUT URL ký sẵn | PASS với same-origin, **FAIL khi gọi thẳng S3** | Luồng: `POST /api/upload-intent` -> `{key, uploadUrl}` -> `PUT uploadUrl` -> `onSuccess`. Qua proxy Vite cùng origin (`/s3/...`): `PUT status 200`, `HeadObject ok size=70` (đúng kích thước file thử), file test đã xóa. **Gọi thẳng `http://localhost:9010` từ trình duyệt (UPLOAD_MODE=direct)**: `REQUEST FAILED PUT http://localhost:9010/kamito-tt-dev/... net::ERR_FAILED`; preflight `OPTIONS` bằng curl trả 200 nhưng không có header `Access-Control-Allow-*`. => thiết kế (a) cần bucket CORS đặt được; chưa đặt thử vì sẽ đổi cấu hình kho dev ngoài phạm vi spike. Kiểu stub ghi rõ: URL ký thật trên S3 thật (RustFS cục bộ), nhưng PUT đi qua proxy dev. |
| 4.7 | Build sạch | PASS | `pnpm build` (`tsc --noEmit && vite build`) không lỗi, 3717 module, 1.34s. |

Lần chạy cuối: `TOTAL 18/18 PASS` (cả 2 chế độ checksum của AWS SDK: mặc định `WHEN_SUPPORTED` và `WHEN_REQUIRED` đều PUT 200 trên RustFS; URL ký bản mặc định có thêm `x-amz-checksum-crc32=AAAAAA==` nhưng không làm hỏng; chưa thử MinIO/R2 thật).

### 4.8 Phát hiện phụ (không chặn, cần ghi vào phase 03-05)

- Console: `Warning: [antd: compatible] antd v5 support React is 16 ~ 18` với React 19. Đã thêm `@ant-design/v5-patch-for-react-19` (import đầu `main.tsx`); **chưa kiểm lại cảnh báo đã mất** sau khi thêm.
- Console: `[antd: Menu] children is deprecated. Please use items instead` (phát ra từ sider của Refine, chỉ cảnh báo).
- Nhãn mặc định của Refine là tiếng Anh (`Create`, `Save`, `Filter`, `Clear`) vì i18n của Refine tách khỏi locale antd. Cần `i18nProvider` (hoặc truyền label thủ công) khi làm tiếng Việt thật. Tiêu đề danh sách tự thêm "s" (`Cau thus`), nên truyền `title`.
- `FilterDropdown` + `Select` đa chọn: chọn một giá trị thì dropdown lọc đóng, không bấm được nút Filter. Cần `getPopupContainer={(n) => n.parentElement!}` trên Select. (Nút Filter/Clear là nút riêng của Refine, không phải `.ant-table-filter-dropdown-btns`.)
- Đổi sort giữ nguyên trang hiện tại (`page=2&sort=full_name`); đổi filter/tìm kiếm thì reset về `page=1`. Quyết định có reset page khi sort hay không là việc của phase 03-05.
- `Form.Item name=... > Upload` sinh cảnh báo `value is not a valid prop`; dùng field ẩn lưu key, Upload ngoài `name`.

## 5. Peer-dependency warning (nguyên văn)

Cài đúng bộ trên trong thư mục sạch, để `react-router` tự chọn bản mới nhất:

```
[WARN] Issues with peer dependencies found. Run "pnpm peers check" to list them.
...
+ react-router 8.5.1

$ pnpm peers check
✕ unmet peer react-router
  Installed: 8.5.1
  Wanted:
    ^7.0.2:
      @refinedev/react-router@2.0.4
```

Xử lý: ghim `react-router@7` (đã cài 7.18.5) -> `pnpm peers check`: `No peer dependency issues found`. Không có cảnh báo peer nào khác với react 19.3.1 / antd 5.29.3 / @refinedev/core 5.0.12 / @refinedev/antd 6.0.3 (peer của @refinedev/antd: `antd ^5.23.0`, `react ^18 || ^19`, `@refinedev/core ^5.0.0`).

## 6. Kích thước bundle (production, chưa tách chunk)

```
dist/assets/index-*.css    3.10 kB | gzip:   1.17 kB
dist/assets/index-*.js 1,589.30 kB | gzip: 501.06 kB
```

Trang gồm: layout, 1 bảng, 1 form, upload, react-router, react-query. Vite cảnh báo chunk >500 kB. Chưa tách chunk/lazy; chưa đo baseline antd-only để biết phần Refine + `@ant-design/pro-layout` + `react-markdown` chiếm bao nhiêu. Admin nội bộ nên chấp nhận được, nhưng nên route-level lazy khi thêm nhiều màn hình.

## 7. Quyết định

**Dùng Refine 5 + @refinedev/antd 6.0.3 + antd 5.29.3** cho admin. Không cần fallback ProComponents.

Rủi ro cần theo dõi: `@refinedev/antd` chưa có release từ 2025-10-23 (nhưng lõi `@refinedev/core` còn được cập nhật 2026); khi cần có thể bỏ lớp `@refinedev/antd` và dùng `@refinedev/core` + antd thuần (data provider và hook đã tách rời).

## 8. Ghi chú cho phase 03-05

- Giữ data provider kiểu này: hợp đồng `page,pageSize,sort,q,filter[...]` -> `{data,total}`; API cần whitelist cột sort/filter (đã làm ở stub).
- Lỗi 422 phải có dạng `{errors:{field:msg}}` để form tự map.
- Bắt buộc: import locale `antd/es/locale/vi_VN`; thêm patch React 19; `i18nProvider` cho nhãn Refine; `getPopupContainer` cho Select trong FilterDropdown; ghim `react-router@7`.
- RBAC: ngoài `accessControlProvider`, phải bọc route bằng `CanAccess`/guard và để API tự kiểm role (menu ẩn chỉ là UX).
- Upload: nếu chọn thiết kế (a) trực tiếp, cần xác nhận bucket CORS đặt được trên hạ tầng thật (kho cục bộ hiện không có CORS); nếu không, thiết kế (b) qua API. `customRequest` hoạt động tốt với cả hai (chỉ đổi `uploadUrl`). Kho dev là RustFS, không phải MinIO: khác biệt hành vi (CORS, `content-length-range`) cần kiểm lại trên hạ tầng thật.
- Sider tối theo token cần tự dựng (xem 4.3).

## 9. Chạy lại spike

```
cd spikes/refine-antd
pnpm install --ignore-workspace
pnpm api            # Express :3100, tạo schema spike_refine + seed 200 dòng (in host/db trước)
pnpm dev            # Vite :5190, proxy /api và /s3
CHROME_PATH="<đường dẫn chrome.exe của Playwright>" node --env-file=../../.env e2e/check.mjs
pnpm build
UPLOAD_MODE=direct pnpm api   # để tái hiện lỗi CORS khi gọi thẳng S3
```

Dọn: `DROP SCHEMA spike_refine CASCADE` (DB `kamito_tt_dev`) khi xong; xóa `spikes/refine-antd/`. Hiện không còn server nào chạy.

## Chưa kiểm chứng / câu hỏi mở

- Cảnh báo React 19 có mất sau patch không (chưa chạy lại).
- Truy cập thẳng `/users` bằng role thấp (route guard) - chưa kiểm.
- `authProvider` + đăng nhập thật (thuộc phase 03 / Spike C) - ngoài phạm vi.
- Edit/Show, `i18nProvider`, upload nhiều file / tiến độ - chưa làm.
- Có đặt được CORS trên kho S3 thật (Dokploy) không - cần chủ hạ tầng.
