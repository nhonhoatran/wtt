# Kiểm thử API thật — phase 08–12

- Ngày: 2026-11-20, sau khi lượt tiếp theo được cho phép chạy trên DB test riêng.
- Kết quả xác nhận: **21 spec / 132 ca duy nhất đạt**, không ca lỗi/bỏ qua trong các lượt xác nhận cuối.
- Có **một lượt gộp bị native crash Windows**; giữ riêng, không tính thành công. Hai spec được chạy lại sau thay đổi đường dẫn artifact; không cộng trùng 7 ca đó.
- Manifest tổng hợp từ JSON Vitest mới nhất của từng spec: `test-results/261120-real-api-manifest.json`.

## Phạm vi và kết quả

| Spec dưới `apps/api/test/` | Ca đạt |
|---|---:|
| `publishing.e2e-spec.ts` | 5 |
| `articles.e2e-spec.ts` | 5 |
| `cms-resources.e2e-spec.ts` | 6 |
| `contact.e2e-spec.ts` | 4 |
| `public-site.e2e-spec.ts` | 7 |
| `public-sitemap.e2e-spec.ts` | 3 |
| `permission-coverage.e2e-spec.ts` | 4 |
| `express-router-allowlist.e2e-spec.ts` | 3 |
| `public-bracket.e2e-spec.ts` | 8 |
| `public-event-timezones.e2e-spec.ts` | 1 |
| `public-events.e2e-spec.ts` | 9 |
| `public-groups-entries.e2e-spec.ts` | 9 |
| `public-match-dst.e2e-spec.ts` | 3 |
| `public-matches.e2e-spec.ts` | 9 |
| `public-player-names.e2e-spec.ts` | 6 |
| `public-players.e2e-spec.ts` | 14 |
| `public-ranking-payload.e2e-spec.ts` | 1 |
| `public-rankings.e2e-spec.ts` | 16 |
| `public-results-strip.e2e-spec.ts` | 5 |
| `public-schedule.e2e-spec.ts` | 7 |
| `public-refresh-wiring.e2e-spec.ts` | 7 |
| **Tổng duy nhất** | **132** |

Publishing mới xác nhận thật: job delayed chỉ chứa ID; thay/hủy lịch; processor đăng bài tới hạn; sweep cứu bài mất delayed job và giữ draft/bài tương lai; retry không đổi `publishedAt` và tạo job cache mới; retention đọc AppSetting đổi 7 → 2 ngày rồi chỉ xóa thư quá hạn. Processor, PostgreSQL và Redis đều thật. Chưa dùng kết quả này để tuyên bố process publishing worker/scheduler tự chạy đúng giờ trên staging.

CMS và quyền xác nhận CRUD song ngữ, sanitizer/XSS, scope công khai, thời điểm công bố, danh mục/phân trang server, video/trang tĩnh/tài trợ/footer, liên hệ/rate limit/IP hash, ADMIN/RESULTS_OPERATOR và SSR secret. Public xác nhận whitelist/privacy, nhánh/bảng/đăng ký/lịch/trận/DST, hồ sơ/redirect/BXH, cache tags và ngân sách payload.

Payload cuối vẫn giữ đủ **50 dòng × 20 khoản = 1.000 breakdown**. Số byte chính xác nằm trong artifact riêng của lượt `artifacts-verified-public-ranking-payload`, không suy gzip này thành mọi lịch sử hoặc ngưỡng staging.

## Môi trường và quyền sở hữu lượt DB

- Target duy nhất: **`localhost:5433/kamito_tt_phase12_test`**. Root chuẩn bị DB: 18 migrations đã up to date, không cần áp migration mới; seed cấu hình test thành công. Bằng chứng: `test-results/261120-real-db-setup.log`.
- Không query/seed/migrate DB `kamito_tt_dev`, không sửa root `.env`, không cài dependency hoặc chạy pnpm qua WSL trong gói API này.
- Runner `test-results/261120-real-api-runner.mjs` đọc cấu hình hoạt động bằng `process.loadEnvFile`; chỉ đổi DB pathname/hostname và env của process con. Ép confirmation chính xác, `APP_ENV=test`, `QUEUE_PREFIX=kamito-tt:test`, kiểm local Redis, giữ URL/secret khỏi stdout.
- Hash root `.env` trước/sau **mọi lượt, gồm cả lượt native crash, đều không đổi**; manifest kiểm lại các summary. Không in hash hoặc giá trị secret trong báo cáo.
- API được cấp lease độc quyền. Mỗi spec chạy trong process riêng, `--maxWorkers=1`, fileParallelism tắt theo config hiện có; không chạy đồng thời fixture đổi AppSetting.
- Các lượt xác nhận cuối chạy đủ teardown. Sau đó đã trả lease cho root/agent browser, không còn Vitest/app server do gói API giữ. Lượt native crash không có JSON cuối nên không khẳng định mọi partial fixture của lượt lỗi đã dọn; không xóa mù row hoặc queue không rõ chủ sở hữu.

## Bằng chứng và lệnh

Artifact mỗi lượt có timestamp riêng; các mẫu dưới đây nằm trong root `test-results/`:

| Nhóm | Artifact |
|---|---|
| Publishing 5 ca | `261120-real-api-publishing-20261120045716169.{json,log,summary.json}` |
| CMS/security 7 spec, 32 ca | `261120-real-api-cms-isolated-*-202611200500*.{json,log,summary.json}` |
| Public 13 spec, 95 ca | `261120-real-api-public-isolated-*.{json,log,summary.json}` |
| Hai spec xác nhận đường dẫn artifact | `261120-real-api-artifacts-verified-*.{json,log,summary.json}`; payload/EXPLAIN ở thư mục `*-artifacts/` cùng run ID |
| Native crash được giữ riêng | `261120-real-api-cms-security-20261120045810701.log`, summary tương ứng; không có JSON Vitest hoàn tất |
| Kiểm tĩnh cuối | `261120-real-api-typecheck.log`, `261120-real-api-lint.log`: exit 0 |

```text
node test-results/261120-real-api-runner.mjs publishing test/publishing.e2e-spec.ts
node test-results/261120-real-api-batch.mjs cms-isolated <7 spec CMS/site/SEO/quyền nêu trong bảng>
node test-results/261120-real-api-batch.mjs public-isolated <13 spec public nêu trong bảng>
node test-results/261120-real-api-batch.mjs artifacts-verified test/public-player-names.e2e-spec.ts test/public-ranking-payload.e2e-spec.ts
pnpm --filter @kamito/api typecheck
pnpm --filter @kamito/api exec eslint test/publishing.e2e-spec.ts test/support/publishing-test-safety.ts test/public-player-names.e2e-spec.ts test/public-ranking-payload.e2e-spec.ts
```

Runner bắt buộc lease do điều phối cấp và tự truyền env test; không chạy các fixture bằng `.env` dev mặc định. Danh sách đối số chính xác của mọi lượt được giữ trong raw log và manifest, không cần suy từ cú pháp rút gọn trong ví dụ.

## Native crash và lỗi lưu artifact

1. Lượt gộp 7 spec bị **3221226505 (`0xC0000409`)** sau khi sitemap báo 3 ca đạt; pnpm trả mã 1, không có assertion failure hoặc JSON cuối. Đây cùng dạng native crash Windows đã ghi trong các đợt trước; chưa kết luận nguyên nhân native. Đã đọc config và nhờ reviewer độc lập kiểm: config vốn dùng threads/no-file-parallelism. Chuyển sang mỗi spec một process tuần tự; không tắt isolation, không sửa assertion hoặc mock DB/queue để qua. Cả 21 spec cuối đều đạt và được đếm từ JSON hoàn chỉnh.
2. Phát hiện muộn hai spec legacy ghi cứng vào `apps/api/test-results/public-entry-page-explain.json` và `public-ranking-payload-budget.json`, nên **hai JSON generated lịch sử ở vị trí đó đã bị lượt đầu ghi đè**. Không có bản sao trước lượt chạy để chứng minh khôi phục; bản copy làm muộn không được gọi là backup lịch sử. Raw Vitest log/JSON và báo cáo lịch sử không bị ghi đè. Artifact mới đã được giữ thêm ở các đường dẫn `261120-real-*`.
3. Root duyệt sửa **chỉ hai file test** dùng `API_TEST_ARTIFACT_DIR`, giữ default `test-results`. Runner đặt thư mục riêng theo run ID. Chạy lại hai spec đạt **6 + 1 ca**, file mới xuất hiện đúng thư mục riêng và timestamps của hai file legacy không đổi thêm sau rerun; API typecheck và lint phạm vi thay đổi đạt. Không dựng lại nội dung cũ từ trí nhớ.

Có warning deprecation của pg về gọi `client.query()` khi client đang thực hiện query; giữ nguyên trong log, không che warning hoặc đổi dependency trong gói này. Allowlist test tạo một auth-library warning đã lọc, không assertion lỗi.

## Giới hạn

- Không phải toàn bộ API suite, toàn bộ ma trận phase 11, các job dọn/import/storage thật, full tournament browser workflow 8 bước hoặc staging.
- Không chạy thêm ranking-admin/flow/performance batch trong lease này để chuyển DB cho public browser/axe; các bài đó không được tính vào 132.
- Không dùng API 132 ca để đóng Lighthouse/axe, CSP enforce, SEO validator/container phát hành, G1/G2, consent, M1/M2 staging, rollback/restore hoặc MinIO/S3.
- Kiểm browser và probe API → BullMQ → SSR 5 giây do agent khác thực hiện theo lease kế tiếp, báo cáo riêng.
