---
date: 2026-11-27
status: in-progress
plan: plans/261127-debt-closure/plan.md
---

# Trả nợ ngày xếp hạng, mobile import, tracker và tính năng đã chốt

## Bối cảnh

Người dùng yêu cầu chia agent xử lý toàn bộ việc có thể làm, sau đó chốt thêm màu nội dung, tự động xếp lịch và `/search`. Nhóm phân quyền file và giữ một lease DB test để migration/fixture không đụng nhau; không sửa `.env`, dev DB hoặc staging.

## Kết quả đến điểm đồng bộ

- A dùng ngày nghiệp vụ theo setting ở API và admin, kiểm cả bản nháp tương lai cũ khi publish. B giữ lỗi/404 của job; không suy thiếu kết quả thành thành công.
- C tái hiện lỗi popup bằng component thật trong ô bảng 900 px; sau giới hạn riêng trigger/popup, geometry và pointer/bàn phím đạt ở 320/390/1440. Chỉ khớp popup với trigger đã không giải quyết root cause.
- G thêm cột nullable không backfill; sau target guard, migrate test DB và generate/build. Năm ca API thật kiểm từ danh mục tới read trận, browser riêng kiểm viền/chú giải/neutral và cảnh báo.
- D đưa runner vào source, bổ sung lease/process/log/abort cleanup regression. I dùng public serializers hiện có cho tìm giải/VĐV SSR hai ngôn ngữ, no-store và noindex.
- Rà đủ 22 phase redesign: 158/160 checkbox, hai mục C11 cuối còn mở. C7 đã mở đủ PDF/ảnh; không dùng test component để đóng staging hay cổng ngoài.

## Quyết định và bài học

Fixture browser phải mô phỏng container thật mới bắt được lỗi trigger giãn. Kiểm metadata trận thật cần thiết vì UI fixture mock có thể xanh trong khi serializer chưa trả màu. Runner cần guard và cleanup bao cả lỗi sớm; lỗi log cũng là lỗi lifecycle, không chỉ diagnostics. Đã từng bàn giao G khi còn backend được phép làm; sau phản hồi lead đã tiếp tục hoàn thành migration và integration trước nhả lease.

## Tiếp theo

H đang triển khai và E/F chờ các lượt production browser, gate tổng và review cuối của root. S1/S2, G1/G2/consent, cleanup dev D1/D2 và native Windows T2 giữ mở. Không kết luận một lượt Linux sạch đã sửa nguyên nhân Windows crash; không commit/push trong lượt này.

Validation docs exit 0 (warn-only): bốn link cũ trỏ báo cáo tester 2026-11-25 không có trong checkout; cảnh báo code không đáng tin trên Windows này vì script gọi `grep` nhưng CLI không có. Các link mới đã đối chiếu file; `.env`/lockfile không đổi, test env/ảnh nằm ignored. Architecture giữ 800 dòng. Chưa có commit readiness cuối khi H vẫn đang ghi code.

Tham chiếu: [báo cáo component/API/runner](../../plans/reports/tester-261127-import-colors-runner.md), [client/PDF/tracker](../../plans/reports/tester-261127-debt-closure-client.md), [review search/runner](../../plans/reports/code-review-261127-debt-closure-search-runner.md).

## Tiếp nối E2E, BTC/consent và T2

Đã phục hồi ngữ cảnh và rà lại 22 phase redesign: 158/160 checkbox, hai mục C11 cuối còn mở. Các gate đã có log riêng: typecheck 14/14, lint 9/9, build 9/9; client unit 199, admin unit 109, browser component 14. Public production 126 đạt/16 bỏ qua, axe 80 lượt không vi phạm và 80 ảnh+4 ảnh phụ đã được review với phạm vi giới hạn trong [báo cáo visual](../../plans/reports/tester-261127-public-visual-review.md); chưa suy thành mọi trang đều có ảnh nghiệm thu.

T2 chưa tái hiện trên Node 26.13.1: 30 child trials của reproducer upstream đạt, log Application ba ngày đọc được nhưng không có event phù hợp, không có dump. Runtime này đã có guard Node #61999; không có căn cứ tự hạ Node/đổi pool. Runner thêm thời gian, runtime và mã hex vào exit record để lần lỗi sau có thể đối chiếu; test Windows mới 14 đạt/1 POSIX-only skip, không retry hoặc nuốt lỗi. [Chẩn đoán](../../plans/reports/debugger-261127-native-windows-t2.md).

E2E desktop/mobile hiện tại, nghiệm thu UI H và review cuối do root đang kiểm; chưa đổi trạng thái E/F hoặc đánh dấu T2/S2 hoàn tất từ các bằng chứng trên.

D đã đủ runner/runbook/CI và review/unit, đồng bộ hoàn tất riêng workstream đó. Người dùng đã duyệt cả ba gói [BTC/consent](../../plans/261127-debt-closure/btc-consent-decisions.md) trong phiên ngày 2026-11-27: G1 KEEP/no tránh CLB; G2 cơ chế 365 ngày/WO MAIN-QUALIFYING/seed đôi mới nhất/chốt tay, còn bảng điểm thật; BTC lưu consent ngoài ứng dụng, hồ sơ mới chỉ bật sau xác nhận, tuổi tắt/noindex bật. Phê duyệt này cho phép đổi default kỹ thuật mới; không backfill cờ cũ, không coi số điểm mẫu là chính thức hoặc thay consent từng người bằng phê duyệt quy trình. Agent BTC triển khai code/seed/default, test/migration review riêng; không áp DB khi root còn giữ lease desktop.

Root xác nhận lượt desktop mới `55081e38…` hoàn tất: 8 bước/60 phép kiểm làm mới, runner passed/envUnchanged true, worker exit 0, cleanup mọi counter 0 và lease đã nhả. Đây là build trước default G1/hồ sơ mới, dù đã có scheduler; không gộp thành nghiệm thu default mới. Mobile phải chạy trên build sau thay đổi đó. H/E/F tiếp tục mở tới khi đủ bằng chứng tương ứng. [Báo cáo root](../../plans/reports/tester-261127-admin-full-flow-continuation.md).

Sau khi nhả lease desktop, root xác nhận migration20 chỉ ALTER DEFAULT `isPublicProfile=false` đã áp DB test; không UPDATE/backfill, chưa dev/staging. Manifest sau migrate thấy default false và 0 VĐV cũ, nên không dùng `flagsUnchanged` của tập rỗng làm bằng chứng bảo toàn row cũ. API bỏ cờ/explicit opt-in/PATCH và import được kiểm riêng; test/mobile còn đang chạy tại điểm ghi này. Runbook đã nhắc seed G1 idempotent giữ nguyên các rule null đã có, không tự bật policy cho giải cũ.

Gate sau default mới hoàn tất: API 6 spec/61 test, worker 9 file/46 test, browser component 22/22 (79,395 giây) đạt. Bốn ca PlayerCreate thật 390/1440 có đối chứng đỏ trước đổi default và xanh sau, noindex true; API explicit true/PATCH bỏ cờ giữ flags được kiểm riêng. Public fixture positive chỉ opt-in ID sở hữu, full-flow import giữ default ẩn. Mobile `d6121820…` đang chạy trên code mới; H/E/F/C11 chưa đóng từ các lượt API/component này.

Điểm chốt tiếp nối: mobile `d6121820…` đã đạt 8/8 bước/60 phép kiểm làm mới trong 6,2 phút, worker exit 0, cleanup 10 counter về 0/209 khóa Redis đã dọn, `.env` không đổi và lease nhả; cổng 3371–3373 trống. Latency mobile 468–1173 ms (trung bình 777,35). Desktop/mobile giữ ba trận xếp tay, proposal lần lượt thêm 33/31 trận; ảnh mobile preview/applied/bước 7/bản in đã mở, phần footer ngoài ảnh capture được ghi giới hạn, controls có test thao tác riêng. Root xác nhận scoped lint/typecheck 6/6 đạt. H/L5 đủ backend+API+component+UI nên đóng; plan trả nợ 7/9, E/F rộng và C11 ảnh/review cuối vẫn mở. T2 chưa được chẩn đoán từ các lượt sạch này. [Báo cáo cuối có phạm vi](../../plans/reports/tester-261127-admin-full-flow-continuation.md).

## Kiểm trước commit theo yêu cầu người dùng

Người dùng yêu cầu commit và push phần việc đã xong. Review độc lập phát hiện modal xếp hạng mở lại qua nửa đêm có thể lấy ngày cũ trong cache; đã sửa để đợi lần tải thành công đầu tiên của mỗi lần mở, kể cả sau lỗi/thử lại, và giữ ngày đang nhập khi refresh nền lỗi. Đối chứng cũ đỏ; tám ca hồi quy trên hai form thật ở 390/1440 xanh. Gate cuối sau bản sửa: browser admin 30/30 trong 152,228 giây, lint/typecheck/build admin exit 0. Full API sau thay đổi consent đạt 129/129 file, 773/773 test trong 645,67 giây; lease DB test đã nhả.

Hai lượt full-stack desktop/mobile nêu trên chạy trước bản sửa hook cuối; 30 ca browser dùng HTTP mock, không được tính thành lượt full-stack mới. Review cuối không còn blocker cụ thể trong phạm vi diff; E/F rộng, hai mục C11, bảng điểm thật, consent từng người và T2 vẫn giữ giới hạn đã ghi. Chuẩn bị commit theo manifest từng nhóm; sáu tài liệu kế hoạch SME ngoài phạm vi được giữ nguyên, không đưa vào commit này. Bằng chứng và phạm vi nằm trong [báo cáo E2E](../../plans/reports/tester-261127-admin-full-flow-continuation.md) và [review](../../plans/reports/code-review-261127-admin-e2e-t2.md).
