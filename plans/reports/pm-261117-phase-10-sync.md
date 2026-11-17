---
date: 2026-11-17
plan: 261111-1512-kamito-table-tennis-tournament-platform
status: in-progress
---

# Đồng bộ toàn bộ kế hoạch sau phase 10

Đã rà 12 file `phase-XX-*.md` cấp trên cùng, đối chiếu công việc hoàn tất với nguồn, QA, review và checklist hiện có. Phase 10 hoàn tất code/kiểm thử/verifying local, còn deploy staging; toàn kế hoạch giữ `in-progress`. Không commit, deploy hoặc sửa source trong lần đồng bộ này.

## Kết quả rà soát

| Phase | Trước: đạt/tổng | Sau: đạt/tổng | Xử lý |
|---|---:|---:|---|
| 01 | 10/15 | 10/15 | Giữ 5 mục hạ tầng/Git/CI chưa đủ bằng chứng; account/email đã chốt, tên repo còn mở |
| 02 | 3/5 | 3/5 | Giữ Spike D staging và dọn spike/schema cần duyệt |
| 03 | 12/13 | 12/13 | Giữ deploy/migrate staging |
| 04 | 11/12 | 11/12 | Giữ deploy/migrate staging |
| 05 | 14/16 | 14/16 | Đóng ghi chú nợ 301 và cập nhật bảng tiêu chí whitelist bằng QA phase 10; không đổi hai checkbox staging/pilot |
| 06 | 11/13 | 11/13 | Giữ G1b và staging; G1a vẫn theo cổng chung |
| 07 | 12/14 | 12/14 | Giữ đo revalidation staging và deploy; phép đo phase 10 local không thay mục này |
| 08 | 15/28 | 27/28 | Backfill 12 mẫu UI đã triển khai/kiểm; còn staging/M1; nợ riêng UI/bản in không tự đóng |
| 09 | 8/10 | 9/11 | Tách verifying đã xong khỏi deploy staging; G2 chưa có xác nhận |
| 10 | 0/8 | 8/9 | Đánh dấu code/test/verifying; tách deploy staging còn mở |
| 11 | 0/9 | 0/9 | Chưa có công việc CMS hoàn tất để đối chiếu |
| 12 | 0/9 | 0/9 | Metadata/SEO/bản vá trong phase 10 là phần nhỏ; chưa đủ đóng hạng mục hardening/ra mắt toàn site |
| **Tổng** | **96/152** | **117/154 (76,0 %)** | **37 checkbox mở; tăng tổng 2 vì tách verifying/deploy** |

Đếm bằng `Get-ChildItem -Filter 'phase-*.md'` không đệ quy và regex checkbox đầu dòng. Không tính checklist trong thư mục `ui/` vào tỷ lệ phase. Tỷ lệ cơ học không biểu thị nghiệm thu staging hoặc tỷ trọng ngày công.

## Ánh xạ công việc và bằng chứng

- Phase 10: API/SSR bốn route, snapshot bất biến, native details không JS, hồ sơ opaque, private 404, GET/HEAD legacy/gộp 301, rule theo endDate, link VĐV, cache/metadata/ranking sitemap → 8 mục hoàn tất trong phase 10. [QA](tester-261117-phase-10-public-rankings-players.md), [review 9,5/10](code-reviewer-261117-phase-10-public-rankings-players.md), [8 ảnh](screenshots-261117-phase-10/).
- Phase 05: 301 trước đây ghi chờ phase 10 → đã kiểm local; chuỗi gộp chỉ tới đích active/public. Whitelist public đã được hồi quy, alias che tên thật vi/en. RSC prefetch có fallback Next 308, ghi rõ trong phase 05/10.
- Phase 08: [verifier đợt 2–3](ui-verifier-261114-phase-08-batch-2.md) xác nhận khung/heading/bảng/empty và các sửa sau review; đối chiếu `EventShell`, `EventHero`, `PillNav`, `FilterForm`, `PaginationLinks`, `ScrollRegion`, `LiveBadge`, stylesheet bảng/ô/thẻ, dictionary/date và 18 ca trang giải đạt trong lượt hồi quy phase 10. Giữ ngoại lệ đã phân xử: EventShell thay layout riêng, trang trận có đầu trang riêng, select nội dung ở tab Trận, nền LIVE sâu. Không diễn giải 12 checkbox thành tuyên bố đã sửa mọi nợ UI hoặc bản in.
- Phase 09: verifying có bằng chứng sẵn ngày 2026-11-16 tại `ui/phase-09-ui-plan.md`, nay tách khỏi staging; bổ sung ghi chú `eventId` trong JSON snapshot kỳ mới từ id ledger có sẵn. Không migration hoặc sửa kỳ đã công bố.
- Các phần giao phase 12 (metadata/canonical/noindex, không Person JSON-LD/sitemap VĐV, Next 16.4.5) đã ánh xạ vào phase 10; không đánh dấu hoàn tất SEO/hardening toàn site.

## Kiểm chứng và giới hạn

QA ghi API tích hợp **111/111 / 15 file** riêng biệt, API unit **16/16**, client **45/45**, shared **101/101**, engine **36/36**, worker **39/39**. Playwright cuối sau F4 **24/24**, không bỏ qua; lượt hồi quy trước đó **40/40** gồm 18 ca trang giải. Build cuối API/worker/client đạt; Next 16.4.5 đã hết lỗi chặn build. Các ca chạy lặp không cộng thêm vào tổng.

Luồng admin step-up/publish thật → BullMQ → SSR đã có cache đổi trong **644 ms local**, artifact `apps/api/test-results/public-ranking-publish-refresh.json`. Chưa có bằng chứng staging.

Ngân sách **80 KiB đo HTTP gzip**, không áp dụng JSON thô: fixture 50 dòng × 20 khoản giữ đủ 1.000 khoản, **377.129 byte JSON / 9.307 byte gzip**, `rawBudgetMet=false`, `gzipBudgetMet=true` tại `apps/api/test-results/public-ranking-payload-budget.json`. Chưa bảo đảm trần tuyệt đối cho lịch sử không giới hạn. Snapshot cũ thiếu `eventId` che nhãn/link/mã hạng giải, giữ điểm/vòng/ngày tới kỳ mới; không sửa dữ liệu bất biến.

## Việc tiếp theo và ánh xạ còn mở

- Chờ preflight/sao lưu/Dokploy của phase 01 để deploy, migrate và kiểm lại revalidation staging; M1/M2, pilot và số đo staging chưa đạt.
- G1a/G1b/G2, đồng ý công khai và các câu hỏi nghiệp vụ vẫn cần câu trả lời ngoài repo; không dùng dữ liệu mẫu hoặc test local để đóng cổng.
- Giữ file Excel thật, nợ UI/bản in đã ghi ở phase trước và các vấn đề Windows/đồng thời chưa được chứng minh xử lý. Không suy từ một lượt test sạch rằng lỗi ngẫu nhiên cũ đã hết.
- **Không có công việc hoàn tất nào trong phạm vi phase 10 chưa ánh xạ được.** Các mục chưa có bằng chứng được giữ mở; không tuyên bố toàn kế hoạch hoàn tất.
