# Diễn tập sao lưu và khôi phục local disposable — 2026-11-20

## Kết quả và phạm vi

**Scope A đạt, process exit 0**: sao lưu PostgreSQL và object storage S3-compatible từ dữ liệu mẫu tự tạo, khôi phục vào hai dịch vụ mới hoàn toàn, đối chiếu toàn bộ table counts, canonical row/migration hash, quan hệ Article → MediaAsset, object SHA256/size/Content-Type. **Không phải rollback image phát hành hoặc nghiệm thu staging.**

- UUID được điều phối duyệt trước tạo tài nguyên: `7ab83b5f5b214596ab133c06e0ff24b1`.
- Nguồn: `localhost:55432/kamito_recovery_7ab83b5f_source_test`; đích mới: `localhost:55433/kamito_recovery_7ab83b5f_restore_test`.
- S3 nguồn/đích: cổng loopback **19010/19012**; public/incoming buckets riêng theo UUID và vai trò source/restore. Dùng production `S3ObjectStorage` trong `@kamito/shared`, RustFS local như compose dev.
- Bốn container, bốn named volume và một **dedicated bridge network** có tên/label UUID. Không attach network/volume dùng chung; không truy cập cổng5433/6380/9010 hoặc sao chép DB dev/production.
- Network cuối **không có `--internal`**; không nhận là egress-isolated. Chỉ publish `127.0.0.1`; không bind0.0.0.0, không sửa firewall/host config. Network delta được duyệt sau bằng chứng lỗi bên dưới.

## Bằng chứng cuối

Thư mục: `test-results/261120-local-recovery-7ab83b5f5b214596ab133c06e0ff24b1/1795158157916/`.

| Kiểm tra | Kết quả |
|---|---|
| Migration nguồn | **18/18** migration trong source, đúng tên; finished, không rolled back |
| Dữ liệu tự tạo | User1, MediaAsset2, Article1, AppSetting1; các bảng nghiệp vụ khác trống |
| Restore target | `public` schema không có base table trước `pg_restore`; không `--clean` hoặc xóa/truncate target đang dùng |
| Table counts | Cả **46 bảng** khớp nguồn/đích, gồm `_prisma_migrations`18 |
| Canonical rows + migrations | SHA256 **`acb093f555f4aa3d374ded2fe80b3fc683e9ec6f92a3b362024911c07693e187`** khớp |
| FK/metadata | Article trỏ đúng MediaAsset READY; một pending upload AWAITING_UPLOAD được giữ |
| Object storage | **3 object**, mỗi object68byte, `image/png`; public cover/variant và incoming pending đều khớp SHA256/size/type |
| Bản sao bị hỏng | Chỉ sửa byte đầu của **damaged-copy.dump**; integrity guard từ chối trước restore, backup gốc vẫn hợp lệ |
| Target guard | 1 positive + 5 negative controls: từ chối5433, DB dev, hostname ngoài, port sai, query string trước DB/container |
| Cleanup | `errors: []`; container, volume, network có label UUID còn lại **0** |
| Cấu hình root | `envUnchanged: true`, không load dotenv hoặc sửa root `.env` |

Các trường `databaseConnections: 0` / `containersStarted: 0` trong **negative-controls** chỉ mô tả pure guard controls, không phải tổng hoạt động của diễn tập thực.

### Backup giữ lại

- `fixture.dump`: **140.805 byte**, custom-format `pg_dump -Fc --no-owner --no-acl`.
- SHA256 dump: **`ba1cc384755f47c0fe1cbb1d85eb6d22ce8e2ae825f32141bd2ee2fb14cf02a4`**.
- `objects/0.bin` đến `objects/2.bin`: tổng204byte; mỗi file hash **`59aaa447cdc7ba9e77cc848ed3c0c99b7b07789b3c8194e23ec7a9187cacad27`**.
- `backup-manifest.json`, `object-manifest.json`, `migration-source-manifest.json`: digest và nguồn từng thành phần. Backup gốc được kiểm lại trước cleanup và giữ nguyên sau run; không ghi đè bằng chứng cũ.
- `source-database.json`, `restored-database.json`, `restored-objects.json`, `restore-validation.json`: dữ liệu fixture và kết quả đối chiếu.
- `approved-targets.json`, `owned-resources.json`, `runner.log`, `negative-controls.json`, `result.json`, `cleanup.json`: target, ID, diễn tiến, guard và kết thúc.

### Thời gian thực

Run cuối: **2026-11-20T07:02:37.917Z → 07:04:02.939Z**, tổng khoảng **85,022s** gồm tạo/khởi động/migrate/backup/restore/verify/cleanup. Không dùng số này làm RTO production.

| Công đoạn | ms |
|---|---:|
| Tạo bốn dịch vụ riêng | 17823 |
| Chờ DB | 148 |
| Áp18migration vào nguồn mới | 25384 |
| Khởi tạo bucket trống | 5685 |
| PostgreSQL backup | **3527** |
| Object backup | **19** |
| PostgreSQL restore | **6279** |
| Object restore | **2200** |
| Kiểm DB / object | 108 / 26 |
| Cleanup tài nguyên sở hữu | 17588 |

## An toàn và phương pháp

- Image đã có sẵn, mọi container dùng `--pull=never`: PostgreSQL **17.11-alpine3.23** (`3a5d537cf82c`), RustFS **1.0.4** (`ed9210d6411d`). Không cài package hoặc tải image trong lượt này.
- Tạo tên container/network/volume chưa tồn tại; ghi exact container ID trước start. Guard kiểm ID, label, mount, intended port, **actual published port**, network và image digest trước thao tác. Cleanup kiểm lại ownership, volume label và network trống; không dùng prune hoặc compose down của dự án.
- Credential disposable ngẫu nhiên, không in ra stdout/log. Env file riêng tạm thời được xóa lúc cleanup; root `.env` chỉ được băm trước/sau, không đọc qua dotenv để cấu hình target.
- Prisma migrate dùng native Windows Node/pnpm đang cài, config tạm với schema/migrations absolute + connection URL của nguồn mới. Không lấy datasource từ root config, không dùng shadow/dev DB hoặc `prisma db push`.
- `pg_dump` thực hiện trong đúng PG nguồn; copy file nhị phân bằng Docker CLI. `pg_restore --exit-on-error --no-owner --no-acl` vào PG đích có public schema trống. Không khôi phục đè nguồn hoặc DB đã duyệt cho các suite khác.
- Không có API/worker/scheduler nối nguồn fixture, nên không có writer đồng thời trong cửa sổ PG/S3 snapshot. Dữ liệu gồm một bài tiếng Việt/Anh, ảnh READY có variant, pending upload và JSON setting tự tạo.

## Lượt lỗi và chẩn đoán giữ nguyên

1. **Run đầu `1795157422734` không đạt**, trước migrate/seed/dump: bốn container khởi động, nhưng Prisma host không kết nối được; `requireEmpty` timeout60.239s. Không tính là backup/restore thành công. Cleanup0resource, `.env` hash không đổi.
2. **Diagnostic-only `1795157769678`**: hai PG running, own `pg_isready` accepting. Intended binding là127.0.0.1 nhưng `NetworkSettings.Ports` thực **`{"5432/tcp":null}`**; Windows localhost và127.0.0.1 đều `ECONNREFUSED`. WSL `/dev/tcp` probe bị shell parse sai trước bash, **không tính là TCP evidence**. Không migrate/seed/dump; chủ động kết thúc sau thu thập, cleanup0resource.
3. Root duyệt bỏ `--internal`, giữ dedicated UUID bridge và loopback ports; thêm actual-publication guard. **Chỉ một full rerun sau sửa**, `1795158157916`, đạt toàn bộ scope A. Không sửa credential, timeout hoặc bỏ assertion để làm xanh test.

## Runner và kiểm mã

Runner/helper riêng nằm trong ignored `test-results/`:

```text
261120-local-recovery-runner.mjs
261120-local-recovery-support.mjs
261120-local-recovery-fixture.mjs
261120-local-recovery-diagnostic.mjs
```

Đã chạy syntax check; `--self-test` và `--help` không khởi dịch vụ/DB. Root và reviewer phase08 đã đọc ba file chính trước first start; root duyệt network delta sau diagnostic. Lệnh thực từ repo root:

```text
REAL_RECOVERY_LEASE=7ab83b5f5b214596ab133c06e0ff24b1 node test-results/261120-local-recovery-runner.mjs
```

Chưa biến runner thử nghiệm này thành công cụ recovery production hoặc script release được nghiệm thu.

## Rollback image và các cổng còn mở

- **Chưa diễn tập rollback release.** App images `kamito-tt-{api,migrate,client,worker}:latest` đang có đều tạo ngày2026-11-12, chỉ có Compose labels, không có source revision; không gọi chúng là previous release đã xác minh.
- Git có source `59279ac` (CMS,17migration) và `9648eb4` (18migration). Delta DB là migration `20261119151407_add_content_english_fields`: thêm ba nullable TEXT (`Article.categoryEn`, `StaticPage.footerGroupEn`, `Video.durationTextEn`), không DROP/RENAME. Đây là kiểm source, chưa chứng minh code cũ hoạt động trên schema mới.
- Exact base `node:24.22.3-alpine3.23` không có trong image local khi scout. Chưa được duyệt scope B build/pull; không build/archive/checkout/reset/stash current worktree cho rollback.
- Cần previous/current image có provenance, health/content checks và đo chuyển bản thực; Spike D còn yêu cầu Dokploy migration gating, failed migration/resolve, downtime và staging. Scope A không đóng các mục đó.
- Chưa kiểm role/ACL PostgreSQL, bucket policy/CORS/versioning/object lifecycle, backup có dữ liệu thật, RPO/retention/chủ sở hữu, multi-writer consistency, TLS hoặc phục hồi trên staging. Bản dump dùng `--no-owner --no-acl` không được gọi là sao lưu toàn bộ cluster roles/permissions.

Không còn tài nguyên disposable của scope A sau hậu kiểm; backup/manifest/log được giữ để điều phối đọc lại. Không sửa docs chung hoặc checklist PM trong nhánh công việc này.
