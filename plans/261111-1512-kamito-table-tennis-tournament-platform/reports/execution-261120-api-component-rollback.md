# Kiểm rollback API component local — 2026-11-20

## Kết quả hiện hành

Đã dựng thành công image API của commit current `9648eb49713bedd34c3422833e0015e7452d58cd`. Build previous `59279ac3684f9e97bcede76e8288244a662eb90c` bị dừng bởi guard dung lượng ổ C thực còn khoảng **3,27 GB**, thấp hơn mức tối thiểu **6 GiB**. Chưa chạy hai API trên cùng schema; **chưa có runtime rollback PASS**. Không tạo container, DB, volume, network hay S3 fixture của B.

Đã xác nhận cả hai BuildKit history đều kết thúc và không còn Windows child build; trả heavy window cho đội full UI. Giữ image current, archive và cache theo điều phối để đánh giá phương án dung lượng. Không prune cache/image/volume của project khác, không đổi WSL config, compact/shutdown VM hoặc hạ guard để chạy tiếp.

## Phạm vi được duyệt

Hai image lấy từ git archive đã niêm phong, không lấy source chưa commit hoặc root build context. Runtime dự kiến chỉ là kiểm hai committed API components đọc cùng fixture 18 migrations với PostgreSQL/S3/Redis riêng; không checkout git, down migration, dùng DB dev/staging hoặc gọi đây là rollback toàn release.

Source builder: `test-results/261120-api-rollback-images.mjs`. Source runtime: `test-results/261120-api-rollback-runtime{,-support,-fixture}.mjs`; strict image cleanup: `test-results/261120-api-rollback-image-cleanup.mjs`. Mỗi runtime helper dưới 200 dòng. Recovery A constructor nhận optional lease/directory options, default A giữ nguyên.

## Provenance và kiểm trước chạy

Thư mục sealed: `test-results/261120-api-rollback/67e49e56-f2bf-4817-98ec-d3443c968bd7/`. Đã tự tính lại ZIP SHA256, full commit/tree và source hash của current **1116 file**, previous **1095 file**, đều khớp manifest. Không có symlink, `.env` thật, `node_modules`, `dist`, `.next`, `test-results` hoặc key artifact bị cấm trong source context. 18 migration SQL workspace khớp byte hash với archive current; previous có 17 migration.

Pinned base: `node:24.22.3-alpine3.23@sha256:30bd1b393bad515bdd6ac3c299783aa8dbc6e98dec609e44665a770463269663`. Trước build chưa có base local; Docker đã resolve chính reference này. Redis local được inspect Linux/amd64, ID `sha256:da23c2478319ceb4903857d77a2fd7aa5137d9e9d4c8165dafbacedac6403e95`, đã pin guard. Actual API entrypoint sẽ được kiểm sau image build; nếu kế thừa Node wrapper, phải xác minh exact exec-only bytes và SHA từ owned stopped container trước start.

Pure self-check đạt: target guard B từ chối hai DB ngoài phạm vi, migration entrypoint và ID path sai; image cleanup một positive/ba negative; Recovery A self-test vẫn một positive/năm negative. Syntax các helper đạt. Không tính các self-check này thành kiểm API/DB sản phẩm.

Runtime plan được điều phối review: `test-results/261120-api-rollback-runtime-plan-0bd9bd7a-8fff-47d2-9618-369f01e7433c.json`. Dự kiến source PG `localhost:55432/kamito_recovery_7ab83b5f_source_test`, S3 19010, Redis chỉ network riêng, API loopback 55434; UUID labels/tên/IDs riêng. Không dùng `.env` credential hay inherited dotenv cho API fixture; API config lấy allowlist defaults từ archive `.env.example` cùng credential mẫu ngẫu nhiên.

Schema hash gồm columns, constraints, indexes, enum, functions, trigger definition/enabled, view, policy/RLS và sequence definitions. Row hash đọc mọi bảng cùng sequence `last_value`/`is_called`; chỉ SELECT, không gọi `nextval` hoặc `setval`. Peer review phát hiện hai blindspot trigger enabled/sequence state và đã bổ sung trước runtime. Nếu chạy tiếp phải kiểm health live/ready, article GET có SSR secret và negative 403, rồi giữ nguyên schema/row/S3 hash sau current và previous.

## Lượt build thật và dừng an toàn

- Log nguyên bản: `build-runner-01.log`, `build-current.log`, `build-previous.log`, `build-manifest.json` trong thư mục sealed. Không ghi đè bằng retry.
- Current image ID: `sha256:9589465ac5efeef6c1157e09e7a00ae9ab47269ace96740cc2d48e9c898c779f`; label build UUID và revision được builder kiểm trước khi ghi manifest.
- C/D trước build previous lần lượt **13.737.078.784 / 28.421.234.688 byte**. Sau khoảng 62 giây build previous, guard phát hiện C dưới 6 GiB và dừng đúng child build được kiểm PID/parent/command line. Đo lại trực tiếp: C **3.270.938.624 byte**, D **28.270.575.616 byte**; đây là thiếu dung lượng thật, không phải JSON parsing flake.
- BuildKit current `default/default/yoos8wplo6bq8bzums122mx9j`: Completed, `09:16:47Z`. Previous `default/default/id3ylfo3vcfab96l68uyvcmbs`: Error, `09:18:23Z`. Bằng chứng `buildkit-quiet-after-abort.json` xác nhận hai build kết thúc. Không có API runtime/resource cần dọn; image current giữ lại theo điều phối, chưa gọi image cleanup.

## Còn mở

Cần phương án dung lượng được review rồi mới retry vào artifact mới, kiểm hai API runtime và strict cleanup. Việc xóa Linux cache không bảo đảm Windows C trống lại do VHDX; không tự thay cấu hình WSL hoặc dọn dữ liệu ngoài phạm vi. Full release rollback, frontend/worker compatibility, staging, CDN/TLS và nghiệm thu người vận hành vẫn ngoài bằng chứng của B.
