# QA phase 10 — BXH và hồ sơ VĐV công khai

Ngày kiểm tra: 2026-11-17. Phạm vi: API, snapshot, cache revalidation và giao diện BXH/danh sách/hồ sơ VĐV sau các bản sửa F1–F4.

## Kết quả

| Nhóm | Kết quả đã chạy | Bằng chứng |
|---|---:|---|
| API tích hợp, 15 file riêng biệt | **111/111 đạt**, 0 bỏ qua | 16 public-rankings + 14 public-players + 1 dense payload + 11 snapshot + 41 regression A + 28 regression B |
| API unit cho tag/revalidation, 3 file | **16/16 đạt** | `apps/api/test-results/phase-10-api-unit.json` |
| Client unit, 10 file | **45/45 đạt** | `pnpm --filter @kamito/client test` |
| Shared unit, 22 file | **101/101 đạt** | `pnpm --filter @kamito/shared test`; gồm 2 ca helper public slug mới |
| Ranking engine unit, 3 file | **36/36 đạt** | `pnpm --filter @kamito/ranking-engine test`, sau bổ sung eventId |
| Worker unit, 7 file | **39/39 đạt** | `pnpm --filter @kamito/worker test`, sau bổ sung eventId |
| Playwright sau F4 | **24/24 đạt**, 0 bỏ qua | `apps/client/test-results/phase-10-e2e-f4-final.log` |
| Playwright lượt hồi quy trước F4 | **40/40 đạt**, 0 bỏ qua | `apps/client/test-results/phase-10-e2e-final.log`; 22 ca phase 10 + 18 ca event pages |
| Typecheck/lint | Đạt | API, client, worker, shared/ranking-engine trong phạm vi script hiện có; `git diff --check` đạt |
| Build cuối phiên | Đạt | Agent chính đã chạy API, worker và Next.js 16.4.5; gồm tạo route production |

Không cộng lại các ca chạy lặp thành tổng mới. 111 ca API gồm 100 ca public/admin/cache và 11 ca snapshot. Đây là kiểm thử local trên PostgreSQL/Redis thật; không phải kết quả staging.

## Môi trường và dữ liệu

- `pnpm db:print-target` xác nhận cấu hình đang hoạt động trỏ tới `localhost:5433/kamito_tt_dev`; không ghi đè `DATABASE_URL`, không dùng dòng `.env` đã comment, không chạy migration hoặc `db push`.
- Dịch vụ PostgreSQL/Redis hiện có trong WSL Ubuntu. Playwright khởi động API `3100` và Next `3101`; kiểm tra cổng trống trước lượt sau F4 để tránh dùng lại API cũ.
- Fixture có mã riêng, chỉ cleanup dữ liệu đã tạo. Probe publish dùng queue prefix ngẫu nhiên, worker revalidation thật, rồi đóng/xóa riêng queue cô lập; không xử lý backlog dùng chung.

## Bằng chứng API và quyền riêng tư

- Public ranks chỉ đọc kỳ đã công bố mới nhất; không đọc kỳ nháp hoặc tính lại điểm hiện tại. Breakdown giữ điểm, vòng, ngày và nhãn đã đóng băng. Phân trang/tìm kiếm không dấu/lọc CLB xử lý phía server.
- Hồ sơ whitelist không trả số điện thoại, email, ngày sinh hoặc tên thật đã bị alias thay thế. Test tạo VĐV bằng API admin thật, đổi alias hai lần và kiểm cả rankings, players, profile, brackets, entries, matches.
- Link công khai dùng `p-<UUID>`; slug chứa tên thật không xuất hiện trong payload/link. Slug cũ và chuỗi gộp trả HTTP 301 tới hồ sơ công khai đích. Đích private/inactive không được mở; profile private trả 404.
- Biên CLB 100/101/200 ký tự được kiểm trên cả hai danh sách. Query ranks lấy dữ liệu trước phân trang; test kiểm số statement để tránh truy vấn theo từng VĐV.
- F4 tái hiện giải A bị ẩn/đổi slug rồi giải B dùng lại slug cũ: nhãn/link A vẫn bị che. Công bố A lại dùng link slug hiện tại nhưng giữ nhãn snapshot. Snapshot legacy thiếu eventId che nhãn/link và giữ nguyên số điểm/vòng; JSON công khai không trả eventId nội bộ.
- Snapshot regression xác nhận builder/worker lưu eventId cho kỳ mới và dữ liệu kỳ đã công bố không bị sửa.

Các artifact API:

| Artifact | Kết quả |
|---|---|
| `apps/api/test-results/phase-10-api-regression-a.json` | 41 đạt/5 file: bracket, events, groups/entries, matches, public names |
| `apps/api/test-results/phase-10-api-regression-b.json` | 28 đạt/5 file: schedule, results strip, site, cache tags, admin lists/rules |
| `apps/api/test-results/phase-10-api-f4.log` | Public players 14 đạt, dense payload 1 đạt; public rankings có 1 lỗi fixture được ghi bên dưới |
| `apps/api/test-results/phase-10-api-f4-final.log` | Chạy lại toàn bộ public rankings: 16 đạt, gồm 2 ca F4 |
| `apps/api/test-results/phase-10-snapshot-regression.json` | 11 đạt/2 file, không lỗi hoặc bỏ qua |

## Trình duyệt và ảnh

12 kịch bản × 2 project desktop/mobile = 24 ca sau F4. Kiểm tra tìm không dấu, GET filter/phân trang, chi tiết điểm native khi tắt JavaScript, hạng đơn/đôi, kết quả thật không gồm bye, hồ sơ rỗng, 404 private, HTTP 301 và giữ query string, canonical opaque, noindex/không Person JSON-LD, sitemap loại hồ sơ, VI/EN, bảng điểm theo phiên bản hiệu lực cuối giải và link VĐV trên trận đấu.

Ảnh chụp 4 trang ở **1440 px** và **390 px**; mỗi trang có assertion `document.documentElement.scrollWidth <= window.innerWidth`. Đã xem trực tiếp ảnh đại diện desktop/mobile; nội dung chính đọc được, không thấy tràn toàn trang. Bảng rộng có vùng cuộn riêng.

| Trang | 1440 px | 390 px |
|---|---|---|
| Tổng quan BXH | [Ảnh](screenshots-261117-phase-10/rankings-overview-1440.png) | [Ảnh](screenshots-261117-phase-10/rankings-overview-390.png) |
| Chi tiết BXH | [Ảnh](screenshots-261117-phase-10/rankings-list-1440.png) | [Ảnh](screenshots-261117-phase-10/rankings-list-390.png) |
| Danh sách VĐV | [Ảnh](screenshots-261117-phase-10/players-list-1440.png) | [Ảnh](screenshots-261117-phase-10/players-list-390.png) |
| Hồ sơ VĐV | [Ảnh](screenshots-261117-phase-10/player-profile-1440.png) | [Ảnh](screenshots-261117-phase-10/player-profile-390.png) |

## Đo payload và thời gian cập nhật

HTTP thật cho trang 50 VĐV × 20 giải = **1.000 khoản điểm**:

| Chỉ số | Số đo gần nhất | Đánh giá |
|---|---:|---|
| JSON chưa nén | 377.129 byte | Vượt 81.920 byte |
| Body HTTP gzip | 9.307 byte | Dưới 81.920 byte |
| Số khoản điểm sau giải nén | 1.000 | Giữ đủ, bằng dữ liệu identity |

`apps/api/test-results/public-ranking-payload-budget.json` ghi rõ `rawBudgetMet=false`, `gzipBudgetMet=true`. Test xác minh `Content-Encoding`, `Vary` và so sánh JSON giải nén với identity. Mốc 80 KiB được đánh giá theo body gzip, không phải JSON thô. Mẫu đo này không chứng minh giới hạn tuyệt đối cho lịch sử không giới hạn; không cắt breakdown để đạt số đo.

Probe thực tế: warm SSR kỳ `2099-06-01`/137 điểm → gọi admin publish kỳ `2099-07-01`/827 điểm → BullMQ worker gửi revalidation → đọc lại HTML công khai. Lượt ghi artifact gần nhất hoàn tất trong **644 ms**, có **1 job hoàn tất**, dưới giới hạn **10.000 ms**. Hai project trình duyệt đều chạy probe thành công; artifact chỉ lưu mẫu cuối. Bằng chứng: `apps/api/test-results/public-ranking-publish-refresh.json`.

## Lệnh tái lập

Các lệnh chạy từ repo root, dùng `.env` đang hoạt động:

```powershell
pnpm --filter @kamito/api exec vitest run test/public-rankings.e2e-spec.ts test/public-ranking-payload.e2e-spec.ts test/public-players.e2e-spec.ts --reporter=verbose
pnpm --filter @kamito/api exec vitest run test/public-rankings.e2e-spec.ts --reporter=verbose
pnpm --filter @kamito/api exec vitest run test/ranking-snapshot-immutability.e2e-spec.ts test/ranking-admin-snapshots.e2e-spec.ts --reporter=json --outputFile=test-results/phase-10-snapshot-regression.json
pnpm --filter @kamito/api exec vitest run test/public-bracket.e2e-spec.ts test/public-player-names.e2e-spec.ts test/public-groups-entries.e2e-spec.ts test/public-matches.e2e-spec.ts test/public-events.e2e-spec.ts --reporter=json --outputFile=test-results/phase-10-api-regression-a.json
pnpm --filter @kamito/api exec vitest run test/public-schedule.e2e-spec.ts test/public-results-strip.e2e-spec.ts test/public-site.e2e-spec.ts test/cache-tags-coverage.e2e-spec.ts test/ranking-admin-lists-rules.e2e-spec.ts --reporter=json --outputFile=test-results/phase-10-api-regression-b.json
pnpm --filter @kamito/api exec vitest run src/modules/revalidation --reporter=json --outputFile=test-results/phase-10-api-unit.json
pnpm --filter @kamito/client test
pnpm --filter @kamito/shared test
pnpm --filter @kamito/ranking-engine test
pnpm --filter @kamito/worker test
pnpm --filter @kamito/api typecheck
pnpm --filter @kamito/api lint
pnpm --filter @kamito/client typecheck
pnpm --filter @kamito/client lint
$env:API_PORT='3100'
$env:E2E_CLIENT_PORT='3101'
$env:E2E_WORLD_FILE='D:/Project/wtt/apps/client/test-results/phase-10-world.json'
$env:LOG_LEVEL='warn'
pnpm --filter @kamito/client exec playwright test tests/e2e/rankings-and-players.spec.ts --reporter=list
```

Lượt hồi quy 40 ca dùng thêm `tests/e2e/event-pages.spec.ts`. Playwright global setup/teardown chạy seed và cleanup; probe publish được gọi trong spec, không cần chạy worker dev trên queue chung.

## Lỗi từng gặp và giới hạn

- Chạy gộp API ban đầu gặp tiến trình Windows thoát `3221226505 (0xC0000409)`, không có assertion kết luận. Đã chia thành các nhóm phía trên và chạy đạt; không dùng lượt crash làm bằng chứng thành công.
- Lượt Playwright đầu 16 đạt/6 lỗi: locator ô điểm khớp cả ô bảng ngoài và ô breakdown; kiểm Location dùng URL tương đối sai. Đã thu hẹp locator vào `details`, parse Location với base URL; giữ nguyên kiểm HTTP 301. Sau sửa đạt 40/40, rồi sau F4/probe đạt 24/24.
- Lượt F4 có 30 đạt/1 lỗi vì fixture giải thay thế thiếu `Event.timezone` bắt buộc. Đã bổ sung timezone và chạy lại toàn bộ public rankings 16/16 đạt. Log lỗi ban đầu vẫn giữ để đối chiếu.
- API unit cố ý tạo `ECONNREFUSED 127.0.0.1:1`, timeout và lỗi DB/slug để kiểm fallback. Browser dev có thông báo CSP chặn `eval` của Next dev; ảnh có nút công cụ dev. Không có assertion sản phẩm thất bại ở lượt cuối.
- Chưa đo coverage theo dòng/nhánh, Core Web Vitals hoặc audit accessibility đầy đủ. Probe thời gian chỉ xác nhận local; cần kiểm lại trên staging theo kế hoạch triển khai.

Không còn ca kiểm thử thất bại chưa xử lý trong phạm vi QA nêu trên. Không commit hoặc triển khai trong lượt kiểm tra này.
