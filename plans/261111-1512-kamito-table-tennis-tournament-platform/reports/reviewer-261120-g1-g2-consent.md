# G1/G2 và consent — phần kiểm được ngày 2026-11-20

## Kết luận hiện tại

**Đã kiểm lại kỹ thuật; chưa đóng quyết định G1/G2 hoặc consent.** Lệnh cho phép chạy kiểm thử không phải câu trả lời về quy chế hoặc bằng chứng đồng ý của VĐV. Không đổi cấu hình nghiệp vụ đang dùng hoặc bật index/Person/sitemap hồ sơ để làm đạt checklist.

| Cổng | Nội dung cần chủ sở hữu/BTC xác nhận | Phần có thể chạy |
|---|---|---|
| G1a | Mẫu đặt hạt giống loại trực tiếp và phân bố hạt giống vòng loại | Kiểm engine trên dữ liệu mẫu, sinh nhánh và thao tác UI theo cấu hình test |
| G1b | Chia bảng, thứ tự phá hòa, walkover/bỏ cuộc, rút lui và người thay suất | Kiểm engine theo GroupScoringRule mẫu và thao tác rút/đưa suất qua UI; kết quả không thay quy chế chính thức |
| G2 | Điểm từng vòng/hạng giải, thời hạn, điều kiện walkover đầu tiên và cách tính hạt giống đôi | Kiểm engine theo cấu hình mẫu; kiểm phiên bản quy tắc qua admin UI, không tự chọn điểm chính thức |
| Consent | Phạm vi tên/ảnh/hồ sơ/tuổi được công khai, đối tượng được index, người xác nhận và cách lưu bằng chứng, nhất là VĐV nhỏ tuổi | Kiểm allowlist dữ liệu, cờ ẩn, alias, noindex, không Person và không URL hồ sơ trong sitemap |

Nguồn trạng thái: `plan.md` mục Mốc và cổng; `phase-12-english-seo-hardening-and-launch.md` câu 9–13, 15 và 19–23; phase06/09/10 mô tả quy tắc mẫu còn chờ xác nhận. Báo cáo này không đưa ra kết luận pháp lý hoặc tạo hồ sơ consent thay người có thẩm quyền.

## Kiểm thử thực sự đã chạy

| Lệnh/phạm vi | Kết quả |
|---|---|
| `pnpm --filter @kamito/competition-engine test` | 20 file, **230/230 đạt**, exit 0 |
| `pnpm --filter @kamito/ranking-engine test` | 3 file, **36/36 đạt**, exit 0 |
| `pnpm --filter @kamito/client exec vitest run tests/unit/json-ld.test.ts` | **1/1 đạt**, không xuất participant identities/Person |
| `public-players.e2e-spec.ts` với PostgreSQL/Redis thật | **14/14 đạt**, exit 0 |
| `public-sitemap.e2e-spec.ts` với PostgreSQL/Redis thật | **3/3 đạt**, exit 0 |

Hai spec API chạy tuần tự qua runner timestamp hiện có, chỉ target **`localhost:5433/kamito_tt_phase12_test`**, `APP_ENV=test`, `QUEUE_PREFIX=kamito-tt:test`, confirmation khớp. Không migrate/seed/query DB dev. Điều phối giữ lease riêng vì profile spec tạm đổi hai AppSetting và restore trong teardown. Cả hai spec hoàn tất teardown; summary ghi `envUnchanged=true`. Đây là **17 ca chạy lại**, không cộng vào 132 ca duy nhất của lượt trước như ca mới.

Artifact tại root `test-results/`:

- `261120-real-api-gates-privacy-players-20261120063816084.{json,log,summary.json}`.
- `261120-real-api-gates-privacy-sitemap-20261120063823844.{json,log,summary.json}`.

Giữ nguyên warning `pg` về concurrent `client.query()` trong log; không có assertion failure hoặc native crash ở hai lượt trên. Kết quả unit engine/JSON-LD là output lệnh của lượt này, không tự nhận có coverage hoặc benchmark mới.

## Các guard đã đối chiếu

- Danh sách/hồ sơ chỉ chọn active, public, chưa gộp; hồ sơ private không có dữ liệu công khai, alias không lộ tên pháp lý qua public search/slug; redirect chuỗi gộp chỉ về đích còn công khai.
- Whitelist hồ sơ không có email, số điện thoại, ngày/năm sinh riêng tư hoặc tên pháp lý khi đã có alias. Tuổi chỉ trả khi cấu hình cho phép; source `packages/shared/src/player-settings.ts` mặc định `player.showAge=false`.
- Schema hiện có **`isPublicProfile=true` mặc định và `noindex=true` mặc định** tại `packages/db/prisma/schema/players-and-entries.prisma`. Không mô tả đây là mặc định opt-in consent: `noindex` chỉ là cờ chỉ dẫn index, không làm trang trở thành riêng tư.
- Source trang `players/[slug]` lấy robots từ `player.noindex`, private profile trả 404. Các ca browser hiện có kiểm private 404, không có link private, noindex và loại trừ sitemap/Person; sẽ được agent CSP chạy lại trên build enforce khi nhận lease.
- Sitemap API không có collection/identifier player; JSON-LD giải không phát `Person`. Không bật các tính năng này trong lượt kiểm.

## Quyết định cần ghi nhận để đóng cổng thật

1. **G1:** cung cấp bản quy chế và câu trả lời cho mẫu seed, tiêu chí bảng và rút/thay suất; ghi phiên bản, ngày hiệu lực, người xác nhận. Ví dụ: VĐV rút sau khi đã đấu hai trận thì giữ hay hủy hai kết quả đó.
2. **G2:** cung cấp bảng điểm, thời hạn và điều kiện tính điểm; nhập thành phiên bản cấu hình, chạy lại cùng ví dụ nghiệm thu. Ví dụ: thua walkover ngay trận đầu có được ghi điểm vòng đó hay không.
3. **Consent:** chốt trường và đối tượng được công khai/index cùng bằng chứng chấp thuận và cách thu hồi. Ví dụ: cho hiển thị tên trong kết quả nhưng không cho trang hồ sơ/ảnh/tuổi thì các quyền phải được ghi rõ, không suy từ một cờ `noindex`.

Chưa tạo bản đồng ý, chưa thay default schema hoặc backfill cờ cho VĐV. Mọi cơ chế lưu consent mới cần yêu cầu đã xác nhận và migration được review; không tự diễn giải dữ liệu đang có thành đã đồng ý.
