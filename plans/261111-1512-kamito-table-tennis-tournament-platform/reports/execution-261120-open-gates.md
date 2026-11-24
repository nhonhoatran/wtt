# Thực thi các cổng còn mở — 2026-11-20

## Phạm vi đã được cho phép

Tiếp tục G1/G2, consent, CSP enforce, luồng UI đủ tám bước và rollback/restore. Thực hiện phần có thể kiểm chứng an toàn trên local; không tự tạo quyết định của BTC, đồng ý của VĐV hoặc chứng nhận staging. Giữ nguyên mọi thay đổi trước lượt này, không commit/push, không sửa `.env` hoặc dùng `prisma db push`.

## Kế hoạch và quyền sở hữu

| Luồng | Chủ sở hữu | Công việc và điều kiện |
|---|---|---|
| G1/G2 và consent | Điều phối | Đọc quyết định hiện có, đối chiếu câu hỏi chưa chốt; kiểm lại guard kỹ thuật về hồ sơ ẩn, noindex, dữ liệu riêng tư, sitemap/Person trên test target đã duyệt. Chỉ ghi gate đóng nếu có quyết định thực sự |
| CSP | Agent phase08 | Scout nonce/hash theo phiên bản Next đang cài, review trước triển khai; kiểm production build, hydration, tài nguyên hợp lệ và negative control script bị chặn. Cấu hình enforce local không thay nghiệm thu domain/staging |
| UI tám bước | Agent phase0910 | Lập ma trận từng bước theo phase12, dùng ADMIN/RESULTS_OPERATOR và trình duyệt thật. Thao tác chính phải UI; không dùng API-only thay cho UI. Chuẩn bị test/helper trước rồi nhận lease dịch vụ thật |
| Rollback/restore | Agent phase1112 | Lập đích Docker/DB/storage disposable có UUID và review trước chạy; chỉ dùng fixture tự tạo, không khôi phục đè DB/volume đang dùng. Kiểm row/hash/thời gian và tương thích bản trước nếu đủ image/source |
| Tổng hợp cuối | Điều phối + các agent | Review chéo, kiểm kết quả, dọn đúng tài nguyên sở hữu; đồng bộ đủ 12 phase/docs/journal theo bằng chứng, giữ các gate ngoài phạm vi còn mở |

## Thứ tự thực thi

1. Scout ba nhánh song song và review kế hoạch trước viết source.
2. Kiểm privacy/consent kỹ thuật trên `localhost:5433/kamito_tt_phase12_test`, namespace test, khi điều phối giữ độc quyền; không query/seed/migrate DB dev. Các runner mới có nhãn timestamp, không ghi đè artifact cũ.
3. Recovery có thể chạy song song nếu toàn bộ container/network/volume tự tạo cô lập và target đã được review; nếu dùng DB test chung phải chờ lease riêng.
4. CSP và UI dùng build/server/world được xác minh ownership; không build `.next` trong lúc server/test đang dùng. Mọi thay đổi setting toàn cục và mutation trên DB test chung chạy tuần tự.
5. Sau mỗi lỗi: lưu baseline, chẩn đoán nguyên nhân rồi sửa hẹp; không bỏ assertion hoặc làm giả dịch vụ để báo đạt. Sau cùng read-back source/artifact và cleanup theo đúng IDs/UUID/PID.

## Trạng thái ban đầu

- Plan hiện hành ghi G1a/G1b/G2 và câu hỏi đồng ý công khai chưa có trả lời. Chưa tìm thấy quyết định mới trong lần đọc ban đầu; tiếp tục đối chiếu tài liệu, không tự coi lệnh chạy test là duyệt quy chế.
- Cờ `isPublicProfile`, `noindex`, `publicDisplayName`, loại trừ sitemap/Person đã có; cần xác nhận guard thực tế. `noindex` không thay cho quyết định đồng ý công khai.
- CSP hiện là report-only trong `apps/client/next.config.ts`, còn inline script/style và iframe hosts trong code.
- Rollback/restore staging và full UI tám bước chưa có bằng chứng đủ từ các lượt trước. API-driven probe 133 ms không được gọi là full UI.
- Baseline toàn plan: 134/163 checkbox, 29 mở. Không tách checklist chỉ để tăng tỷ lệ.

Kết quả và giới hạn sẽ cập nhật theo artifact của từng nhánh; bản kế hoạch này không tự xác nhận các bài kiểm chưa chạy.

## Tiến độ kiểm được

- Điều phối chạy lại privacy API: profile 14/14, sitemap 3/3 đạt trên target test đã duyệt; cả hai teardown hoàn tất, `.env` không đổi. Competition engine 230/230, ranking engine 36/36 và JSON-LD unit 1/1 đạt. Chi tiết quyết định và giới hạn tại `reviewer-261120-g1-g2-consent.md`; không dùng kết quả này để đóng G1/G2/consent.
- Recovery A: lượt đầu lỗi kết nối trước migrate/seed/dump; diagnostic chứng minh PG ready nhưng network internal không có published port thực. Sau review đổi sang dedicated bridge UUID (vẫn bind loopback, không đụng network/volume shared), lượt cuối đạt 18 migration, hash/46 tablecounts/FK và ba S3 object; cleanup riêng đều 0. Đây là restore local, chưa phải rollback ứng dụng hoặc staging.
- CSP local enforce đã hoàn tất: **95/95 unit**, production build/typecheck/lint đạt; browser cuối **104 đạt / 8 skip theo viewport / 0 lỗi**, gồm 6 ca CSP và 36 axe scan không violation. Giữ baseline lỗi assertion, regression prefetch đã sửa và native exit trước browser riêng. [Báo cáo CSP](./execution-261120-csp-local.md) có negative/positive control và cleanup exact ID về 0; không bật mặc định production hoặc đóng staging.
- UI tám bước đã có source, helper và reference/config mẫu; static check đạt, đang chạy runtime tuần tự desktop rồi mobile. Phát hiện thiếu nút rút khỏi bảng trong admin; sửa hẹp dùng lại preview/reason/version/RBAC của modal hiện có. MS40 dùng tám suất trực tiếp +32 vòng loại → tám suất vào main16 để kiểm reopen với downstream thật trước placement; không đổi default nghiệp vụ. Lượt desktop đầu đã khởi động API/admin/Next/worker thật, dừng ở bước 1 do selector tìm sai nút lưu; raw trace/log giữ lại và cleanup đạt. Chưa gọi là hoàn tất luồng UI.

## Kế hoạch bổ sung rollback component API

Restore A không tự chứng minh bản ứng dụng trước chạy trên schema mới. Điều phối đã đọc `docker/api.Dockerfile` và kiểm Docker manifest thật: base được ghim `node:24.22.3-alpine3.23` tồn tại, linux/amd64 digest `sha256:30bd1b393bad515bdd6ac3c299783aa8dbc6e98dec609e44665a770463269663`.

Đề xuất bước B để review trước thực thi:

1. Stage **git archive riêng** của `9648eb4` và `59279ac` vào thư mục mới dưới `test-results/`, không checkout/reset/stash working tree. Đây là hai source snapshot có commit provenance, không gọi là hai bản phát hành production đã được chứng nhận.
2. Build hai image **API** có tag/label UUID + full revision từ source archive, dùng Dockerfile hiện có và base ghim digest. Không build từ root checkout có artifact/credentials đang ignored; không đưa `.env` thật, private manifest hoặc node_modules Windows vào image. Không cài pnpm qua WSL lên checkout Windows.
3. Tạo lại môi trường fixture disposable theo guard của recovery A, thêm Redis riêng và API container loopback port mới, không dùng DB/Redis/storage shared. Schema mới có 18 migration; snapshot cũ có 17, delta là ba cột TEXT nullable bổ sung.
4. Chạy image mới, kiểm live/ready và đọc bài viết/media fixture qua public API với SSR secret tạm; dừng đúng container mới rồi chạy image cũ trên **cùng DB 18 migration**. Kiểm live/ready, nội dung và hash dữ liệu/schema giữ nguyên; không chạy migrate-down hoặc xóa cột để làm bản cũ khởi động được.
5. Ghi commit/image IDs, target, thời gian, raw status và giới hạn; cleanup đúng IDs/label của API/Redis và môi trường fixture. Nếu build/runtime thất bại, giữ log và chẩn đoán, không gọi static diff là runtime proof.

Phạm vi B chỉ là API component rollback local. Client/admin/worker, Dokploy/Traefik, rollback toàn bộ release và staging vẫn cần diễn tập riêng. Chỉ bắt đầu build sau khi có review kế hoạch và không chạy trùng bài đo hiệu năng khác.
