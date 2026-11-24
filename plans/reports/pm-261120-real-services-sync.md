# PM sync — lượt dịch vụ thật phase 08–12

- Ngày: 2026-11-20. Nguồn: 12 file `phase-*.md` cấp trên cùng, mã thay đổi và báo cáo/raw artifact của lượt API, browser/axe, probe dọc.
- Phạm vi ghi: phase 08–12 + `plan.md`; **không sửa docs chung** do agent khác sở hữu. Không query/migrate/seed DB trong công việc PM.
- Trạng thái: **in-progress**. Sweep giữ **134/163 checkbox (82,2 %), 29 mở**; không thêm/tách checklist để tăng phần trăm từ bằng chứng local.

## Bằng chứng mới đã xác nhận

| Nhóm | Kết quả | Nguồn |
|---|---|---|
| DB test riêng | Target `localhost:5433/kamito_tt_phase12_test` đã được xác nhận; 18 migrations up to date; seed cấu hình test đạt; không áp migration mới hoặc query/seed dev/staging | `test-results/261120-real-db-setup.log` |
| API thật | 21 spec / **132 ca duy nhất đạt**, PostgreSQL/Redis thật; hash `.env` mỗi lượt không đổi | [QA API](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-api.md), `test-results/261120-real-api-manifest.json` |
| Publishing/CMS | 5 publishing + 15 articles/resources/contact đạt, nằm trong 132; sweep cứu job mất, retry idempotent, retention 7 → 2 ngày thật | QA API, không cộng trùng 7 ca rerun artifact |
| Public browser production sau sửa | **104 listed = 96 đạt + 8 skip có chủ đích; 0 lỗi, 0 flaky**, workers1/retries0; 1440×900 và 390×844 | [QA public/axe](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-public-and-axe.md), `apps/client/test-results/261120-real-public-and-axe/full-03/results.json` |
| Accessibility | **36 axe scan, mọi impact đều 0 violation** sau sửa; 9 route × vi/en × hai viewport. Baseline trước sửa có 16 serious rule-occurrence, giữ riêng | `full-03/axe-summary-extracted.json`, baseline `full-02/` |
| Metadata build tiếp theo | Client **83/83 unit**, typecheck/lint/build đạt; browser focused SEO/chrome + axe **27 đạt / 5 skip / 0 lỗi / 0 flaky**, 36 axe scan mới 0 violation. Retained world hash không đổi, không setup/teardown lại | QA public/axe phần `metadata-after`; không gọi full-03 96/8 là rerun trên metadata build, không cộng trùng |
| Công bố kỳ BXH → SSR | **209 ms desktop / 218 ms mobile**, API admin thật → worker BullMQ riêng → SSR có cache | Hai file `full-03/ranking-publish-refresh-*.json`; không đổi thành số đo staging |
| Probe dọc chốt trận | **133 ms**, trước chốt cache draw/match còn **29.978/29.947 ms**, 1 job revalidation; cleanup event/player/cache/UUID queue/login keys đều 0 | `test-results/261120-real-vertical-slice-20261120051744375.{probe,cleanup}.json` |
| Lighthouse local | `r02` **4/4 đạt** ngưỡng 85/90/95: home P100, event99, draw100, ranking100; A100/S100 trên cả bốn trang. Giữ riêng `r01` fail SEO92 và native crash ranking trước sửa metadata | [QA Lighthouse](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-lighthouse.md), `apps/client/test-results/261120-real-lighthouse/r02/summary.json` và bốn LHR |
| Smoke local | Cấu hình **5 arrival/s × 120 s**; thực **600 request/iteration, 600 check HTTP 200 đạt**, **0 failed/5xx/drop**, bốn threshold đạt, exit 0. p95 **14,125 ms**, p99 **30,986 ms**. Raw rate tổng hợp **4,659093/s** được giữ riêng; `.env` hash không đổi | [QA smoke](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-smoke.md), `test-results/261120-real-k6-20261120055042249/{summary,execution}.json` |

Không cộng các tổng API/browser với unit cũ thành số test duy nhất của toàn dự án. Hai số đo ranking publish và số đo chốt trận là các luồng khác nhau. Bằng chứng local không thay cổng staging.

## Sweep đủ 12 phase

| Phase | Đạt/tổng | Ô còn mở / quyết định |
|---|---:|---|
| 01 | 10/15 | Repo decision còn phần tên/push; preflight hạ tầng, sao lưu/RPO, Dokploy/staging, bằng chứng CI GitHub. Không đóng bằng test local |
| 02 | 3/5 | Spike D staging; dọn spike/schema chờ duyệt. Không xóa trong lượt này |
| 03 | 12/13 | Deploy/migrate staging |
| 04 | 11/12 | Deploy/migrate staging; S3/MinIO không được xác nhận bằng storage local |
| 05 | 14/16 | Deploy/migrate staging; file Excel thật/pilot |
| 06 | 11/13 | G1b và staging; không lấy quy tắc mẫu làm câu trả lời BTC |
| 07 | 12/14 | Đo ≤5 s trên staging, deploy staging. Probe 133 ms local không đóng hai ô |
| 08 | 27/28 | M1 gắn deploy staging + lát cắt. Cập nhật bằng chứng API-driven local và public browser; giữ ô mở |
| 09 | 9/11 | G2 và staging. Không có thêm test ranking-admin/flow/performance trong lease API mới; 18 unit state là bằng chứng riêng |
| 10 | 8/9 | Deploy/đo staging. Cập nhật API rankings/players/payload 31 ca và hai phép đo ranking publish browser mới |
| 11 | 10/13 | Target/migration dev-staging; toàn bộ ma trận CMS/vận hành; staging. DB test đã được duyệt nhưng không phải dev/staging; worker schedule theo giờ, admin UI với dịch vụ thật và storage chưa đủ ma trận |
| 12 | 7/14 | Finding/planning rà tổng, SEO validator/container phát hành, CSP enforce, Lighthouse/axe/load theo gate staging, full 8-step UI E2E, rollback/restore, verifying toàn site/admin vẫn mở |
| **Tổng** | **134/163** | **29 mở, 82,2 % theo checklist** |

## Cách cập nhật checklist

- **Không có ô `[ ]` cấp phase nào đủ điều kiện đổi thành `[x]` chỉ từ lượt local này.** Không tạo checkbox mới để biến công cụ/test bổ sung thành tăng phần trăm.
- Phase 08: cập nhật ô M1 còn mở bằng proof API-driven 4-entry draw → operator confirm → BullMQ → SSR 133 ms; tiếp tục yêu cầu staging và workflow browser.
- Phase 09: giữ G2/staging; ghi API public là consumer snapshot, không claim kiểm lại toàn bộ engine/quy chế/admin.
- Phase 10: bổ sung API 31 ca, payload 1.000 khoản 377.129 byte raw / 9.303 byte gzip; công bố BXH qua worker 209/218 ms local; giữ staging.
- Phase 11: cập nhật hai ô còn mở để phân biệt **target test đã xác nhận** với target dev/staging chưa được duyệt; publishing5/CMS15 và browser thật là phần đã có bằng chứng, không phải toàn bộ ma trận scheduler/admin/storage.
- Phase 12: ô public Playwright **đã checked từ trước** được cập nhật số mới 96/8 và 36 axe scan sau sửa; các ô hợp nhất Lighthouse/axe/load, UI toàn site hoặc E2E 8 bước không được đóng bởi chín loại route public.
- Giữ các đoạn/báo cáo trước khi target test được duyệt làm snapshot lịch sử; phần “Lượt dịch vụ thật tiếp theo — 2026-11-20” ghi trạng thái mới để không diễn giải lại lịch sử.

## Hạn chế và lỗi được giữ công khai

- Một lần API gộp crash Windows **3221226505 (`0xC0000409`)** sau sitemap, chưa có kết luận nguyên nhân native và chưa chứng minh mọi partial fixture của lượt lỗi đã dọn. Đã chạy từng spec một process tuần tự, giữ isolation và log gốc; 132 ca tính từ JSON hoàn chỉnh của lượt đạt.
- Hai JSON generated legacy payload/EXPLAIN đã bị ghi đè ở lượt API đầu do test có đường dẫn cố định. Không có backup trước lượt chạy, không claim restore. Hai spec đã dùng `API_TEST_ARTIFACT_DIR`, rerun đạt và output riêng theo run ID; raw Vitest log/JSON lịch sử giữ nguyên.
- Baseline browser có 0 critical nhưng **16 serious**; không che bằng câu “axe pass”. Hai fix hẹp giữ nhãn đọc movement bằng text thật và dùng token nền đậm cho nút video; gate nâng lên critical+serious. Lượt production `full-03` mới xác nhận 36 scan 0 violation.
- Lighthouse `r01` không đạt SEO92 trên ba trang vì thiếu meta description, dù Performance/Accessibility đạt; ranking crash native, không tính là có điểm. Đã sửa metadata với regression: 83 unit và focused browser 27/5 cùng 36 axe scan mới đạt. Lighthouse `r02` mới xác nhận4/4 đạt từ raw summary và LHR riêng. Không xóa baseline hoặc hạ ngưỡng.
- Các bài quét accessibility chỉ phủ chín loại route public; chưa phải kiểm thủ công toàn site/admin và vẫn giữ các rule incomplete trong raw output.
- Worker publishing processor + queue thật không chứng minh scheduler tự đăng đúng giờ trên staging. Probe API-driven 4-entry draw không thay luồng admin-browser đầy đủ 8 bước gồm import, vòng loại/vòng bảng, sửa/mở lại, thay quy tắc và công bố BXH.
- Staging/Dokploy, G1/G2, pilot, consent, CSP enforce, phát hành container, sao lưu/khôi phục và rollback không có bằng chứng mới để đóng.

## Preflight công cụ tải

- `Get-Command k6` trên Windows không tìm thấy; `command -v k6` trong WSL Ubuntu trả exit127. Docker image local có **`grafana/k6:2.4.0`, ID `d41bb79cd8de`**; daemon Ubuntu24.04.4, không giả định DNS Docker Desktop.
- WSL default gateway đọc được là `192.168.176.1`; sau khi nhận lease smoke mới health GET từ WSL đến3314 và nhận200. Runner dùng `--network host`, `--pull=never`, mount script read-only, không tải/cài thêm tool. Không chạy smoke song song Lighthouse.
- Kịch bản hiện có cấu hình 5 arrival/s trong 120 s mặc định, chặn 5xx, failed requests, failed checks và dropped iterations. Đã thực thi đủ 600 request, 600 check HTTP 200, 0 failed/5xx/drop, exit 0; p95 14,125 ms. Raw aggregate rate 4,659093/s không đổi thành 5/s. Public rate defaults 600 lượt/60 s trong registry không được suy thành mọi setting runtime khi chưa đọc site config ở lượt smoke.
- Giấy phép k6 được xác nhận ở [README chính thức Grafana/k6](https://github.com/grafana/k6/blob/master/README.md#license): AGPL-3.0. Đây là xác nhận công cụ, không phải kết quả tải.

## Chốt số đo và bàn giao

- Lighthouse bốn trang và smoke 600 request đã có raw report đạt. Smoke không chạy đồng thời audit; container riêng `--rm` đã không còn trong `docker ps -a` theo exact name, lease đã trả root/agent chủ world để cleanup. Không tự nhận cleanup world của agent khác.
- Root giữ báo cáo thực thi tổng; agent docs giữ tài liệu chung; PM chỉ sửa phase 08–12, `plan.md` và báo cáo này. Sweep đủ 12 phase giữ 134/163, 29 mở; không đổi trạng thái phase sang completed.
- Cần môi trường/target staging đã duyệt, câu trả lời G1/G2/consent, luồng admin-browser đủ tám bước, CSP enforce và diễn tập backup/rollback/restore để đóng các gate tương ứng. Không còn số đo local đang chờ trong packet này.
