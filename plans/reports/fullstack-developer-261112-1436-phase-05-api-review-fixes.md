# Phase 05 — sửa finding review phần API (VĐV, đăng ký, gộp)

Ghi lại từ báo cáo của agent sửa (agent không ghi được file). Ngày 2026-11-12.

| Finding | Thay đổi | Test chứng minh |
|---|---|---|
| H3 gộp VĐV vs ghi entry đồng thời | `packages/db/src/domain/player-locks.ts` (`lockSubEventsInOrder`, `lockPlayersForShare`, `lockPlayersForUpdate`). Gộp: khóa sub-event bị ảnh hưởng (theo id) → khóa 2 Player `FOR UPDATE` → tính lại; tập sub-event đổi → 409 `MERGE_RETRY`. Bỏ advisory lock. Ghi entry: sau `lockSubEvent` đọc Player `FOR SHARE`, VĐV đã gộp → 409 `PLAYER_MERGED` | `apps/api/test/player-merge-concurrency.e2e-spec.ts` (12 vòng chạy đồng thời; bỏ khóa thì test rớt 500) |
| M1 P2002 | `entries/entry-errors.ts` map theo tên index (`meta.driverAdapterError.cause.constraint.index`, Prisma 7 + adapter-pg không có `meta.target`): seed → `SEED_TAKEN`, competitor → `ALREADY_ENTERED`, còn lại ném lại | `entries/entry-errors.test.ts` |
| PII (đã chốt) | `players/player-views.ts` ẩn phone/email/birthDate nếu không có `players.update`; form admin ẩn thẻ "Liên hệ (riêng tư)" + ngày sinh | `players.e2e-spec.ts` |
| L4 trần thao tác hàng loạt | setting `entry.maxBulkItems` (mặc định 200) | `entries.e2e-spec.ts` |
| L7 sửa hạt giống entry đã rút | 422 `ENTRY_WITHDRAWN` (trừ khi cùng lệnh khôi phục) | `entries.e2e-spec.ts` |
| L8 thông báo tuổi | "tính theo năm sinh vì chưa có ngày sinh" khi cách tính ngày khai mạc mà thiếu ngày sinh | `entry-eligibility.test.ts` |

Kết quả: shared 80/80; 9 file API liên quan 58/58; typecheck api/admin/shared/db sạch; lint api/admin sạch.

Ghi chú:
- P2002 khác (vd `Competitor_playerId_key` khi tạo đồng thời) giờ trả 500 thay vì báo sai `SEED_TAKEN`.
- Bulk không có thao tác đổi hạt giống nên không cần chặn ở bulk.

Câu hỏi chưa giải quyết: không.
