# 2026-11-12 — Phase 01: nền móng monorepo

## Đã làm
- Monorepo pnpm 11 + Turborepo, 4 app (api NestJS 12, worker, client Next 16, admin Vite + antd 5), package `db` (Prisma 7.10.1), `shared`, `ui-tokens`, `config`.
- Migration `init_app_settings_audit_log` áp lên DB dev cục bộ (đã in target + xác nhận trước).
- 5 image Docker build + smoke test trong WSL; compose Dokploy + compose dev; CI có build image.
- Test chạy trên dependency thật: 57 test Vitest + 6 node:test, tất cả pass.

## Vướng và cách gỡ
- pnpm 11 chặn gói mới phát hành (`minimumReleaseAge`) → chọn bản ≥ 2 tuần tuổi thay vì thêm ngoại lệ.
- NestJS 12 ESM-only; TypeScript `latest` là 7.0 (native) chưa kiểm với decorator metadata → ghim 6.0.3.
- Image MinIO không còn trên Docker Hub → dev dùng RustFS (S3 API, Apache-2.0).
- `pnpm deploy` từ pnpm 10 đòi inject workspace → dùng `--legacy` trong Dockerfile.
- Build Docker lần đầu "exit 0" nhưng thật ra lỗi (exit code bị `tail` nuốt) → luôn lấy exit code thật.
- Admin chết lúc start (nginx không ghi được html dir) và resolve `api` tĩnh → ghi `/tmp/admin-config`, resolver động. Cả hai chỉ lộ ra khi chạy image thật, test đơn vị không bắt được → CI thêm smoke image.
- Race `prisma generate` giữa `build` và `typecheck` của `@kamito/db` → typecheck phụ thuộc build của chính package.

## Còn mở
- Cổng ra phase 01 chưa đạt: preflight hạ tầng, chọn thiết kế upload, chủ sở hữu sao lưu + RPO, 2 project Dokploy + staging.
- Spike D: Dokploy có tôn trọng `service_completed_successfully` không; Traefik ghi đè `X-Forwarded-For`; trùng tên DNS `api` trên `dokploy-network`.
