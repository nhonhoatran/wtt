# Kiểm tra Git trước khi commit — phase 10

Thời điểm kiểm tra ban đầu: 2026-11-17, 16:44 (Asia/Saigon). Phạm vi: toàn bộ thay đổi tracked và untracked trong working tree tại thời điểm kiểm tra. Bước preflight ban đầu chỉ kiểm tra và đề xuất nhóm commit; việc thực hiện sau khi được xác nhận được ghi bên dưới.

## Trạng thái và kiểm tra

- Snapshot gồm báo cáo này: **122 file** gồm 65 file tracked sửa và 57 file untracked; staged **0**, unmerged **0**. Tài liệu đang được đồng bộ nên số lượng có thể thay đổi sau snapshot này.
- `git diff --check`: đạt; chỉ có cảnh báo chuẩn hóa CRLF sang LF theo cấu hình Git hiện có.
- `git ls-files -u`: không có đường dẫn xung đột. Quét nội dung file thay đổi không thấy marker xung đột.
- Không thấy đường dẫn `.env`, private key, credential file, `node_modules`, `dist`, `.next`, `generated`, `test-results` hoặc `playwright-report` trong tập file đề xuất. `git check-ignore` xác nhận các mẫu môi trường, build, test artifact và Prisma generated đang được bỏ qua.
- Quét mẫu credential có cấu trúc, URL chứa mật khẩu, private key và literal gán secret trên các file văn bản thay đổi: **0 file khớp**. Đây là kiểm tra theo mẫu, không thay thế một cuộc kiểm toán bảo mật đầy đủ. Không in giá trị cấu hình hoặc credential.
- Quét cách xưng hô riêng tư trong các file thay đổi: không có kết quả.

## Nhóm commit đề xuất

| Nhóm | File tại snapshot | Commit message đề xuất |
|---|---:|---|
| Bản vá dependency Next.js | 2 | `fix(client): update Next.js to 16.4.5` |
| Implementation và test phase 10 | 93 + 1 hướng dẫn Next.js | `feat(public): add rankings and player profiles` |
| README, docs, plans, báo cáo và ảnh kiểm thử | 26 | `docs: document public rankings and player profiles` |

Nhóm dependency gồm `apps/client/package.json` và `pnpm-lock.yaml`; diff đã kiểm tra chỉ nâng Next.js cùng các dependency và tham chiếu peer tương ứng từ 16.4.3 lên 16.4.5.

Giữ `apps/client/AGENTS.md` trong nhóm frontend. Nội dung là block hướng dẫn do Next.js quản lý, yêu cầu đọc tài liệu của bản đã cài trước khi sửa code. Đã đối chiếu với `apps/client/node_modules/next/dist/server/lib/generate-agent-files.js`: `next dev` tạo/cập nhật lại block này, nên xóa file chỉ để làm sạch diff sẽ tái tạo thay đổi ở lần chạy sau.

## Bằng chứng kiểm thử và giới hạn

Đối chiếu [báo cáo QA](tester-261117-phase-10-public-rankings-players.md) và [báo cáo review](code-reviewer-261117-phase-10-public-rankings-players.md): API tích hợp 111/111, API tag unit 16/16, client 45/45, shared 101/101, ranking engine 36/36, worker 39/39; Playwright sau F4 24/24. Build API, worker và client cuối phiên đạt. Review 9,5/10, không còn Critical/P1/P2 mở trong phạm vi đã kiểm tra. Không chạy lại các bộ test trong bước Git preflight.

Các giới hạn cần giữ trong mô tả thay đổi: kiểm thử mới xác nhận local; chưa xác nhận staging. Payload dense 50 dòng × 20 khoản đạt ngân sách 80 KiB khi truyền gzip (9.307 byte); JSON chưa nén là 377.129 byte và vượt ngân sách đó. Snapshot cũ thiếu eventId che nhãn/link khoản điểm; không sửa dữ liệu kỳ đã công bố. Các điểm này đã có bằng chứng trong báo cáo QA/review và không phải lỗi Git.

## Xác nhận thực hiện commit

Ngày 2026-11-17, chủ repo đã xác nhận tạo ba commit theo các nhóm trên. Giữ nguyên nhánh `main`, Git identity và cấu hình hiện có. Đã tạo hai commit đầu: `4990225` cho bản vá Next.js và `92fe3c9` cho implementation/test. Nhóm tài liệu gồm báo cáo này được chốt trong commit thứ ba theo thông điệp đã đề xuất.

Trước từng commit, kiểm tra đúng phạm vi staged, `git diff --cached --check`, đường dẫn bị loại trừ và mẫu credential/conflict/xưng hô riêng tư. Hai nhóm đầu đạt toàn bộ kiểm tra. Không có hook hoạt động trong `.git/hooks` và không có cấu hình `core.hooksPath` thay thế; không bỏ qua hook hoặc chạy lại các bộ test đã đạt trong bước tạo commit. Không thực hiện push.
