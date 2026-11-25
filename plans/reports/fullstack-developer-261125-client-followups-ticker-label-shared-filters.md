# Client follow-ups: nhãn ticker + bộ lọc dùng chung (2026-11-25)

## 1. Ticker `label-content-name-mismatch` (WCAG 2.5.3)
- Nguyên nhân: `aria-label` dài ở `results-strip-item.tsx` không chứa chữ nhìn thấy.
- Sửa: bỏ `aria-label` và chuỗi `strip.card`; tên truy cập lấy từ nội dung nhìn thấy, thêm span `visually-hidden` "Trận #N." ở đầu thẻ. Vẫn 1 link/thẻ (0 link lồng).
- Tên truy cập đo trong trình duyệt: "Trận #13. MD · Bảng A Có kết quả Draw 12 3f305b 3 Draw 11 3f305b 0".
- Lỗi phát sinh do chính span ẩn: `.visually-hidden` là `position:absolute`, thẻ không có `position`, nên span thoát khỏi vùng cuộn ngang của ticker và làm tràn trang 390px (scrollWidth 857). Sửa: `.card { position: relative }` trong `results-strip.module.css`.
- Test `site-chrome.test.ts`: bỏ kỳ vọng `aria-label=...`, thay bằng kiểm không có `aria-label`, có span ẩn "Trận #7." và dòng context "MS · Bán kết · Bàn T1".

## 2. FilterForm / PaginationLinks trên các trang dùng chung
Next start cổng 3330 + proxy 3331 (ticker bật, dữ liệu trận thật), kịch bản `scratchpad\cfix\check.mjs`. Trang: vi news, videos, players, rankings, rankings/RD-ad596c2d, events/entries-3f305b/matches, players?q=zzzznomatch, en players, vi events; viewport 1440 và 390.
- Tràn ngang: 0 trên tất cả (cả 2 viewport) sau fix `position: relative`.
- axe (ticker bật): 0 vi phạm trên tất cả 18 lượt.
- Focus: mọi select/input/button/link trong form và nav đều có outline hoặc shadow (`focusMissing []`); thẻ ticker outline 2px rgb(227,244,42).
- Lọc gửi được: players -> `/vi/players?q=a&gender=&club=&sort=name` (cả 2 viewport). News/videos không có ô tìm kiếm (news chỉ có select chuyên mục).
- Phân trang: click "2" -> `/vi/players?page=2` (đã kiểm bằng `waitForURL`; lần đầu ghi nhận sai do chưa chờ điều hướng).
- Không có lỗi trong filter-form / pagination-links nên không sửa file nào ở đó.

## Sự cố trong lúc làm (không phải lỗi code)
- Lead build lại `.next` giữa chừng làm Next đang chạy của em trỏ CSS cũ (hash cũ), giả ra tràn 31/82px ở players 390. Đã khởi động lại và build lại; số liệu cuối lấy từ bản build mới.

## Kiểm chứng
- `pnpm typecheck && pnpm lint && pnpm test` (apps/client): pass, 29 file / 135 test. `pnpm build`: exit 0 (sau sửa CSS).
- Đã dừng Next 3330, proxy 3331 và các tiến trình bọc của em; API :3000 và admin :5173 vẫn LISTENING.

## Tệp đã đổi
- apps/client/src/components/layout/results-strip-item.tsx (mới/untracked)
- apps/client/src/components/layout/results-strip.module.css (+1 dòng)
- apps/client/tests/unit/site-chrome.test.ts (untracked)

## Chưa giải quyết
- Khóa i18n `strip.card` (vi.json/en.json) giờ không còn dùng; để nguyên vì ngoài phạm vi sở hữu, nên xóa ở lượt sau.
- e2e chưa chạy.
