# Quyết định BTC và consent — 2026-11-27

**Trạng thái: người dùng đã duyệt cả ba gói trong phiên làm việc ngày 2026-11-27.** BTC là Ban tổ chức giải. Ngày này là ngày phê duyệt kỹ thuật được ghi nhận từ phiên; không tự đặt ngày hiệu lực quy chế chính thức hoặc kỳ chốt đầu tiên. G1 chốt toàn bộ lựa chọn bên dưới; G2 chốt cơ chế nhưng còn thiếu bảng điểm thật; consent chốt quy trình lưu bằng chứng ngoài ứng dụng, không xây model consent trong đợt này. Phê duyệt quy trình không thay bằng chứng đồng ý của từng VĐV; S2 vẫn mở cho các điều kiện triển khai còn thiếu.

| Quyết định | Đã duyệt trong phiên | Còn phải hoàn tất |
|---|---|---|
| G1 | Toàn bộ mục 1; `KEEP_PLAYED_RESULTS`; không thêm tránh cùng CLB | Source default/seed đã đổi và kiểm local; còn đối chiếu rule cũ khi rollout target thật, không tự sửa dữ liệu giải cũ |
| G2 | Các cơ chế mục 2: hạn 365 ngày, không điểm thua walkover trận thật đầu MAIN/QUALIFYING, seed đôi tổng điểm kỳ PUBLISHED mới nhất, ADMIN chủ động chốt | Bảng điểm chính thức, ngày hiệu lực và kỳ chốt đầu tiên chưa có; không đưa số SAMPLE thành quy chế |
| Consent | BTC lưu bằng chứng bên ngoài; hồ sơ mới chỉ công khai sau xác nhận đúng phạm vi; `showAge=false`, `noindex=true`; không model mới | Default mới đã ẩn, regression và mobile local đạt; còn rollout/checklist/bằng chứng mục 4, không backfill hoặc coi cờ cũ là consent |

Source đã đổi default hồ sơ mới về ẩn tại schema, API create (bỏ cờ → `false`), form tạo admin và nhánh import tạo VĐV mới (`false`, `noindex=true`). Migration [20261127110000](../../packages/db/prisma/migrations/20261127110000_private_player_profile_default/migration.sql) chỉ `ALTER DEFAULT false`, không `UPDATE`, đã áp **DB test xác nhận** dưới lease của root. `consent-after-migration.json` thấy default `false`, nhưng có **0 VĐV cũ**, nên không gọi đó là test bảo toàn dữ liệu cũ. API test riêng xác nhận explicit opt-in true và PATCH bỏ cờ vẫn giữ flags. Seed G1 mới dùng KEEP và giữ idempotence; chưa migrate dev/staging hoặc bật dữ liệu thật. Hướng dẫn noindex cũng được sửa để không tạo cảm giác noindex là ẩn trang.

Kiểm sau thay đổi: **API 6 spec/61 test**, **worker 9 file/46 test**, **browser component 22/22** đạt. Browser gồm bốn ca route PlayerCreate thật ở 390/1440: default false/opt-in true, noindex giữ true; bốn đối chứng trước sửa rớt đúng default true. Import mới private/noindex, linked/dedup giữ cờ; positive public fixtures opt-in có chủ đích chỉ cho ID test. Đây là bằng chứng kỹ thuật, không tạo consent ngoài ứng dụng. Log riêng `consent-api.log`, `consent-worker.log`, `admin-browser-final-consent.log`; [review browser/defaults](../reports/tester-261127-admin-modal-continuation.md). Mobile full-flow `d6121820…` trên default mới đã qua đủ tám bước/60 phép kiểm làm mới; worker exit 0, cleanup mọi counter 0, `.env` không đổi. [Báo cáo root](../reports/tester-261127-admin-full-flow-continuation.md).

## 1. G1 — gói lựa chọn đã duyệt

| Mục | Lựa chọn được duyệt | Hiện trạng / việc triển khai |
|---|---|---|
| G1a: nhánh loại trực tiếp | Giữ mẫu hiện tại: seed 1/2 hai đầu; seed 3/4 bốc vào `S/2`, `S/2+1`; các tầng tiếp theo bốc vào các ô biên phân đoạn còn trống. | Engine có sẵn; đối chiếu các ví dụ 8/16/32 suất khi nghiệm thu quy chế. |
| G1a: vòng loại | Mỗi nhánh con nhận một trong các seed tốt nhất, tối đa bằng số nhánh con; người thắng nhánh `i` nhận suất vòng loại `i`. | Engine có sẵn. |
| G1b: chia bảng | Chia pot theo seed rồi điểm; pot đầu lần lượt vào A/B/…; pot sau bốc ngẫu nhiên. **Không thêm quy tắc tránh cùng CLB.** | Giữ hành vi engine hiện tại. |
| G1b: điểm trận bảng | Thắng **2**, thua thường **1**, thua walkover **0**, thua bỏ cuộc **1**. Walkover/bỏ cuộc bù các ván còn thiếu cho bên thắng, **11 điểm/ván bù**. | Chốt các thông số này; kiểm rule đã lưu khi triển khai, không ghi đè giải cũ. |
| G1b: phá hòa | Điểm đối đầu → tỷ lệ ván đối đầu → tỷ lệ điểm đối đầu → BTC bốc thăm và nhập thứ hạng. | Engine giữ nhóm chưa tách được ở cùng hạng tạm, không tự bốc thăm. Hạng nhập tay là **hạng tuyệt đối trong bảng**, liên tiếp và phủ đúng nhóm hòa. |
| G1b: rút giữa bảng | **`KEEP_PLAYED_RESULTS`**: giữ trận đã chốt `OFFICIAL`; mọi trận chưa chốt, kể cả `LIVE`, cho **đối thủ của người rút** thắng walkover. | Seed mới đã dùng KEEP; seed cũ để `withdrawalPolicy=null` được giữ nguyên. Không đổi các rule `null` cũ bằng backfill. `VOID_ALL_RESULTS` vẫn là khả năng engine, không phải default được chọn. |
| G1b: thay suất | Nếu người đi tiếp của bảng rút trước khi xếp nhánh chính: lấy người kế tiếp đủ điều kiện, giữ hạng đã có để hiển thị. Nếu người thắng vòng loại đã rút: giữ walkover ở nhánh chính, chưa dùng lucky loser. | Giữ cả hai hành vi hiện tại; không thêm lucky loser. |

Lý do lựa chọn G1: giữ các hành vi đã có kiểm thử và chốt rõ chính sách rút. Ví dụ nghiệm thu tối thiểu: bảng ba người đồng điểm; VĐV rút sau hai trận đã chốt và khi trận thứ ba đang `LIVE`; người đủ điều kiện đi tiếp rút trước khi xếp nhánh chính.

**Đính chính câu hỏi lịch sử:** [phase 12, câu 22](../261111-1512-kamito-table-tennis-tournament-platform/phase-12-english-seo-hardening-and-launch.md) ghi “trận đang dở tính cho người đang dẫn” và “đang làm như vậy”. Điều đó không khớp code hiện tại: với `KEEP_PLAYED_RESULTS`, [group-withdrawal-plan.ts](../../packages/competition-engine/src/group-withdrawal-plan.ts) cho đối thủ của người rút thắng mọi trận chưa `OFFICIAL`, không xét ai đang dẫn. Lựa chọn đã duyệt trong phiên này là mô tả hiện tại ở trên.

Nguồn: [seed positions](../../packages/competition-engine/src/seed-positions.ts), [vòng loại](../../packages/competition-engine/src/qualifying-generator.ts), [chia bảng](../../packages/competition-engine/src/group-allocation.ts), [phá hòa](../../packages/competition-engine/src/tiebreak-resolvers.ts), [catalog mẫu](../../packages/db/prisma/seed/seed-config-defaults.ts), [giới hạn đã ghi](../../docs/draws-and-groups.md).

## 2. G2 — cơ chế đã duyệt, còn thiếu bảng điểm chính thức

| Mục | Cơ chế được duyệt | Trạng thái |
|---|---|---|
| Thua walkover ngay trận thật đầu tiên | Không nhận điểm vòng đó ở **MAIN/QUALIFYING**: `ranking.awardPointsOnWalkoverLoss=false`. BYE không được coi là trận thật đã đấu. | Đã duyệt setting/engine hiện có. Điều kiện no-show này **không áp cho GROUP**. |
| Hạt giống đôi | Tổng điểm hai VĐV ở kỳ **PUBLISHED mới nhất** của bảng xếp hạng gắn với nội dung; người chưa có điểm tính 0; cặp đôi không có một thứ hạng cá nhân riêng. | Đã duyệt; không đóng băng ở ngày đăng ký hoặc tự chọn snapshot cũ. |
| Thời hạn điểm | **365 ngày** tính từ ngày kết thúc giải. | Cơ chế đã duyệt trong phiên; ngày hiệu lực bảng điểm thật chưa có. |
| Chu kỳ chốt | ADMIN chủ động tạo/xem trước/công bố kỳ sau khi hoàn tất giải và đối chiếu kết quả; không tự động công bố theo lịch. | Đã duyệt quy trình; ngày/kỳ chốt đầu tiên chưa được cung cấp. |
| Điểm theo hạng/vòng | **Cần BTC cung cấp bảng thật**, gồm hạng giải, đơn/đôi, MAIN/QUALIFYING/GROUP, vòng/hạng bảng, điểm và ngày hiệu lực. | Không đề xuất các con số mẫu thành quy chế chính thức. |

[Seed xếp hạng](../../packages/db/prisma/seed/seed-ranking-defaults.ts) ghi rõ các số điểm là **SAMPLE**; 1000/400/125 điểm vô địch và các tỷ lệ vòng không nằm trong phê duyệt này. Bảng thật phải được ghi thành phiên bản có ngày hiệu lực và ví dụ tính điểm để kiểm lại; không sửa ngược lịch sử chỉ để khớp mẫu. Bốn dòng cơ chế trên đã duyệt; G2 vẫn mở khi bảng điểm còn thiếu.

Nguồn: [settings](../../packages/shared/src/ranking-settings.ts), [điều kiện walkover](../../packages/ranking-engine/src/stage-reached.ts), [điểm seed đôi](../../packages/ranking-engine/src/pair-seed-points.ts), [nguồn kỳ chốt khi gợi ý seed](../../apps/api/src/modules/draws/draw-seed-suggestion.service.ts), [hạn điểm](../../packages/ranking-engine/src/points-for-entry.ts).

## 3. Consent — phân biệt từng phạm vi công khai

| Phạm vi | Hiện trạng trước đổi default | Quy trình đã duyệt |
|---|---|---|
| Tên/CLB trong danh sách đăng ký, nhánh, tỷ số, BXH | Vẫn hiện kể cả khi ẩn hồ sơ; dùng `publicDisplayName` nếu có, nếu không dùng tên thật. | BTC ghi nhận riêng phạm vi tên kết quả; cho phép bí danh. Không suy rằng “ẩn hồ sơ” đã ẩn tên khỏi kết quả. |
| Danh sách/tìm kiếm và trang hồ sơ VĐV | Chỉ active/public/chưa gộp; hồ sơ ẩn trả 404. Default trước thay đổi là `isPublicProfile=true`. | **Hồ sơ mới mặc định ẩn (`false`)**, chỉ bật sau xác nhận đúng phạm vi. BTC lưu/đối chiếu bằng chứng ngoài ứng dụng; không tự backfill cờ của dữ liệu cũ. |
| Ảnh/tiểu sử | Hồ sơ công khai được trả ảnh đã công bố và tiểu sử; không có cờ consent riêng. Hồ sơ ẩn không có ảnh/link trên serializer dùng chung. | Tách xác nhận ảnh/tiểu sử khỏi tên kết quả. Chưa có xác nhận thì không đưa ảnh/tiểu sử vào dữ liệu công khai; không thêm model quyền riêng trong đợt này. |
| Tuổi/ngày sinh | API công khai không trả ngày/năm sinh; tuổi chỉ bật bằng setting **toàn cục** `player.showAge`, mặc định **false**. | Giữ **`showAge=false`**; không suy phê duyệt quy trình thành quyền bật tuổi cho mọi người. |
| Máy tìm kiếm | `noindex=true` mặc định nhưng admin có thể tắt từng hồ sơ; chưa có `Person` hoặc URL hồ sơ trong sitemap. | Giữ **`noindex=true`**, không Person/sitemap. **Noindex không chặn truy cập và không phải bằng chứng consent.** |
| Liên hệ | Email, điện thoại, ngày/năm sinh riêng tư không được public serializer trả. | Tiếp tục giữ riêng tư; không gộp chúng vào đồng ý hồ sơ công khai. |

**Quy trình đã duyệt:** BTC lưu bằng chứng ngoài ứng dụng, ghi phạm vi nào được đồng ý, người xác nhận và vai trò của họ, ngày xác nhận, phiên bản nội dung đồng ý, tham chiếu bằng chứng và cách tiếp nhận/ghi nhận thu hồi. VĐV nhỏ tuổi cần người phụ trách xác định ai có thẩm quyền xác nhận và quy trình áp dụng; bản này không đặt ngưỡng tuổi hay đưa kết luận pháp lý. Phê duyệt của người dùng trong phiên này không thay bằng chứng đồng ý của từng người.

Hiện **chưa có model lưu consent hoặc thu hồi theo phạm vi**, và người dùng đã chọn **không xây model mới trong đợt này**. Hai cờ public/noindex và audit sửa VĐV không đủ chứng minh đồng ý. BTC quản lý nơi lưu, người phụ trách và đối chiếu trước khi bật hiển thị theo checklist dưới đây. Thời hạn lưu và xử lý dữ liệu sau thu hồi cần chủ sở hữu ghi nhận khi vận hành; không tự xóa lịch sử thi đấu.

Nguồn: [schema VĐV](../../packages/db/prisma/schema/players-and-entries.prisma), [serializer](../../apps/api/src/modules/public-players/public-player.serializer.ts), [profile query](../../apps/api/src/modules/public-players/public-player-profile.query.ts), [setting tuổi](../../packages/shared/src/player-settings.ts), [form admin](../../apps/admin/src/resources/players/player-form.tsx), [metadata hồ sơ](../../apps/client/src/app/[locale]/players/[slug]/page.tsx).

### Sửa hướng dẫn admin có phạm vi

Helper `noindex` trước đây ghi “Bật khi chưa có đồng ý công khai của VĐV (nhất là VĐV nhỏ tuổi).” Dòng này dễ khiến người dùng hiểu bật noindex là đủ để bảo vệ việc công khai. Đã đổi thành: “Yêu cầu công cụ tìm kiếm không lập chỉ mục, không ẩn trang. Tắt ‘Có trang hồ sơ công khai’ để ẩn hồ sơ; tên trong kết quả và BXH vẫn hiển thị. Cần xác nhận đồng ý đúng phạm vi trước khi công khai.” Sửa copy này có trước câu trả lời của người dùng; đổi default hồ sơ mới là phần triển khai riêng sau phê duyệt, với test/API/admin/migration review riêng.

## 4. Checklist triển khai và vận hành

- [ ] BTC chỉ định nơi lưu bằng chứng ngoài ứng dụng và người phụ trách; liên kết được tham chiếu bằng chứng với đúng VĐV/phạm vi trước khi bật hồ sơ hoặc thêm ảnh/tiểu sử.
- [ ] Với dữ liệu cũ, đối chiếu từng hồ sơ/ảnh đang công khai, bí danh và bằng chứng; không suy cờ cũ thành consent, không mass-backfill hoặc xóa lịch sử giải.
- [ ] Với VĐV nhỏ tuổi, người phụ trách ghi người có thẩm quyền xác nhận/vai trò và cách tiếp nhận thu hồi; không tự áp ngưỡng tuổi.
- [x] Kiểm local default ẩn: API61/worker46/browser22/mobile đạt, scoped lint+typecheck 6/6; migration chỉ ALTER DEFAULT đã áp test, G1 seed mới có review, không backfill. Giới hạn inventory 0 row cũ đã ghi riêng.
- [ ] Rollout migration/seed trên target phát hành bằng target guard/lease như runbook; đối chiếu rule cũ vì seed idempotent không cập nhật `null`. Không coi kiểm local là đã áp dev/staging.
- [ ] BTC cung cấp bảng điểm thật, phiên bản/ngày hiệu lực và kỳ chốt đầu tiên; kiểm ví dụ tính điểm trước công bố thật. G2/S2 vẫn mở tới khi đủ điều kiện.

Các test sẵn có kiểm hành vi kỹ thuật: [API profile/private/alias/whitelist](../../apps/api/test/public-players.e2e-spec.ts), [API tên công khai](../../apps/api/test/public-player-names.e2e-spec.ts), [API sitemap](../../apps/api/test/public-sitemap.e2e-spec.ts), [browser private/noindex/sitemap](../../apps/client/tests/e2e/rankings-and-players.spec.ts). Bản ghi này không thay báo cáo test mới. [Báo cáo 2026-11-20](../261111-1512-kamito-table-tennis-tournament-platform/reports/reviewer-261120-g1-g2-consent.md) là bằng chứng chạy lịch sử; quyết định mới được ghi ở đầu tài liệu này. Chỉ đóng từng cổng khi đủ điều kiện của chính cổng đó.
