# Kiểm thử client phase 12 — SEO và sitemap runtime

Ngày kiểm: 2026-11-19, môi trường Windows Node 24.15.0 / pnpm 11.3.0, Next.js 16.4.5. Phạm vi là working tree phase 12; chưa commit.

## Kết quả cuối

| Lệnh | Kết quả |
|---|---|
| `pnpm --filter @kamito/client test` | **Đạt 17 file / 62 test**, không bỏ qua, không lỗi |
| `pnpm --filter @kamito/client typecheck` | Đạt |
| `pnpm --filter @kamito/client lint` | Đạt |
| `pnpm --filter @kamito/client build` | Đạt; route `/sitemap.xml` và `/sitemap/[id]` đều dynamic |
| `git diff --check -- apps/client docs/public-site.md` | Đạt |

Node và pnpm được chạy từ `C:\nvm4w\nodejs` qua PATH của process kiểm thử. Bộ client có các bài cache/rate-limit dùng **Redis thật** ở target local đã được root khởi động riêng theo compose; lượt cuối trên đây không thay chúng bằng mock. Hai suite Redis từng lỗi ở lượt trước khi dịch vụ chưa chạy; kết quả lượt cuối 62/62 thay cho lượt chưa có Redis, không xóa hay làm yếu test.

## Phạm vi đã kiểm

- `tests/i18n-keys.test.ts`: khóa lá trong từ điển tiếng Anh trùng với tiếng Việt.
- `tests/unit/page-metadata.test.ts`, `json-ld.test.ts`: canonical/alternate/Twitter, ảnh và alt theo locale, dữ liệu `SportsEvent` và escape JSON-LD.
- `tests/unit/sitemap.test.ts`: URL vi/en cho route công khai, chỉ tab có khả năng hiển thị, không xuất URL hồ sơ VĐV; root trả XML đúng content type/no-store; ID sai không gọi loader; chunk ngoài phạm vi trả 404. Ca cuối đã lưu trước khi lượt agent trước bị ngắt và được chạy lại: 25.000 video × 2 locale cộng route tĩnh làm root tự trả index hai chunk.
- `tests/unit/sitemap-xml.test.ts`: 50.001 URL được chia `[50.000, 1]`; không rơi/mất URL; tính byte UTF-8 sau escape và wrapper; thứ tự ổn định; index cũng kiểm giới hạn; từ chối chunk ID âm, leading zero hoặc vượt safe integer.
- `tests/unit/proxy.test.ts`: `/sitemap.xml`, các chunk và robots nằm ngoài chuyển hướng locale/hạn mức trang.

Các bài unit sitemap mock loader dữ liệu công khai để kiểm quy tắc sinh XML/URL độc lập. Kết quả này **không** được tính là chạy API/PostgreSQL hoặc nghiệm thu dữ liệu phát hành.

## HTTP trên bản production local

Đã mở Next production tạm thời tại `http://localhost:3312`, dùng bản build vừa tạo; kiểm bằng native `fetch` với `redirect: 'manual'`, rồi dừng đúng process server trong `finally`.

| Path | Status | Location |
|---|---:|---|
| `/sitemap/invalid` | 404 | Không có |
| `/sitemap/01.xml` | 404 | Không có |
| `/sitemap/9007199254740992.xml` | 404 | Không có |

Cả ba response có HSTS `max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`. Không có request API/DB trong nhánh từ chối ID này. Không dùng kết quả HTTP local để xác nhận TLS hoặc Traefik trên staging.

## Tài liệu đã cập nhật

`docs/public-site.md` đã thay đường dẫn metadata-route cũ bằng custom route hiện tại; bỏ ghi chú “chưa có phân mảnh/index”; mô tả giới hạn URL/byte, index/chunk, no-store và 404 ID sai. Tài liệu cũng nêu CORP khác origin chỉ dành riêng cho ảnh public đã tái mã hóa, không áp ngoại lệ đó cho response API thông thường.

Đã đối chiếu hướng dẫn phiên bản Next đang cài: `apps/client/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (Web Request/Response, params dạng Promise). Chưa sửa source client trong lượt finalizer này.

## Cổng còn mở

- Chưa chạy Playwright với API/PostgreSQL/storage thật trong lượt này; phần test DB riêng do tester API phụ trách.
- Chưa có số đo Lighthouse/axe, smoke tải k6, báo cáo CSP staging, rollback/restore hoặc xác nhận triển khai staging.
- CSP vẫn report-only, còn `unsafe-inline` và iframe hosts trong code. Muốn enforce phải hoàn tất nonce/cơ chế tương đương, nguồn media hợp lệ và báo cáo staging sạch theo phase 12.
- Không xuất JSON-LD `Person` hoặc URL hồ sơ VĐV khi cổng đồng ý công khai chưa chốt.
- Chưa kiểm validator ngoài hoặc trực quan toàn site 1440/390 trong lượt này.

Không có căn cứ để đánh dấu phase 12 hoàn tất chỉ từ các kết quả local trên.
