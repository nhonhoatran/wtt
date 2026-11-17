# Review phase 10 — BXH và hồ sơ VĐV công khai

Ngày: 2026-11-17. Phạm vi: thay đổi đang có trong `apps/api`, `apps/client`, `apps/worker`, `packages/shared`, `packages/ranking-engine`, kể cả file chưa track. Đối chiếu phase 10, truy vấn, serializer, tag cache và kiểm thử thực tế. Lượt review chỉ đọc implementation và bằng chứng kiểm thử; không ghi DB, không chạy build/E2E đồng thời với tester.

## Kết luận

**9,5/10. Không còn phát hiện Critical/P1/P2 chưa xử lý trong phạm vi mã đã review.** Đã kiểm lại các bản sửa F1–F4 bằng nguồn và log thực tế; Playwright sau F4 đạt 24/24. Luồng công bố kỳ thật qua worker làm mới trang SSR đã có cache trong 644 ms ở môi trường local. Chưa xác nhận deploy hoặc hành vi trên staging.

Ngân sách 80 KiB được triển khai và đo theo body HTTP đã gzip; JSON thô không đạt mốc này. Đây là giới hạn được công khai trong tài liệu, không phải bảo đảm mọi lịch sử điểm đều dưới 80 KiB. Snapshot cũ thiếu định danh giải ổn định được che nhãn/link để giữ phạm vi công khai an toàn.

## Đối chiếu yêu cầu

| Nhóm | Kết quả kiểm nguồn |
|---|---|
| Tổng quan và bảng đầy đủ | Đọc kỳ `PUBLISHED` mới nhất của bảng đang bật; top N lấy từ setting; nhóm giới tính và category; lọc, tìm, phân trang ở server; dùng `<details>` cho breakdown |
| Danh sách và hồ sơ VĐV | Chỉ danh sách active/public/chưa gộp; tìm tên công khai đã chuẩn hóa; hồ sơ tối đa 3 SQL reads; kết quả chỉ trận OFFICIAL, không void/BYE, trong giải/draw công khai |
| Quyền riêng tư | Whitelist; alias che tên thật ở cả vi/en; link dạng `p-<UUID>`; hồ sơ ẩn không có link/ảnh; chuỗi gộp chỉ chuyển tới đích còn công khai |
| Điểm và tính bất biến | Số điểm, vòng, ngày và nhãn nguồn từ snapshot; kiểm quyền theo eventId nội bộ; URL lấy slug hiện tại của đúng giải |
| Điểm theo vòng | Dùng phiên bản rule có hiệu lực tại ngày kết thúc giải; không hiện khi giải ẩn/hủy hoặc tab Thông tin bị tắt |
| Cache và SEO | Loader và mutation có tag players/rankings/events/settings phù hợp; opaque và legacy slug đều được revalidate; canonical opaque, noindex theo cờ, sitemap không có VĐV, không xuất Person JSON-LD |
| Hiệu năng | Overview không đọc breakdown dư; trang bảng lấy các rows trong một truy vấn rồi kiểm phạm vi giải theo lô; gzip giữ nguyên toàn bộ breakdown |

## Các phát hiện đã đóng

### F1 — P1 — Slug chứa tên thật vượt qua alias

- Tái hiện ban đầu: tạo VĐV bằng tên thật, đặt `publicDisplayName`; payload hiển thị alias nhưng còn xuất slug sinh từ tên thật qua BXH, nhánh và hồ sơ.
- Bản sửa: `packages/shared/src/public-player-slug.ts:5` tạo định danh `p-<UUID>`; `apps/api/src/modules/public-players/public-player.serializer.ts:24` và serializer nhánh dùng chung định danh này. `public-player-profile.query.ts:30` giải quyết cả slug cũ và opaque id, theo toàn bộ chuỗi gộp có chặn vòng lặp; chỉ chuyển tới đích active/public.
- Bằng chứng: test `apps/api/test/public-players.e2e-spec.ts:158` tạo qua API thật, đổi alias hai lần và kiểm tên thật/slug cũ không xuất hiện trên các bề mặt công khai. Các test public-players đạt trong `phase-10-api-f4.log`; phần lỗi duy nhất của lượt đó thuộc fixture F4, đã sửa và chạy lại riêng thành công.
- Phân xử: **Accept → đã sửa và kiểm lại**.

### F2 — P2 — CLB hợp lệ trên 100 ký tự không lọc được

- Tái hiện ban đầu: admin cho nhập CLB 101–200 ký tự, nhưng helper public cắt còn 100 trước khi so sánh bằng, khiến chọn CLB hợp lệ trả rỗng.
- Bản sửa: giới hạn dùng chung `PLAYER_CLUB_MAX_LENGTH = 200` tại `packages/shared/src/public-player-slug.ts:16`; admin DTO và helper `apps/api/src/modules/public-rankings/public-rankings.query.ts:25` cùng sử dụng.
- Bằng chứng: test biên 100/101/200 ký tự ở hai danh sách; public-rankings đạt trong `phase-10-api-f4-final.log`, public-players đạt trong `phase-10-api-f4.log`.
- Phân xử: **Accept → đã sửa và kiểm lại**.

### F3 — P2 — Thiếu phép đo payload với nhiều khoản điểm

- Tái hiện ban đầu: test chỉ có một khoản điểm trên mỗi VĐV; serializer trả đủ lịch sử nên JSON 50 dòng có thể vượt 80 KiB.
- Bản sửa: `apps/api/src/common/http/public-json-response.ts:10` nén gzip bất đồng bộ khi client chấp nhận, khai báo `Vary: Accept-Encoding`; SSR gửi `Accept-Encoding: gzip`. Overview bỏ select breakdown tại `public-rankings.query.ts:48`; trang đầy đủ giữ toàn bộ khoản điểm.
- Bằng chứng HTTP thật: `apps/api/test/public-ranking-payload.e2e-spec.ts` dựng 50 VĐV × 20 khoản = 1.000 khoản, kiểm bytes trên đường truyền và giải nén so sánh đầy đủ. Artifact `apps/api/test-results/public-ranking-payload-budget.json` lần gần nhất ghi **377.129 byte JSON**, **9.307 byte gzip**, ngưỡng **81.920 byte**; `rawBudgetMet=false`, `gzipBudgetMet=true`. Test dense đạt trong `phase-10-api-f4.log`.
- Phân xử: **Accept → đã bổ sung nén và benchmark; đóng trong phạm vi đo gzip đã ghi rõ**. Không xác nhận giới hạn JSON thô hoặc giới hạn tuyệt đối cho số khoản điểm không bị chặn. Tài liệu giải thích tại `docs/public-site.md:127` và `docs/system-architecture.md:602`.

### F4 — P1 — Slug giải được dùng lại làm lộ nhãn giải đang ẩn

- Tái hiện: snapshot chốt giải A tại slug X; ẩn A, đổi slug A thành Y; tạo và công bố giải B với slug X. Kiểm phạm vi bằng slug X sẽ coi nhãn đóng băng của A là công khai và dẫn link sang B.
- Bản sửa: `apps/worker/src/ranking/load-snapshot-ledger.ts:18` đọc eventId sẵn có; `packages/ranking-engine/src/snapshot-builder.ts:15` lưu id trong JSON nội bộ của kỳ mới. `apps/api/src/modules/public-rankings/public-rankings.query.ts:107` chỉ tra các id theo publicScope; `public-ranking.serializer.ts:47` dùng map id → slug hiện tại để cấp quyền, không đưa id ra whitelist. Snapshot cũ không có id che toàn bộ nhãn/link, giữ nguyên số điểm, vòng và ngày; không sửa kỳ đã công bố.
- Bằng chứng: test tái sử dụng slug và công bố lại A tại `apps/api/test/public-rankings.e2e-spec.ts:134`, test legacy thiếu id tại `:155`, kiểm worker/engine lưu id trong `ranking-snapshot-immutability.e2e-spec.ts:53`. Hai test mới đạt trong `phase-10-api-f4-final.log`; snapshot regression đạt 11/11 trong JSON cùng tên.
- Lượt đầu lỗi do fixture Event thiếu trường timezone bắt buộc; đã sửa fixture, lượt chạy lại 16/16 đạt. Đây không phải lỗi của nhánh kiểm phạm vi.
- Phân xử: **Accept → đã sửa và kiểm lại**.

## Bằng chứng đã đọc

- `apps/api/test-results/phase-10-api.json`: 94 đạt, 0 lỗi, 0 pending — lượt baseline trước các bản sửa cuối.
- `apps/api/test-results/phase-10-api-regression-a.json`: 41 đạt, 0 lỗi, 0 pending; `phase-10-api-regression-b.json`: 28 đạt, 0 lỗi, 0 pending.
- `apps/api/test-results/phase-10-api-f4.log`: 30 đạt, 1 lỗi fixture timezone trong test slug reuse; public-players và dense payload đạt.
- `apps/api/test-results/phase-10-api-f4-final.log`: chạy lại public-rankings sau sửa fixture, 16 đạt, 0 lỗi; gồm hai case F4.
- `apps/api/test-results/phase-10-snapshot-regression.json`: 11 đạt, 0 lỗi, 0 pending.
- `apps/client/test-results/phase-10-e2e-final.log`: 40 đạt ở lượt trước F4. `phase-10-e2e-f4-final.log`: 24 đạt ở lượt sau F4, gồm desktop và mobile.
- `apps/api/test-results/public-ranking-publish-refresh.json`: luồng admin publish thật → BullMQ revalidation worker cô lập → SSR đã có cache; ngày kỳ đổi từ 2099-06-01 sang 2099-07-01, điểm từ 137 sang 827 trong **644 ms**, 1 job hoàn tất, dưới ngưỡng 10.000 ms. Đây là bằng chứng local, không phải staging.
- `git diff --check`: exit 0; có cảnh báo chuẩn hóa CRLF/LF, không có lỗi whitespace.

## Giới hạn còn phải giữ rõ

- Snapshot cũ thiếu eventId tạm mất tên/URL/mã hạng giải trong phần chi tiết. Số điểm, vòng, ngày không đổi; kỳ mới mới có đủ định danh. Đây là xử lý bảo thủ để tránh cấp quyền theo slug có thể tái sử dụng.
- Normal GET/HEAD hồ sơ cũ được proxy trả 301; request prefetch bỏ qua proxy và fallback `permanentRedirect` tại trang dùng 308 của Next. Phân biệt này đã ghi trong `docs/public-site.md`.
- Benchmark gzip không chứng minh giới hạn 80 KiB cho mọi lịch sử hoặc cho JSON thô. Không cắt breakdown để làm đẹp số đo.
- Chưa kiểm staging, thời gian lan truyền revalidate giữa các replica trên staging, hoặc deploy. Kết luận review mã không thay thế các bước này.
