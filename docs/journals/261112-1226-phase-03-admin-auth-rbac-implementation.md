# 2026-11-12 — Phase 03: đăng nhập admin, RBAC, người dùng, khung admin

**Date**: 2026-11-12 12:26
**Severity**: High
**Component**: apps/api (auth, access-control, users, settings, audit-logs, queue/bull-board, cli), apps/admin, packages/shared
**Status**: Blocked (deploy staging chờ cổng ra phase 01)

## What Happened

Hoàn thành code phase 03 trên `feat/phase-03-admin-auth-rbac` (commit `01d7eea..150b197`, 7 commit code + docs). Phạm vi: Better Auth dạng raw handler với allowlist 2 route, guard deny-by-default, rate limit IP trên Redis, khóa tạm theo tài khoản, idle/absolute timeout đọc từ `/settings`, CRUD người dùng, Nhật ký thao tác, `/settings`, bull-board sau session + quyền, CLI `create-admin`, khung Refine admin.

Code được viết khi cổng ra phase 01 chưa đạt (thiếu staging, Redis riêng, thiết kế upload, chủ sở hữu sao lưu). Chủ repo đã chốt 2026-11-12: giữ code, chưa deploy staging.

## The Brutal Truth

Vite build của admin gãy: `sunflower-antd` (kéo theo bởi `@refinedev/antd`) import `antd` mà không khai báo. Review phát hiện H1: `/auth/change-password` cho đoán mật khẩu hiện tại vô hạn, vì nó không đi qua lockout. Đây là lỗ hổng thật, không phải lỗi style. Chưa kiểm chứng nguyên nhân bỏ sót, nhưng việc test tập trung vào sign-in là khả năng cao nhất (phỏng đoán).

## Technical Details

- `apps/admin/vite.config.ts:7-8`: `resolve.dedupe: ['antd', 'react', ...]`.
- H1 đã sửa: `auth.service.ts:58` ghi `auth.password.change.failed`, có lockout.
- M1 đã sửa: `session-resolver.service.ts:27`, `bull-board-mount.ts:27` dùng `touch: !req.path.startsWith('/api/')`.
- M2 đã sửa: `auth-instance.ts:31-32` băm dummy scrypt khi từ chối đăng nhập.
- M3 một phần: `account-lockout.service.ts:55` dùng `redis.eval` (Lua). Khoảng check/record vẫn còn.
- M4 đã sửa: `listDefaultPageSize` lấy từ `/settings`; admin bỏ `?? 20`.
- `create-admin` lỗi khi pipe stdin: đã sửa bằng `terminal-prompts.ts` (shared line reader).
- Kiểm chứng: `turbo` typecheck/lint/build 18/18. Test api 18 file / 87 test, shared 20, worker 4, ui-tokens 3 Số test api gồm 13 file e2e, chạy 2026-11-12 trên Postgres + Redis dev local.

## What We Tried

- Dùng `resolve.dedupe` trong `apps/admin/vite.config.ts` thay vì chờ upstream sửa `sunflower-antd`.
- Review chạy trên diff chưa commit (`plans/reports/code-reviewer-261112-phase-03-auth-rbac.md`); các fix đã có trong commit code (`git grep` xác nhận ở 150b197).

## Root Cause Analysis

- Dependency bên thứ ba khai báo thiếu peer dependency; không có kiểm tra nào bắt được trước khi build.
- Lockout chỉ gắn vào đường sign-in. Mọi endpoint nhận mật khẩu khác (change-password) không được rà khi thiết kế.
- Nhiều tham số vận hành (page size, lockout window, lock-level memory) được đưa vào env hoặc fix cứng trước khi có luật "mọi thứ trên `/settings`".

## Lessons Learned

- Mọi endpoint nhận mật khẩu phải đi qua cùng một cơ chế khóa. Viết checklist endpoint trước khi viết test.
- Chạy `vite build` và image thật sớm, đừng chờ tới cuối phase.
- Cổng ra phase trước phải được kiểm trước khi bắt đầu phase sau. Ở đây code đã xong trước khi cổng được chốt.
- Khi lock đếm lỗi theo cửa sổ gắn với `lockoutMaxSeconds`, admin chỉnh một số có thể vô tình đổi hành vi khác. Tách riêng.

## Next Steps

- Chủ repo: quyết có gắn `@RequireStepUp` sớm cho `PUT/DELETE /admin/settings/:key`, `POST /admin/users/:id/reset-password` không.
- Owner backend: xử lý L1 (mã `ACCOUNT_LOCKED`), L2, L3, L4, L5, L7-L11. Đóng check/record gap của M3.
- Deploy staging + migrate: chờ phase 01 đủ 4 điều kiện. Khi đó kiểm XFF sau Traefik (spike D) và CSP bull-board qua nginx.
- Admin UI chưa có test tự động (`apps/admin` chưa có runner). Thêm trước phase 04.
