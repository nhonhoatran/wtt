# Review admin E2E, Windows T2 và sẵn sàng Git — 2026-11-27

## Kết luận

Không phát hiện lỗi chặn ở phần bổ sung metadata tiến trình hoặc bộ kiểm browser auto-schedule đã đọc. **T2 vẫn mở**: đây là cải thiện khả năng điều tra, không phải sửa nguyên nhân native crash. Không stage, commit hoặc push. Cây làm việc còn nhiều thay đổi có từ trước; kết luận này chỉ áp dụng phạm vi dưới đây, không phải duyệt toàn bộ diff.

## Review độc lập

- Đọc trực tiếp các file runner chưa được track: `scripts/admin-full-flow-process.mjs`, `admin-full-flow.test.mjs`, runner chính, contract/lease, admin preview server; đối chiếu worker/cleanup seed và Playwright config để đánh giá vòng đời.
- Metadata mới chỉ ghi tên/PID/status, thời điểm, thời lượng đo bằng đồng hồ đơn điệu và phiên bản runtime. Không thêm argv, env, credential hoặc dữ liệu ứng dụng vào exit ledger. Mọi child dùng cùng `process.execPath`; runtime ghi từ parent phù hợp cách launch này.
- Giữ nguyên numeric exit; phép `code >>> 0` biểu diễn đúng cả signed/unsigned Windows status dưới dạng hex. Nhánh command tiếp tục từ chối exit khác 0, không thêm retry và không biến status mô phỏng thành “crash đã tái hiện”. Test mới cố ý gọi `process.exit` với status tương ứng; không gây native crash thật.
- Không thay logic lease, target DB, readiness, timeout, dừng cây tiến trình hoặc cleanup fixture trong metadata patch. Windows vẫn phụ thuộc `taskkill /T` khi parent còn sống; test parent đã thoát nhưng còn hậu duệ chỉ chạy POSIX. Đây là giới hạn kiểm chứng hiện có, không được diễn giải thành đã chứng minh mọi hậu duệ Windows được dọn sau một parent crash.
- Review `apps/admin/test/browser/auto-schedule.{browser.mjs,fixture.tsx,html}` cùng modal/proposal thật: chạy React/Ant Design với HTTP mock, kiểm 390/1440, preview/cancel không apply, mở lại/xóa/đổi buổi làm mất proposal cũ, request apply giữ đúng session/fingerprint; 409 làm mất proposal, refetch và buộc preview mới. Không dùng kết quả này làm bằng chứng atomicity, quyền API hoặc chạy DB/worker thật.
- Chưa thấy yêu cầu thử mới cho các nhánh không có dữ liệu/lỗi tải session/preview lỗi hoặc nhiều trang bảng; đó là giới hạn coverage, không phải lỗi đã tái hiện. Kiểm E2E full-stack và số liệu chạy browser do điều phối/tester ghi riêng.

## Bằng chứng chạy mới của reviewer

| Lệnh / kiểm tra | Kết quả |
|---|---|
| `node --test scripts/admin-full-flow.test.mjs` | **14 pass / 1 POSIX-only skip / 0 fail**, Windows Node 26.13.1. Bao gồm signed native-status simulation, service guard và abort có nested child. |
| `node --check scripts/admin-full-flow-process.mjs` và `admin-full-flow.test.mjs` | Exit 0. |
| `git diff --check` | Exit 0; kiểm cả lần sau thay đổi default consent. |
| Scan text candidate đang sửa/thêm | Snapshot ban đầu 121 file: private-key/provider-token/literal-credential và credential URL. Hai file có URL credentials là CI và unit runner; đã đối chiếu là fixture local/test được khai trong service hoặc placeholder unit, không phải credential thật được phát hiện. Không in credential. |
| Scan file mới chưa track | Không có trailing whitespace hoặc conflict marker tại snapshot kiểm. `git diff --check` riêng không bao phủ file untracked nên đã kiểm thêm phần này. |
| `git status --short --untracked-files=all -- .env .env.* pnpm-lock.yaml package-lock.json yarn.lock` | Không báo thay đổi. Không đọc/in env trong bước Git-readiness; env bị ignore cần hash/run evidence của runner để chứng minh không đổi. |

Scan regex không thay kiểm kê secret chuyên dụng hoặc review toàn bộ repo. Không phát hiện secret thật trong phạm vi đã kiểm; không khẳng định tuyệt đối mọi nguồn dữ liệu đều sạch.

## Quyết định BTC/consent và patch tiếp sau

Root đã review memo với engine/serializer/default source độc lập. Sau đó người dùng duyệt đủ ba nhóm: G1 theo đề xuất, G2 cơ chế nhưng bảng điểm thật gửi sau, consent bằng chứng ngoài ứng dụng do BTC quản lý. Câu hỏi G2 trước đó hơi rộng; memo đã ghi đúng điều kiện WO đầu chỉ MAIN/QUALIFYING, không GROUP, và seed lấy kỳ PUBLISHED mới nhất của bảng gắn nội dung. Không suy phê duyệt cơ chế thành bảng điểm chính thức hoặc consent của từng VĐV.

Reviewer này sau đó **là tác giả** patch default-private theo ủy quyền root; không tự tính phần đó là review độc lập. Phạm vi đã giao cho tester đối chiếu độc lập: schema default false và migration chỉ `ALTER COLUMN SET DEFAULT false` (không UPDATE); API tạo mới `?? false`, giữ explicit true; admin initial false; worker chỉ tạo mới false/noindex true, link/dedup không đổi cờ; seed G1 KEEP chỉ cho rule mới, không ghi đè rule hiện có. Memo/plan/docs do agent khác quản lý.

Bằng chứng có phạm vi của tác giả: worker `src/import/commit-entry-write.test.ts` **2/2 pass**, kiểm new profile private/noindex và link/dedup không cập nhật flags. API `players.e2e-spec.ts` bổ sung default false/noindex true và explicit true/PATCH bỏ trống vẫn giữ true; điều phối chạy DB và migration riêng. Không thêm test đọc lại literal seed config; hành vi rút lui đã có test engine, seed idempotence được review theo nhánh chỉ insert.

## Gate lint/typecheck sau patch consent

Reviewer đã đọc scripts của ba package trước khi chạy: chỉ `eslint` và `tsc --noEmit`. Dùng dependency đã generate; không build, regenerate Prisma hoặc ghi DB trong khi full-stack mobile chạy.

| Lệnh | Exit | Log raw (ignored) |
|---|---|---|
| `pnpm --filter @kamito/api lint` | 0 | `test-results/261127-debt-verification/reviewer-api-lint.log` |
| `pnpm --filter @kamito/api typecheck` | 0 | `test-results/261127-debt-verification/reviewer-api-typecheck.log` |
| `pnpm --filter @kamito/worker lint` | 0 | `test-results/261127-debt-verification/reviewer-worker-lint.log` |
| `pnpm --filter @kamito/worker typecheck` | 0 | `test-results/261127-debt-verification/reviewer-worker-typecheck.log` |
| `pnpm --filter @kamito/admin lint` | 0 | `test-results/261127-debt-verification/reviewer-admin-lint.log` |
| `pnpm --filter @kamito/admin typecheck` | 0 | `test-results/261127-debt-verification/reviewer-admin-typecheck.log` |

Không có ESLint/TypeScript diagnostic. PowerShell 5 ghi banner stderr của `pnpm.ps1` (`$ eslint …` / `$ tsc …`) thành `NativeCommandError` khi redirect; cả sáu process vẫn exit 0. Raw log được giữ nguyên, không coi nhãn wrapper này là lỗi lint/typecheck hoặc xóa nó khỏi bằng chứng.

## Bằng chứng tích hợp do điều phối/tester cung cấp

Root báo migration 20 đã áp default false trên DB test có **0 Player trước migration**: xác nhận default DB mới; việc giữ flags trên dữ liệu cũ chỉ được suy từ SQL không UPDATE, chưa phải thử dữ liệu cũ thực tế. Root chạy API **6 spec / 61 pass**, worker **9 file / 46 pass**. Tester chạy actual PlayerCreate **4/4 pass** sau baseline **0/4** và toàn component browser **22/22 pass**. Các số này do root/tester thực thi, không cộng vào lượt reviewer chạy độc lập ở trên. Báo cáo tester: [admin modal continuation](./tester-261127-admin-modal-continuation.md).

## Việc còn cần bằng chứng riêng

Full-stack mobile trên source cuối đang chạy ở thời điểm gate lint/typecheck hoàn tất; kết quả full-stack/build/cleanup cuối do root ghi riêng. Git-readiness không tự phê duyệt commit hoặc đóng T2, G2 bảng điểm, consent dữ liệu thật hay các cổng staging.

## Review độc lập trước commit

Sau khi người dùng yêu cầu commit/push, reviewer đọc thêm toàn bộ đường nguy cơ cao: auto-schedule service/data/engine/dependencies/conflict/DTO/controller, các helper lock/conflict dùng chung và runner lifecycle/contract. Không phát hiện blocker mới trong phạm vi này. Apply khóa theo thứ tự SubEvent → Draw → Session → Match, dùng transaction Serializable và kiểm fingerprint gồm phiên bản kết quả/lịch, participant/source, thời lượng, session và settings; các assignment/audit được ghi cùng transaction. Preview/apply bị giới hạn 32 buổi, 64 bàn và 5.000 trận. Thuật toán chỉ nối cuối hàng bàn, không tạo khoảng nghỉ trống, đúng giới hạn UI đã mô tả. Review source này không phải lượt DB hoặc stress test mới.

Runner tiếp tục kiểm đích DB/lease/namespace và từ chối service thoát, exit khác 0, lỗi log hoặc exit record; metadata không thay chính sách này. Giới hạn Windows khi parent đã thoát nhưng còn hậu duệ vẫn giữ như nêu ở trên, không đóng T2. Không chạy DB, build hoặc sửa source trong lượt review trước commit.

Inventory ban đầu: 72 file modified + 69 untracked; loại đúng 6 file của công việc SME, còn 135 candidate debt. Scan regex chỉ gặp URL credentials của fixture CI/unit đã đối chiếu; không có private key/provider token thực được phát hiện, không có trailing whitespace/conflict marker. Root xác nhận fetch origin thành công, main bằng origin/main (0/0). Manifest và script Git trong thư mục ignored dùng danh sách literal path cụ thể, kiểm hash nội dung/index/branch/remote, loại SME và kiểm lại staged whitespace/secret trước từng commit; không dùng `git add -A`. Chưa stage/commit ở thời điểm ghi đoạn này. Candidate mới cho hồi quy ngày và report review được bổ sung vào manifest khi đã hoàn tất; hash cuối chỉ refresh sau gate của root.

## Final pending source/test/config review — independent tester

Reviewed the debt implementation against the approved A/B/C/D/G/H/I scope and later opt-in decision, including new untracked source/tests/config. No SME planning work was reviewed or modified. Read the applicable client AGENTS and installed Next 16.4.5 page, fetch and metadata guides. Review covered these boundaries:

| Area | Source/test review scope |
|---|---|
| Ranking dates and jobs | Business-day API guards/context; manual/draft forms and expiry labels; completed/failed/unavailable job classification; retained feedback, retry and exact-snapshot navigation; focused API/unit/browser regressions |
| Import selection and colors | Real select identity/keyboard/popup behavior; nullable hex validation and migration; catalog persistence; current discipline identity on match reads; decorative accents retain text/conflict feedback |
| Automatic scheduling | Loader/hash, dependencies and LIVE/official rest reservations, append/cap/end/table constraints, controller permissions, transaction/audit/cache effects and lock order against existing manual/session/result writers; actual modal/helper and engine/API/browser tests |
| Public search | SSR vi/en route, bounded/escaped query, empty search, partial failure, existing private-profile serializers, no-store fetch/cache policy, canonical/alternates/noindex, header navigation and unit/browser checks |
| Runner/CI and existing test changes | Target/lease/namespace/process ownership, interruption/log/exit handling, CI services/artifact selection, lifecycle fixture restoration, unchanged measured performance budgets, historical ranking dates and print-fixture corrections |
| Approved defaults | Schema/default-only SQL, API create and optional PATCH, worker new/link/dedup paths, actual PlayerCreate, idempotent new-rule G1 seed and narrow synthetic public fixtures |

**Accepted P2, fixed before commit:** the initial date hook exposed cached data after its observer's first fetch. Closing a still-mounted modal and reopening after business midnight could initialize `SnapshotDraftModal` (`snapshot-draft-modal.tsx:53`) or `ManualPointsForm` (`manual-points-form.tsx:94`) with yesterday's date while the new GET was pending. Ant Design does not replace the mounted form's store when `initialValues` subsequently change. The API would accept the historical date, so this could silently select the wrong default.

The first key-only candidate also had a failed-request edge: installed QueryObserver defines `isFetchedAfterMount` using either successful data updates or error updates. A failed reopening request could therefore mount the old-day form before a successful Retry. The independent adversarial reviewer found that second edge and reviewed the final fix. `use-ranking-date-context.ts:15` now resets the query baseline when enabled changes; lines 22–29 additionally latch only the first successful fetch of each opening. Later background errors retain the initialized form and its edited values; the existing error guard disables submission. The bounded conditional state update passed focused ESLint. This reviewer authored that narrow fix after the lead approved the diagnosis/plan; the separate adversarial re-review found the P2 resolved and no additional concrete scheduling/runner/CI issue.

Fresh reviewer evidence uses the actual admin `/ranking-snapshots` and `/ranking-points` routes, production providers and forms, with mocked HTTP and no DB writes:

- Original hook: **0/4**, all failures show visible `27/11/2026` while the response for day 28 is held. `admin-ranking-date-before.log`.
- Key-only candidate: **0/4** error/Retry cases, all failures show the retained old date after the final 503. `admin-ranking-date-error-before.log`.
- Final hook: **8/8**, zero failures/skips/cancellations, exit 0, **88.833s**. Both forms at 390/1440 wait without an old-day form, initialize to day 28 after success/Retry, and retain an edited day 26 across a subsequent routine 60-second refresh error and Retry. No writes or uncaught page errors. `admin-ranking-date-final.log`.
- Focused hook ESLint, new browser-test Node syntax and scoped pending-diff whitespace checks exited 0. The brief initial post-key run exposed one new-test caption mismatch (`Thêm điểm` versus the page action); only that selector was corrected.

The logs above live under ignored `test-results/261127-debt-verification/`. New coverage is `apps/admin/test/browser/ranking-date-context.browser.mjs`. Earlier 22/22 component acceptance and full desktop/mobile acceptance predate this final hook fix. The intermediate key-only 26/26 run also predates the success latch; none is relabeled as a final combined run. The lead owns the final combined browser/lint/typecheck/build gates after this change.

No unresolved actionable source blocker remained in this covered debt diff after the accepted P2 fix and independent re-review. This is source review plus the scoped browser regression, not a new whole-API/full-stack/stress/physical-device run. Existing Windows orphan-process limits, unresolved T2 cause, public visual scope gaps and external organizer/consent evidence gates remain as documented; this review does not close them. No staging, commit or push was performed by this reviewer.
