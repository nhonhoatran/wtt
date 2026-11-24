# Phase 09–10: rà việc còn mở và bổ sung unit admin

## Tóm tắt

- Ngày kiểm: 2026-11-20. Phạm vi triển khai được root duyệt: tách logic state ma trận điểm thành hàm thuần và kiểm thử hồi quy; không đổi API, màn hình hoặc chính sách điểm.
- Phase 09: bổ sung **18 unit** cho state của ma trận điểm; module mới đạt **100% line/branch/function coverage** trong lượt Node coverage.
- Hồi quy admin: **24/24** ca không phụ thuộc POSIX đạt trên Windows; **5/5** ca entrypoint đạt trong WSL Ubuntu. Có **29 ca duy nhất**, không cộng trùng các lượt chạy.
- `ranking-engine`: **3 file / 36 test** đạt. Admin TypeScript, ESLint phạm vi thay đổi và build production đạt.
- Phase 10 chỉ còn checkbox deploy/đo staging; không có sửa feature phase 10 trong gói này.

## Thay đổi và bằng chứng

| File | Nội dung |
|---|---|
| `apps/admin/src/pages/ranking/ranking-rules-state.ts:38` | Tách khóa ô, state theo phạm vi đơn/đôi–draw–phiên bản, thay ô, sao chép cột, diff theo baseline và lọc hạng giải hiển thị. |
| `apps/admin/src/pages/ranking/use-ranking-rules-matrix.ts:8` | Hook sử dụng logic thật đã tách; giữ re-export các type/helper cũ cho caller. Sao chép cột thực hiện trong một state updater, vẫn bỏ qua nguồn trống và lấy cả điểm chưa lưu. |
| `apps/admin/src/pages/ranking/ranking-rules-save-modal.tsx:62` | Diff phiên bản tương lai dùng helper chung, tiếp tục so với baseline của ngày hiệu lực đã chọn. |
| `apps/admin/test/ranking-rules-state.test.mjs:9` | 18 ca kiểm thực thi code production, không mock DB/queue hoặc kiểm nội dung source bằng regex. |

Các tình huống đã kiểm: điểm `0` khác ô chưa có quy tắc; xóa input khôi phục baseline; hoàn tác chỉ xóa đúng ô sửa; cột nguồn có sửa chưa lưu; nguồn trống giữ nguyên đích; copy bằng baseline xóa sửa dư; không sửa dữ liệu đầu vào; chuyển loại đơn/đôi, draw hoặc ngày phiên bản không rò state; diff ngày tương lai bỏ ô đã có cùng điểm và giữ các ô thực sự khác; hạng giải ẩn nhưng còn quy tắc vẫn hiển thị.

## Lệnh và kết quả thực tế

Các lệnh Node/pnpm cần chạy ngoài sandbox do runtime trong `C:/nvm4w/nodejs` không resolve trong sandbox; không cài thêm runtime/dependency.

| Thư mục | Lệnh | Kết quả |
|---|---|---|
| root | `pnpm --filter @kamito/ranking-engine test` | 36/36 đạt, 3 file. Lượt đầu trong sandbox không resolve `pnpm`; chạy lại qua `require_escalated` đạt. |
| `apps/admin` | `node --test test/ranking-rules-state.test.mjs` | 18/18 đạt. |
| `apps/admin` | `pnpm exec tsc --noEmit` | exit 0. |
| `apps/admin` | `pnpm exec eslint src/pages/ranking/ranking-rules-state.ts src/pages/ranking/use-ranking-rules-matrix.ts src/pages/ranking/ranking-rules-save-modal.tsx` | exit 0. |
| `apps/admin` | `pnpm build` | exit 0; Vite 4.129 modules, có cảnh báo bundle lớn hơn 500 kB. Không coi cảnh báo này là kết quả tối ưu hiệu năng. |
| `apps/admin` | `pnpm test` | **25 đạt / 4 lỗi**. Bốn lỗi existing `admin-entrypoint.test.mjs` là `spawnSync sh ENOENT` trên Windows. Một ca negative của file này vẫn đạt vì `assert.throws` bắt cả ENOENT; không dùng ca đó làm bằng chứng entrypoint. |
| root | `wsl -d Ubuntu -- sh -lc 'cd /mnt/d/Project/wtt/apps/admin && node --test test/admin-entrypoint.test.mjs'` | **5/5 đạt** trên POSIX thật, thay cho lượt Windows thiếu shell. |
| `apps/admin` | `node --experimental-test-coverage --test test/ranking-rules-state.test.mjs test/rich-text-editor-state.test.mjs test/rich-text-image-policy.test.mjs` | **24/24 đạt**; `ranking-rules-state.ts` 100% lines / branches / functions. Đây là coverage module vừa tách, không phải coverage toàn bộ admin. |
| root | `git diff --check` | exit 0 sau khi bỏ dòng trắng cuối file. |

## Việc còn mở và giới hạn

- G2 và deploy staging vẫn mở (`phase-09-ranking-rules-points-ledger-and-snapshots.md:236,246`); phase 10 còn staging (`phase-10-public-rankings-players-list-and-profiles.md:135`). Unit local không thay thế nghiệm thu staging hoặc quy chế BTC.
- `suggest-seeds` với `apply:false` vẫn ghi `rankingAtEntry/pointsAtEntry` và audit (`apps/api/src/modules/draws/draw-seed-suggestion.service.ts:84–102`). Chưa chốt semantics preview nên gói này không tự đổi hành vi.
- Wizard gợi ý hạt giống vòng loại chưa được bổ sung lượt browser trong gói này (`phase-09...md:53`).
- Chưa kiểm React hook lifecycle, tương tác trình duyệt hoặc kết nối API qua bộ unit state này; không tuyên bố phủ toàn bộ ranking admin.
- Không query/seed/migrate DB, không sửa `.env`, không commit/push. File `.docx` untracked của người dùng không bị đụng tới.

## Đề nghị tiếp theo

- Cập nhật mục nợ unit admin của phase 09 thành đã bổ sung unit state ma trận, giữ rõ giới hạn hook/browser.
- Chạy kiểm tra wizard vòng loại khi có môi trường và dữ liệu test được xác nhận; giữ G2 và staging theo cổng hiện có.
