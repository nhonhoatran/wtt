# Lighthouse sản phẩm local — 2026-11-20

## Kết quả cuối

**4/4 route đạt, exit 0**, trên production build sau sửa metadata. Lighthouse **13.6.0**, mobile, `throttlingMethod=simulate`; ngưỡng giữ nguyên **Performance ≥85, Accessibility ≥90, SEO ≥95**. Không giảm ngưỡng hoặc thay trang sản phẩm bằng fixture HTTP của công cụ.

| Route tại `http://localhost:3314` | Performance | Accessibility | SEO | Đạt |
|---|---:|---:|---:|---|
| `/vi` | 100 | 100 | 100 | Có |
| `/vi/events/entries-135d5a` | 99 | 100 | 100 | Có |
| `/vi/events/entries-135d5a/draws/MS` | 100 | 100 | 100 | Có |
| `/vi/rankings/RL-d6a46c4d` | 100 | 100 | 100 | Có |

Lượt `r02` bắt đầu các audit lúc 05:46:19–05:46:56 UTC ngày 2026-11-20. Bốn LHR có `runtimeError=null`, `meta-description.score=1`; đây là số đo một lượt trên máy local, không phải cam kết điểm trên mọi thiết bị/mạng hoặc staging.

## Môi trường và bằng chứng

- API `dist` và Next production `start`, chỉ nối target đã được xác nhận **`localhost:5433/kamito_tt_phase12_test`** và Redis local thật. Không dùng dữ liệu DB dev hoặc mock API/DB/queue cho audit.
- Sau build metadata, stack được xác minh quyền sở hữu PID API **10388** / client **23360** tại cổng 3313/3314. Retained world không đổi trước/sau restart; không chạy global setup hoặc xóa/tạo lại fixture chỉ để đo điểm tốt hơn.
- Wrapper chỉ đọc bốn URL, kiểm HTTP 200/có `<main>` trước audit. Không sửa `.env`, DB hoặc nội dung CMS trong quá trình Lighthouse. Các suite/worker thay đổi fixture và k6 được điều phối ở lượt riêng, không chạy đồng thời khi đo.
- Emulation thực trong LHR: **412×823**, DPR 1,75, CPU slowdown 4; đây khác Playwright mobile 390×844. Các kết quả accessibility 390/1440 được ghi ở báo cáo browser riêng.
- Thư mục artifact: `apps/client/test-results/261120-real-lighthouse/r02/`; `summary.json`, `runner.log` và bốn cặp `*.report.json`/`*.report.html`. Root đã đọc summary, audit detail, config và runtime error của từng LHR; reviewer độc lập cũng đối chiếu bốn LHR.

Lệnh từ root, qua wrapper tạm ignored chỉ nhận lease của điều phối:

```powershell
$env:REAL_TEST_DB_LEASE='root-lighthouse'
$env:REAL_LH_RUN='r02'
node test-results/261120-real-lighthouse.mjs
```

Wrapper gọi script nguồn `apps/client/tests/performance/lighthouse-audit.mjs` với bốn URL tuyệt đối và biến ngưỡng 85/90/95; Chromium lấy từ Playwright hiện có. Không tải/cài dependency trong lượt này.

## Lượt không đạt được giữ nguyên

`r01` là baseline sản phẩm thật, **exit 1**:

- Home **99/100/92**, event **100/100/92**, draw **98/100/92** theo thứ tự Performance/Accessibility/SEO. Audit SEO duy nhất không đạt là thiếu `meta-description`.
- Route BXH bị process native Windows exit **3221226505 (`0xC0000409`)** trước khi tạo LHR. Không có điểm hợp lệ cho route đó ở `r01`; không suy đây là lỗi metadata của BXH hoặc đã sửa nguyên nhân native Windows.
- `r01/` giữ nguyên summary, log và ba LHR; `r02/` là thư mục mới, không ghi đè baseline. CLI logging được sửa để trường hợp stderr/stdout rỗng vẫn in exit/signal và lưu thông báo rõ; không đổi logic chấm điểm hoặc threshold.

## Sửa nguyên nhân và hồi quy

Trang chủ gọi helper mà không truyền description. Helper event chỉ dùng summary nullable, nên giải không nhập tóm tắt làm trang overview và các tab thiếu description. Bản sửa nhỏ:

1. `home.metaDescription` và template `event.metaDescription` ở dictionary vi/en; không chôn tên giải hoặc tên thương hiệu trong helper.
2. Home truyền mô tả locale. Event ưu tiên summary đã nhập theo locale, English trống fallback Vietnamese; chỉ khi cả hai null/rỗng/whitespace mới dùng template với title trang và tên giải. `.trim()` chỉ để chọn blank, nội dung hợp lệ được giữ nguyên.
3. Description chuẩn, Open Graph và Twitter cùng giá trị. Generic helper, canonical, hreflang, title home, schema và quy tắc nghiệp vụ giữ nguyên.

Regression trước sửa: **7 unit fail / 5 pass**, hai ca browser fail ở desktop/mobile; BXH đã có description đúng từ trước. Sau sửa: toàn client **83/83 unit đạt**, typecheck/scoped lint/build đạt; reviewer chạy riêng **12/12 metadata unit đạt**. Browser trên build cuối **27 đạt / 5 skip có chủ đích / 0 lỗi / 0 flaky** trong 32 ca, gồm kiểm mô tả bốn core route × vi/en × hai viewport; axe quét lại **36 scan, 0 violation được phát hiện**, giữ incomplete rules. Chi tiết lỗi runner/test scaffolding ban đầu và artifact trước/sau tại [QA public/axe](./tester-261120-real-public-and-axe.md), [review độc lập](./code-reviewer-261120-real-services.md).

## Giới hạn

- Chỉ bốn route VI mobile local được Lighthouse; kiểm metadata EN có browser regression nhưng không được gọi là đã đo Lighthouse EN.
- Lighthouse SEO 100 không thay validator dữ liệu phát hành hoặc kiểm container standalone, canonical domain thật, consent, toàn site/admin, CSP enforce và staging.
- K6 tải nhẹ được chạy sau khi audit hoàn tất, có [báo cáo riêng](./tester-261120-real-smoke.md); không dùng kết quả tải local để đóng gate staging hoặc nghiệm thu production.
