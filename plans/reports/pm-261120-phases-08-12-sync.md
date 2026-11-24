# Đồng bộ kế hoạch phase 08–12 — 2026-11-20

## Kết quả sweep

Đọc đủ 12 file `phase-*.md` cấp trên cùng trong `plans/261111-1512-kamito-table-tennis-tournament-platform/`. Đếm checkbox gạch đầu dòng `^- \[x\]` và `^- \[ \]`, gồm checklist mẫu UI phase 08; không đếm lại Implementation Steps.

| Phase | Hoàn tất/tổng | Mở | Quyết định trong lượt này |
|---|---:|---:|---|
| 01 | 10/15 | 5 | Không có bằng chứng mới để đóng hạ tầng/CI/sao lưu |
| 02 | 3/5 | 2 | Spike D staging và dọn spike vẫn mở |
| 03 | 12/13 | 1 | Deploy/migrate staging vẫn mở |
| 04 | 11/12 | 1 | Deploy/migrate staging vẫn mở |
| 05 | 14/16 | 2 | Staging, file Excel thật/pilot vẫn mở |
| 06 | 11/13 | 2 | G1b/staging và các quyết định quy chế vẫn mở |
| 07 | 12/14 | 2 | Đo/deploy staging; nợ E2E/UI chưa có bằng chứng mới |
| 08 | 27/28 | 1 | Sửa print64, không lấy kiểm offline thay M1/M2 |
| 09 | 9/11 | 2 | Bổ sung unit state ma trận, không đóng G2/staging |
| 10 | 8/9 | 1 | Không đổi feature; staging vẫn mở |
| 11 | 10/13 | 3 | Suite publishing mở rộng mới typecheck/liệt kê; DB/storage/staging vẫn mở |
| 12 | 7/14 | 7 | Có công cụ axe/Lighthouse, chưa có số đo sản phẩm hoặc nghiệm thu ra mắt |
| Tổng | **134/163** | **29** | **82,2 % theo checkbox**, không theo ngày công/độ sẵn sàng phát hành |

Không đổi checkbox hoàn tất hoặc trạng thái cổng; không thêm checkbox chỉ để ghi tiến độ công cụ. `plan.md` tiếp tục `in-progress`. Các mục hoàn tất ở phase trước không có ánh xạ mới cần backfill trong lượt này.

## Ánh xạ công việc đã làm

| Gói | Ánh xạ yêu cầu | Bằng chứng và giới hạn |
|---|---|---|
| Print64 + desktop 1440 | Phase 08 in nhánh 64, tên không cắt, 1440/390 | 9 test + tám PDF đọc độc lập đạt; component/CSS/font thật, không API/DB. [QA](tester-261120-phase08-print64-desktop1440.md) |
| Unit admin ranking | Nợ unit trong sync phase 09 ngày 2026-11-16 | 18 ca state mới; admin 29 ca duy nhất, ranking-engine 36 ca đạt. Không xác nhận lifecycle hook/browser. [QA](tester-261120-phase09-admin-unit.md) |
| CMS publishing regression | Phase 11 publishing/sweep/retention | Suite năm ca được typecheck/liệt kê; chưa query/migrate/seed hoặc chạy DB tích hợp trong lượt này |
| axe/Lighthouse | Phase 12 khả năng truy cập/hiệu năng | Bốn ca axe liệt kê; runner có self-check. Chưa đo sản phẩm hoặc đóng ngưỡng staging |
| Hồi quy nguồn | Phase 11–12 baseline code | API unit 182, shared 104, worker 44, client 72 đạt sau bật riêng Redis; không phải ma trận API tích hợp. [Kiểm độc lập](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-local-checks.md) |

Đã sửa mô tả M1: tree hiện tại không có `vertical-slice.spec.ts`; suite đọc trang/in không tự chứng minh luồng admin tạo → công bố → chốt → SSR.

## Đồng bộ tài liệu

- `plan.md` và phase 08/09/11/12: cập nhật bằng chứng theo ngày, giữ lịch sử và các cổng mở.
- `docs/public-site.md`: cách chia trang in, bằng chứng PDF, giới hạn kiểm offline.
- `docs/deployment-guide.md`: desktop 1440, cách chạy print/axe/Lighthouse, tách công cụ khỏi nghiệm thu.
- `docs/development-roadmap.md`, `docs/project-changelog.md`: tiến độ đầy đủ, đóng nợ unit state nhưng không đóng phase.
- Journal ghi ngắn quyết định và giới hạn của lượt thực thi. Không đưa xưng hô cá nhân vào file.

## Hardening và kiểm sau cài dependency cuối

- `pnpm-workspace.yaml` thêm override có phạm vi `@prisma/config>effect: 3.22.1` sau audit phát hiện Effect 3.20.0 high. Reviewer kiểm lockfile, dependency runtime thực và raw audit `test-results/261120-phase0812-audit-review-final.json`: **0 high/critical, 2 moderate**; audit exit 1 do moderate, không phải sạch mọi lỗ hổng.
- Frozen install đã thành công sau phục hồi các symlink Windows/WSL; không sửa schema/migration hoặc `.env`. Chi tiết phạm vi repair và review ở [review độc lập](../261111-1512-kamito-table-tennis-tournament-platform/reports/code-reviewer-261120-phases08-12.md).
- Packet tester cuối xác nhận client production build, Prisma validate/generate/DB build, API/worker typecheck/build exit 0; API 182, client 72, admin 29, shared 104 và worker 44 ca chạy lại đạt sau frozen install. Không query/seed/migrate PostgreSQL trong các kiểm này. [QA tổng](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-local-checks.md).
- Print late-check mở rộng fixture sang EventShell/EventHero đầy đủ, hai chooser và tiêu đề như trang thật: A4 tái hiện sáu trang trước sửa. Sau ẩn hero/tiêu đề dư riêng ở print nhiều tờ, 9/9 ca và tám PDF độc lập đạt lại; screen và print nhánh nhỏ giữ ngữ cảnh cũ. Báo cáo print lưu cả hai baseline để không nhận fixture đơn giản ban đầu là toàn bộ kiểm cuối.
- Tester độc lập chạy thêm client typecheck/lint/build và unit 72/72 sau marker print cuối, đều đạt. Runbook ghi chọn một runtime Node/pnpm cho cùng checkout/`node_modules`, WSL dùng Docker; tránh cài Windows/WSL xen kẽ gây lại lỗi symlink.

## Kiểm tài liệu

- `node .claude/scripts/validate-docs.cjs docs/`: exit 0, **245 liên kết nội bộ hoạt động, không báo link thiếu** sau sửa link report QA tổng và đồng bộ bằng chứng cuối.
- Checker vẫn cảnh báo 378 code reference và 717 config key theo heuristic. Mặc định công cụ không quét các thư mục `apps`/`packages`, gọi `grep` từ Node và cũng coi enum/error code như biến môi trường; ví dụ `TrustedOriginMiddleware`/`SessionGuard` có thật trong source. Không ghi kết quả này thành sạch mọi cảnh báo tài liệu.
- Đếm lại bằng PowerShell: 12 file, 134 hoàn tất, 29 mở, tổng 163. `git diff --check` đạt; phạm vi file sửa không chứa xưng hô riêng tư. Các tài liệu sửa dưới 800 dòng; `system-architecture.md` giữ nguyên 800 dòng, không bị sửa.

## Chưa giải quyết

1. Xác nhận target PostgreSQL trước khi query/migrate/seed hoặc chạy fixture tích hợp mới; container PostgreSQL chưa được bật trong lượt này.
2. G1/G2 và consent cần BTC/chủ dự án chốt; không sửa giá trị nghiệp vụ dựa trên suy đoán.
3. Hạ tầng staging/Dokploy/Traefik, M1/M2, full E2E tám bước, CSP enforce, Lighthouse/axe/load, rollback/restore và backup/RPO vẫn mở.
4. Hai moderate (`uuid`, `minimatch`) còn trong audit; bộ công cụ mới và bản vá dependency không thay số đo sản phẩm hoặc bằng chứng staging còn thiếu.
