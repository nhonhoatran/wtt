# Câu hỏi mở — nửa client (site công khai)

> Ngày 2026-11-25. Nguyên tắc chung khi chưa chốt: **ẩn phần tử**, không hiện dữ liệu giả. Chi tiết bằng chứng ở [research/client-figma-gap.md](./research/client-figma-gap.md).

| # | Vấn đề | Phương án | Đề xuất | Trong lúc chờ |
|---|---|---|---|---|
| Q1 | Nút "Đăng ký thi đấu" (header 1-28). Không có tính năng đăng ký công khai; entry hiện do admin nhập/import | A. Setting `site.registrationUrl` trỏ form ngoài (Google Form…). B. Xây đăng ký online (form, duyệt, thanh toán…) — dự án riêng. C. Bỏ nút | **A** — rẻ, admin tự bật/tắt; B lập plan riêng nếu cần | Setting có sẵn từ C2, mặc định rỗng → nút ẩn |
| Q2 | Icon tìm kiếm header. Không có API tìm chung; `articles` không nhận `q` | A. Bỏ icon. B. Trang `/search` gọi song song tìm giải + tìm VĐV (API đã có `q`), không cache, có rate limit. C. Tìm toàn site gồm tin (cần API mới/full-text) | **B** — không đổi API, hữu ích cho tra cứu VĐV | Icon ẩn; C3 chỉ làm B khi được chốt |
| Q3 | Mục menu "Trận đấu" toàn site. Chỉ có tab trận theo từng giải | A. Không có mục này. B. Trỏ tab trận của giải đang diễn ra (ẩn khi không có). C. Trang `/matches` liên giải (API mới: live/hôm nay/sắp tới) | **B** trước (không API), C nếu thường có nhiều giải cùng lúc | Không có trong `site.nav.items` mặc định |
| Q4 | "Hạn đăng ký", "Thưởng: 150.000.000đ" trên thẻ/hàng giải | A. Thêm cột `Event.registrationDeadline`, `prizeText`/`prizeAmount` (migration + admin form). B. Bỏ | A nếu ban tổ chức thực sự công bố; cần nửa admin thêm form | Ẩn |
| Q5 | Tài trợ: vị trí (khối trang chủ + footer đang trùng trên trang chủ) và hạng tài trợ (kim cương/vàng…) | Vị trí: A. Một dải site-wide sát footer mọi trang, bỏ khối riêng trang chủ (`home.sections.sponsors` đổi nghĩa thành bật/tắt dải). B. Chỉ trang chủ. C. Giữ cả hai. Hạng: dùng `Sponsor.roleLabel` có sẵn để nhóm, hoặc thêm cột hạng + thứ tự | Vị trí **A**; hạng: nhóm theo `roleLabel` (không migration) | Giữ hiện trạng (C), chỉ đổi kiểu; không chia hạng |
| Q6 | "Ban tổ chức", "Tổng trọng tài" (sidebar giải), "Trọng tài" (trang trận) | A. Thêm trường giải (`organizerName`, `refereeName` vi/en) qua migration + admin. B. Dùng `presentedBy` cho BTC (nghĩa hiện là "Presented by"). C. Bỏ | A cho BTC/Tổng trọng tài nếu cần công bố; trọng tài từng trận cần phân công trọng tài → tính năng riêng. **Không** dùng `officialById` (người chốt kết quả, dữ liệu nội bộ) | Ẩn |
| Q7 | "Kiểu cầm vợt", "Lối đánh" hồ sơ VĐV | A. Thêm trường hồ sơ (enum + nhãn vi/en) + admin. B. Bỏ | B cho tới khi có nguồn dữ liệu được VĐV đồng ý công khai | Ẩn |
| Q8 | Hồ sơ VĐV: "Trận sắp tới", thành tích/điểm theo từng giải, "Thành tích nổi bật" (số lần vô địch, chuỗi thắng) | A. API tổng hợp mới + thêm tag `player-*` cho `schedule.update`. B. Hoãn | B trong đợt này; A làm phase sau nếu có nhu cầu | Ẩn; đã có hạng, điểm, thắng–thua, kết quả, giải tham dự |
| Q9 | Link "Cách tính điểm" ở BXH | A. Setting chọn slug trang tĩnh CMS. B. Bỏ | A (nội dung do BTC viết trong CMS) | Ẩn |
| Q10 | Màu đỏ `#EC1E24` chỉ đạt 4,39:1 → chữ nhỏ đỏ/pill nhỏ chữ trắng không đạt AA | A. Token phụ `primaryText` đậm hơn (mặc định `#D71920`, ≈ 5,19:1) cho chữ/nhãn nhỏ, giữ đỏ gốc cho mảng lớn. B. Đổi cả màu thương hiệu | **A** — cần thiết kế xác nhận mã màu | C1 dùng mặc định `#D71920` |
| Q11 | Logo: Figma có 3 wordmark khác nhau ("KAMITO \| TOURNAMENT", "KAMITO TOURNAMENT", "KAMITO SPORT") | A. Nhận file logo chính thức (SVG) + setting/media để đổi. B. Giữ wordmark chữ hiện tại | A khi có file; trong lúc chờ dùng một wordmark thống nhất | **Đã chốt 2026-11-25:** wordmark header + footer hiển thị tên site từ setting `site.name` (sửa trên `/settings`), viết hoa, kèm vạch đỏ; khi có file logo chính thức thì làm tiếp phương án A |

## Đã giải bằng setting (không cần quyết định thêm)
- Mục menu, thứ tự, nhãn: `site.nav.items`. Liên kết MXH: `site.socialLinks` (rỗng → ẩn icon). Đoạn giới thiệu footer: `site.tagline`. Số trận ticker: `header.resultsStrip.limit` (có sẵn). Ngưỡng "Sắp hết hạn": `ranking.expiringSoonDays`. Giải hero: `home.featuredEventId` (có sẵn, nay được dùng). Màu hạng giải: `Tier.colorHex` (DB).
- Màu theo nội dung thi đấu: Figma không dùng → không thêm.

## Cần phối hợp với nửa admin
- Editor thân thiện cho `site.nav.items`, `site.socialLinks` thay ô JSON trên `/settings`.
- Nếu Q4/Q6/Q7 chọn A: migration + form admin thuộc nửa admin; client chỉ hiện khi có dữ liệu.
- File dùng chung (`packages/ui-tokens/src/tokens.ts`, `build-css-variables.test.ts`, `packages/shared/src/app-setting-registry.ts`, `packages/shared/src/public-*-contract.ts`, `apps/api/src/modules/revalidation/cache-tags.ts`): không sửa song song. Đã thấy trùng thật: A1 ↔ C1 (`ui-tokens`), A2 ↔ C2 (`app-setting-registry.ts`) → chạy nối tiếp từng cặp.
- E2E `apps/client/tests/admin-full-flow/*` do nửa admin sửa (A1, A6, A7, A9, A10); nửa client chỉ sửa `apps/client/tests/e2e/*`, `tests/unit/*`, `tests/offline/*`.

## Đã chốt thêm (2026-11-25)
- `site.tagline` khi có giá trị phải đủ cả tiếng Việt và tiếng Anh; API kiểm cùng quy tắc với trang `/settings`.
- Nhánh đấu nhiều nhánh con dùng chung tham số `?round` (chọn vòng thì mọi nhánh đổi theo). Tách theo từng nhánh để sau nếu có nhu cầu thật.
- Danh sách trận trên desktop (từ ~1024px) hiển thị dạng bảng theo Figma 1-8; dưới mức đó giữ dạng thẻ.
