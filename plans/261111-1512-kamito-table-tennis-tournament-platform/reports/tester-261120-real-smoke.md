# QA smoke trang giải với dịch vụ local thật — 2026-11-20

## Kết quả

**Đạt bốn threshold hiện có**, process exit **0**: **600 request / 600 iteration**, **600/600 check HTTP 200 đạt**, **0 lỗi 5xx, 0 request failed, 0 dropped iteration**. HTTP p95 **14,125 ms**, p99 **30,986 ms**. Đây là mốc local của trang tổng quan giải; gate tải trên staging vẫn mở.

## Target và an toàn thực thi

- Chỉ chạy sau khi root bàn giao lease `phase1112-smoke`, Lighthouse `r02` đã kết thúc. Không chạy đồng thời browser, Lighthouse hoặc đợt mutation DB khác.
- Target HTTP: `http://192.168.176.1:3314/vi/events/entries-135d5a`. Địa chỉ là WSL default gateway tới ứng dụng local Windows cổng 3314; không phải staging/public domain. Fixture thuộc retained world `apps/client/test-results/261120-real-public-and-axe/public-world-261120-real.json`.
- Đọc image Docker **đã có sẵn** `grafana/k6:2.4.0`, image ID `sha256:d41bb79cd8de5a7ad619b53570e3712633e8bff0937010a5c6c57a4747e7a276`. Không cài tool, không pull image, không đổi firewall/host config. `Get-Command k6` và WSL `command -v k6` không có executable; không suy ra Docker/Redis thiếu.
- Health GET từ WSL tới `/api/health` trả **200** trước run. Container dùng `--pull=never --network host --rm`, mount `tests/load` read-only, không truyền thông tin xác thực DB vào k6.
- Runner chỉ đặt env cho process, không sửa `.env`. `execution.json` xác nhận **`envUnchanged: true`**, `code: 0`, `signal: null`, `elapsedMs: 131997`.
- Sau run, `docker ps -a --filter name=kamito-261120-real-k6-20261120055042249 --format '{{.Names}} {{.Status}}'` trả exit 0 và không có dòng: container riêng đã được gỡ bởi `--rm`. Lease đã trả root/agent chủ world để cleanup; báo cáo này không tự xác nhận cleanup world của agent khác.

## Kịch bản và số đo thực

Mã thực thi: `tests/load/event-page-smoke-test.js`. Một iteration thực hiện đúng một GET, không follow redirect, timeout mặc định 10 s, bỏ body phản hồi; check `response.status === 200`. Kịch bản `constant-arrival-rate`, **cấu hình 5 lượt/s trong 120 s**, preallocated 10 VU / max 50 VU; các tham số vẫn cấu hình qua env.

| Metric | Giá trị thực | Threshold | Kết quả |
|---|---:|---|---|
| `http_reqs` | 600 | Không đặt ngưỡng count | Ghi nhận |
| `iterations` | 600 | Không đặt ngưỡng count | Ghi nhận |
| `event_page_5xx` | 0 | `count==0` | Đạt |
| `http_req_failed` | rate 0 | `rate==0` | Đạt |
| `checks` | rate 1; 600 pass / 0 fail | `rate==1` | Đạt |
| `dropped_iterations` | 0 | `count==0` | Đạt |

Raw `http_reqs.rate` và `iterations.rate` đều **4.659093235332041/s**. Giữ nguyên metric tổng hợp này; **5/s là tham số arrival-rate**, không thay số rate trong raw summary bằng 5 hoặc khẳng định throughput tổng hợp đo được đúng 5/s. Không đủ dữ liệu trong summary để kết luận riêng nguyên nhân cửa sổ tính rate khác cấu hình scenario.

`http_req_failed.values` có `passes: 0, fails: 600, rate: 0`: đây là bộ đếm boolean của metric failed, không phải 600 phản hồi lỗi. Kết luận trạng thái HTTP dựa trên check status 200, đủ 600 pass / 0 fail, không suy từ nhãn `fails` của Rate.

| `http_req_duration` | ms |
|---|---:|
| Trung bình | 9,579 |
| Nhỏ nhất | 5,706 |
| Trung vị | 8,463 |
| p90 | 11,821 |
| p95 | 14,125 |
| p99 | 30,986 |
| Lớn nhất | 79,964 |

Preflight ghi `startedAt: 2026-11-20T05:50:42.875Z`; summary ghi `finishedAt: 2026-11-20T05:52:55.545Z`. Wrapper đo 131.997 ms. Thời lượng 120 s là cấu hình scenario, không phải toàn bộ thời gian preflight/process/summary.

## Lệnh và artifact

Lệnh runner đã chạy từ repo root với `REAL_TEST_DB_LEASE=phase1112-smoke` trong process:

```text
node test-results/261120-real-k6-runner.mjs
```

Runner kiểm lease trước HTTP/container, đọc gateway/health/image metadata, rồi gọi qua WSL Ubuntu:

```text
docker run --rm --pull=never --network host --name kamito-261120-real-k6-20261120055042249 -e EVENT_PAGE_URL=http://192.168.176.1:3314/vi/events/entries-135d5a -e SMOKE_RPS=5 -e SMOKE_DURATION_SECONDS=120 -v /mnt/d/Project/wtt/tests/load:/work:ro grafana/k6:2.4.0 run --quiet /work/event-page-smoke-test.js
```

Artifact riêng tại `test-results/261120-real-k6-20261120055042249/`:

- `preflight.json` và `preflight.log`: target, image/image ID, health 200, cấu hình 5/120.
- `stdout.log`: JSON summary nguyên gốc từ k6; `stderr.log` rỗng.
- `summary.json`: bản parse summary chứa metric/threshold và thời điểm kết thúc.
- `execution.json`: exit 0, signal null, elapsed 131997 ms, envUnchanged true.

Runner/log local nằm trong thư mục ignored; không ghi đè bằng chứng smoke cũ. Không query/migrate/seed PostgreSQL từ smoke runner, không chỉnh cấu hình sản phẩm.

## Giới hạn và bước còn mở

- Chỉ GET HTML của một trang giải local đã có cache; không tải font/ảnh/script như trình duyệt, không đo browser hydration/Core Web Vitals, admin hoặc luồng tournament tám bước.
- Không phải tải phân tán, bài kiểm 50 RPS, traffic production hoặc staging. P95 được lưu làm baseline, không tự thêm threshold latency vào tiêu chí gốc.
- Gate phase 12 ghi rõ staging; cần lặp lại với target staging được duyệt và ghi cùng loại metric. Lighthouse 4/4 và 36 axe scan 0 violation là các lượt kiểm riêng, không cộng thành số iteration/request của smoke.

Không có lỗi mới trong phạm vi smoke cần sửa. Việc dọn retained world/servers do agent giữ ownership thực hiện sau khi nhận RELEASE.
