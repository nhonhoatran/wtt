# Đồng bộ các cổng còn mở — 2026-11-20

## Phạm vi

Tiếp tục các phần có thể chạy của G1/G2, consent, CSP enforce, luồng UI tám bước và rollback/restore. Không coi quyền chạy kiểm thử là duyệt quy chế BTC, đồng ý công khai hoặc chứng nhận staging.

## Sweep đủ 12 phase

Đếm trực tiếp checkbox bằng `test-results/261120-real-final-integrity.mjs` trong lượt này; chưa thay checklist để lấy kết quả local đóng cổng staging.

| Phase | Đã đánh dấu / tổng |
|---|---:|
| 01 | 10/15 |
| 02 | 3/5 |
| 03 | 12/13 |
| 04 | 11/12 |
| 05 | 14/16 |
| 06 | 11/13 |
| 07 | 12/14 |
| 08 | 27/28 |
| 09 | 9/11 |
| 10 | 8/9 |
| 11 | 10/13 |
| 12 | 7/14 |
| **Tổng** | **134/163; 29 mở** |

## Bằng chứng bổ sung đã đạt

- [G1/G2/consent kỹ thuật](../261111-1512-kamito-table-tennis-tournament-platform/reports/reviewer-261120-g1-g2-consent.md): competition engine 230/230, ranking engine 36/36, JSON-LD 1/1 và privacy API thật 17/17. Quyết định nghiệp vụ và consent vẫn chưa có.
- [CSP enforce local](../261111-1512-kamito-table-tennis-tournament-platform/reports/execution-261120-csp-local.md): 95/95 unit, build/typecheck/lint đạt; browser cuối 104 đạt, 8 skip, 0 lỗi, 36 axe scan không violation. Negative/positive nonce control và hydration hai viewport đạt. Giữ cổng staging, mặc định production report-only.
- [Restore local A](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-local-recovery-drill.md): 18 migration, 46 tablecounts/canonical hash/FK và ba S3 object khớp; backup hỏng bị chặn. Cleanup đúng tài nguyên disposable về 0. Chưa thay nghiệm thu rollback release hoặc restore staging.

## Đang thực thi

- [UI tám bước](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-full-ui-flow.md): đã có fixture/reference riêng, browser thật và worker thật; runtime desktop đang sửa lỗi harness phát hiện từ trace trước khi chạy tiếp mobile. Chưa đánh dấu đạt checkbox luồng chính.
- Rollback API component B: hai clean git archive có full commit/tree/hash và manifest riêng; chuẩn bị build/runtime có provenance, không dùng image `latest` cũ thiếu revision làm bằng chứng. Chưa có kết quả chạy để đóng mục này.

## Các cổng giữ mở

G1a/G1b/G2 và consent cần quyết định có chủ sở hữu/phiên bản; M1/M2 và các cổng domain/TLS/Dokploy/Traefik, SEO validator/container phát hành, CSP/hiệu năng/tải và rollback/restore trên staging vẫn cần môi trường cùng bằng chứng tương ứng. Không đổi trạng thái phase thành completed hoặc tự tăng tỷ lệ hoàn thành từ số lượng test.

Kiểm tạm thời: `.env` khớp hash đầu lượt; không có thay đổi schema/migration/env; 266 link nội bộ trong 33 Markdown thay đổi đều tồn tại. Kết quả này là checkpoint trước khi hoàn tất UI/B, cần kiểm lại sau cập nhật cuối.
