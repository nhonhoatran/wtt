# Báo cáo nghiên cứu: thư viện bracket/giải đấu và công cụ thu thập layout website

Ngày kiểm chứng: 2026-11-11 (Asia/Saigon). Phạm vi: Part A (engine + UI bracket, hệ thống quản lý giải, scoring racket, rating) và Part B (công cụ capture layout website tham chiếu).

Phương pháp: số liệu repo lấy qua GitHub API (`gh api`, `gh search repos`), metadata package lấy qua npm registry và PyPI, nội dung README/docs lấy qua WebFetch. Không cài đặt hay chạy thử bất kỳ thư viện nào (theo yêu cầu, không cài package vào project). Mọi nhận định về tính năng chỉ dựa trên README/docs, chưa chạy thực tế. Ký hiệu "chưa kiểm chứng" = không xác minh được từ nguồn chính.

Lưu ý nguồn: `gh api` đã trả 404 cho nhiều tên repo đoán (ví dụ `Sport-Nexus/tournament-pairings`, `mmai/glicko2.js`, `Jiinxy/openskill.js`), nên các repo đó được thay bằng tên đúng lấy từ npm registry.

---

## Kết luận nhanh (xếp hạng)

| Hạng | Thành phần | Lựa chọn | Lý do ngắn |
|---|---|---|---|
| 1 | Bracket engine (sinh cấu trúc, seeding, bye, kết quả) | **brackets-manager.js** + adapter **brackets-prisma-db** | MIT, còn maintain (push 2026-09-20), có adapter Prisma, tách biệt storage |
| 2 | Bracket UI (render, tự style) | **react-brackets** v2 (MohOulabi) | MIT, headless, không style sẵn, hỗ trợ SE/DE/RR/Swiss/group→playoff, push 2026-11-10 |
| 3 | Engine thay thế nếu cần Swiss ngay | **tournament-organizer** (slashinfty) | MIT, có Swiss + tiebreak, nhưng chưa rõ cơ chế lưu trữ (chưa kiểm chứng) |
| 4 | Rating | Bảng điểm theo tier tự cấu hình trong DB; sau này thêm **openskill** (MIT) | Đơn giản, minh bạch, khớp cách vận hành giải; OpenSkill cho seeding về sau |
| 5 | Scoring racket (game/serve/overlay) | Tự xây | Không tìm thấy thư viện/app mã nguồn mở đã xác minh phù hợp |
| 6 | Công cụ capture website | **Dembrandt** + **Playwright** (Playwright là engine của Dembrandt) | MIT + Apache-2.0, chạy được SPA, không phí, không cần API bên ngoài |

Build vs integrate (Part A.5): tích hợp engine và UI có sẵn, tự viết lớp nghiệp vụ racket (giải vòng loại/chính, điểm theo tier, scoring). Lý do chi tiết ở mục 5.

---

## Part A.1: Thư viện sinh và quản lý cấu trúc giải

### Bảng so sánh

| Thư viện | URL | Licence | Stars | Push gần nhất | Phiên bản npm | Trạng thái | Chức năng xác minh được |
|---|---|---|---|---|---|---|---|
| brackets-manager.js | https://github.com/Drarig29/brackets-manager.js | MIT | 334 | 2026-09-20 | 1.11.1 (2026-09-20) | Đang maintain | Round-robin, single/double elimination; BYE chỉ khi tạo; stage RR cho seeding rồi stage loại trực tiếp; storage qua DI |
| brackets-viewer.js | https://github.com/Drarig29/brackets-viewer.js | MIT (repo) / ISC (npm, lệch nhau) | 232 | 2026-09-19 | 1.9.1 (2026-05-17) | Đang maintain | Render SE/DE/RR, vanilla JS, theme bằng CSS variables |
| tournament-organizer | https://github.com/slashinfty/tournament-organizer | MIT | 57 | 2026-10-12 | 4.1.1 (2025-12-22) | Đang maintain, tác giả là giáo viên, tự nói ưu tiên hỗ trợ | Nhiều format kèm playoff, nhiều tiebreak; TypeScript |
| tournament-pairings | https://github.com/slashinfty/tournament-pairings | GPL-3.0 (npm: GPL-3.0-or-later) | 29 | 2026-10-12 | 2.0.1 (2025-09-10) | Đang maintain | Chỉ sinh cặp: double elim, Berger (RR), Swiss (blossom) |
| react-brackets | https://github.com/MohOulabi/react-brackets | MIT | 147 | 2026-11-10 | 2.3.0 (2026-11-10) | Đang maintain, v2 viết lại hoàn toàn | Headless, SE/DE, RR, Swiss, group→playoff, seeding, bye, kết quả, standings; web và React Native |
| g-loot/react-tournament-brackets | https://github.com/g-loot/react-tournament-brackets | LGPL-2.1 (repo) / ISC (npm, lệch) | 304 | 2024-07-12 | 1.0.31-rc (2023-12-03) | Không còn hoạt động rõ | Hiển thị bảng leaderboard dạng bracket |
| react-tournament-bracket (moodysalem) | https://github.com/moodysalem/react-tournament-bracket | MIT | 285 | 2022-12-08 | 0.2.4 (2022-06-26) | Đã archive | Không dùng |
| openbracketformat | https://github.com/openbracketformat/openbracketformat | MIT | 37 | 2026-11-09 | (chưa kiểm chứng) | Đang hoạt động | Chuẩn JSON dữ liệu bracket (event / entrants / sets), không phải engine |
| david-torres/tournament-organizer | https://github.com/david-torres/tournament-organizer | MIT | 10 | 2026-03-28 | (chưa kiểm chứng) | Hoạt động thưa | REST API TypeScript: SE, RR, Swiss, league, ELO kèm decay. Tham khảo data model |

Nguồn metadata: GitHub API (`gh api repos/...`) và npm registry (`https://registry.npmjs.org/<pkg>`).

Nguồn tính năng: READMEs tại `https://raw.githubusercontent.com/Drarig29/brackets-manager.js/master/README.md`, `https://raw.githubusercontent.com/slashinfty/tournament-organizer/main/README.md`, `https://raw.githubusercontent.com/slashinfty/tournament-pairings/main/README.md`, `https://github.com/MohOulabi/react-brackets` (README).

### Đánh giá theo tiêu chí yêu cầu

**Storage (PostgreSQL / Prisma):**
- brackets-manager.js dùng dependency injection, "designed to be used with any type of storage" (README). Trang storage liệt kê `brackets-json-db`, `brackets-memory-db`, `brackets-prisma-db` (https://drarig29.github.io/brackets-docs/user-guide/storage/).
- `brackets-prisma-db` 2.1.1, ISC, push npm 2026-05-16, mô tả "A SQL database with Prisma for brackets-manager.js" (https://registry.npmjs.org/brackets-prisma-db). Điểm cần lưu ý: adapter này có thể yêu cầu schema riêng, khi đưa vào dự án phải đưa model vào `schema.prisma` và tạo migration bằng `prisma migrate dev`, không dùng `db push` (quy tắc của dự án). Tương thích phiên bản Prisma: chưa kiểm chứng.
- tournament-organizer: chưa kiểm chứng cơ chế lưu trữ. Nhiều khả năng là thư viện thuần (state in-memory), nghĩa là phải tự viết lớp persistence.
- react-brackets: không có storage, chỉ render và cấu trúc dữ liệu stage. Dữ liệu do backend cung cấp.

**TypeScript:**
- tournament-organizer viết bằng TypeScript (README: "written in TypeScript").
- react-brackets v2 là TypeScript (import `Bracket`, `singleElimination`; chưa kiểm chứng file `.d.ts` cụ thể).
- brackets-manager.js: repo có `tsconfig.json` (thấy trong cây repo qua GitHub API). Kiểu dữ liệu đầy đủ chưa kiểm chứng.
- brackets-viewer.js: README không nói về TypeScript (chỉ là topic tag).

**Hỗ trợ format:**

| Yêu cầu | brackets-manager | tournament-organizer | react-brackets v2 |
|---|---|---|---|
| Single elimination | Có | Có | Có |
| Double elimination | Có | Có | Có |
| Round robin | Có | Có (Berger) | Có |
| Group → knockout | Có (RR rồi elim) | Có (playoff, chưa rõ mức chi tiết) | Có ("groups to playoffs") |
| Swiss | Không thấy trong README | Có (blossom, max cardinality) | Có (liệt kê; chưa kiểm chứng cơ chế sinh cặp) |
| Seeding | Có | Có (chưa kiểm chứng chi tiết) | Có |
| Bye | Chỉ lúc tạo | Chưa kiểm chứng | Có |
| Consolation / 3rd place | Chưa kiểm chứng | Chưa kiểm chứng | Chưa kiểm chứng |
| Propagation kết quả | Có (update.match) | Chưa kiểm chứng | Có (theo README, "results and standings") |

**Phù hợp draw môn racket (vòng loại + main draw, seeding, đôi/đội):**
- Vòng loại + main draw: có thể mô hình hóa bằng nhiều stage trong brackets-manager (suy luận từ khái niệm stage; chưa chạy thử).
- Đôi / đội: cả hai engine đều coi tham dự viên là "participant" chung. Đôi chỉ là một participant gồm 2 người. Đây là suy luận từ cấu trúc, chưa kiểm chứng.

**Restyle cho brand riêng và SSR với Next.js:**

| Thư viện | Restyle | SSR / Next.js |
|---|---|---|
| react-brackets | Headless, "semantic markup with data-* hooks and no styles. Bring Tailwind, CSS modules, or the optional theme." (README). Tốt nhất cho brand riêng | Không ghi trong README; là React component, có thể dùng trong Server/Client component (suy luận, chưa chạy thử) |
| brackets-viewer.js | "Themes supported, with CSS variables" nhưng README không liệt kê tên biến | README không nói SSR. Gọi `window.bracketsViewer.render(...)` và tìm `.brackets-viewer`, nên phải chạy ở client (chỉ bọc trong client component) |
| g-loot | Chưa kiểm chứng | Chưa kiểm chứng; không khuyến nghị do không còn cập nhật |

Lưu ý license lệch: brackets-viewer repo báo MIT (GitHub API, file LICENSE "MIT License, Copyright (c) 2020 Corentin Girard") nhưng npm báo ISC. g-loot repo báo LGPL-2.1 nhưng npm báo ISC. Khi dùng cần đọc file LICENSE trong tarball hoặc repo.

### Đánh giá rủi ro áp dụng (adoption risk)

- brackets-manager.js và brackets-viewer.js: cùng tác giả (Drarig29), dùng ổn định, số sao vừa phải (334 / 232). Rủi ro: một người duy trì. Chưa thấy breaking change trong README; lịch sử breaking chưa kiểm chứng.
- react-brackets: rewrite v2 (có migration guide, `MIGRATION.md`), rủi ro breaking đã xảy ra một lần. Người duy trì một người (chưa kiểm chứng số contributor).
- tournament-organizer: tác giả là giáo viên trung học và công khai xin hỗ trợ (README). Rủi ro bỏ dự án cao hơn trung bình.
- tournament-pairings: GPL-3.0 là copyleft. Nếu nhúng vào mã nguồn đóng của dự án thì phải cân nhắc. Có thể dùng như dịch vụ nội bộ riêng hoặc không dùng.

---

## Part A.2: Hệ thống quản lý giải hoàn chỉnh mã nguồn mở

| Dự án | URL | Licence | Stars | Push | Ngành | Khả năng nhúng/fork |
|---|---|---|---|---|---|---|
| Tabbycat | https://github.com/TabbycatDebate/tabbycat | AGPL-3.0 | 322 | 2026-11-09 | Tranh biện (debate), BP và hai đội | Chỉ học thiết kế. AGPL nặng; từng yêu cầu donate A$1/đội cho tổ chức vì lợi nhuận (docs v2.4.7), bản mới chỉ là "suggested" (chưa kiểm chứng đầy đủ) |
| david-torres/tournament-organizer | https://github.com/david-torres/tournament-organizer | MIT | 10 | 2026-03-28 | REST API TypeScript, nhiều format | Tham khảo data model và API. Quá nhỏ để fork làm nền |
| Shedquarters | https://github.com/llukehanna/Shedquarters | MIT | 1 | 2026-11-07 | Ladder xếp hạng house league, OpenSkill, Next.js 16 + Postgres | Tham khảo ghép rating + stack. Quá mới, ít người dùng |
| Apothem | https://apothem-sk.com/ | chưa kiểm chứng | - | - | Nền tảng web quản lý giải (theo README của tournament-organizer) | Trang chủ trả nội dung rỗng khi WebFetch; chưa kiểm chứng licence, giá, self-host |

Kết luận A.2: không có hệ thống nào đã xác minh đủ điều kiện để fork làm nền cho giải racket. Chỉ nên học data model và luồng, không nhúng.

Tìm kiếm GitHub theo từ khóa "badminton tournament management", "pickleball tournament management" trả về repo đa số 0 sao, không có license, không đủ tin cậy (ví dụ https://github.com/anhduc26pickleball/AD26-Enterprise, 0 sao, không license).

---

## Part A.3: Scoring và data chuẩn cho racket

| Dự án | URL | Licence | Stars | Push | Nội dung | Đánh giá |
|---|---|---|---|---|---|---|
| TeleScore | https://github.com/JumpShot-Interactive/TeleScore | AGPL-3.0 | 73 | 2025-02-10 | Chưa kiểm chứng môn thể thao | Chưa dùng được, chưa xác minh tính năng |
| GameMaster | https://github.com/TheLittleDoc/GameMaster | AGPL-3.0 | 16 | 2022-05-20 | Scoreboard OBS (README) | Đã cũ (không push từ 2022) |
| ciirno-scoreboard-overlay | https://github.com/ciirno/ciirno-scoreboard-overlay | không có | 0 | 2025-10-03 | "scoreboard obs overlay for tournaments using react" | Không đủ tin cậy |
| ScoreboardPlus2 | repo `ha0511kr/ScoreboardPlus2` | - | - | - | Trả 404 khi kiểm tra | Chưa kiểm chứng |

Thương mại (chỉ từ kết quả tìm kiếm, chưa mở trang gốc): KeepTheScore có scoreboard badminton/pickleball với overlay OBS và chỉ báo người giao bóng (https://keepthescore.com/badminton-scoreboard/); PicklePoints (iOS) và ScoreBird có theo dõi giao bóng. Đều là sản phẩm đóng.

Kết luận A.3: không tìm thấy thư viện/app mã nguồn mở đã xác minh, có tracking giao bóng cho bóng bàn/cầu lông/pickleball. Chuẩn dữ liệu chung cho bracket là openbracketformat (MIT, chỉ về cặp đấu entity vs entity, không có tỉ số theo ván hay giao bóng). Chưa tìm thấy chuẩn dữ liệu trận đấu racket có tỉ số theo ván và giao bóng. Quy định điểm bóng bàn của ITTF/WTT không mở được (xem mục Unresolved).

---

## Part A.4: Rating và ranking

### Hai hướng

| Hướng | Cách làm | Ưu | Nhược | Ví dụ thực tế |
|---|---|---|---|---|
| Bảng điểm theo tier | Thắng giải cấp X được Y điểm, tính tổng N giải tốt nhất, điểm hết hạn sau 1 năm | Dễ giải thích cho người chơi, khớp cách ITTF/WTT, kiểm soát được bằng cấu hình | Không phản ánh chênh lệch trình độ giữa hai đối thủ | ITTF World Ranking |
| Elo / Glicko-2 / OpenSkill | Cập nhật điểm sau mỗi trận dựa trên kết quả và đối thủ | Phản ánh trình độ tốt, dùng được cho seeding | Khó giải thích, cần nhiều trận | openskill.js, glicko2js |

Số liệu ITTF (nguồn: https://en.wikipedia.org/wiki/ITTF_World_Ranking, trích dẫn quy định ITTF 2025): champion WTT Champions 1000 điểm, WTT Star Contender 600, WTT Contender 400, WTT Feeder 125, WTT Finals 1500. Tính tổng 8 giải tốt nhất, mỗi điểm có hiệu lực khoảng 1 năm. Quy định gốc (PDF ITTF) trả về 403 khi truy cập, nên các số này chưa được đối chiếu với nguồn chính.

Cảnh báo về "WTT ranking bị ngưng từ 2027": thông tin này xuất hiện trong kết quả tìm kiếm trỏ tới `https://itftennis.com/media/15605/wtt-points-tables-2026.pdf`. Đây là tài liệu của ITF tennis (World Tennis Tour), không phải bóng bàn. Dấu hiệu: ký hiệu hạng giải W/F/S/Q/FRQ và kết quả tìm kiếm ghi rõ "tennis, not table tennis". Không tìm thấy nguồn nào xác nhận ranking bóng bàn WTT bị ngưng. Không dùng thông tin này cho dự án.

### Thư viện rating

| Thư viện | URL | Licence | Stars | Push | Phiên bản npm | Ghi chú |
|---|---|---|---|---|---|---|
| openskill.js | https://github.com/philihp/openskill.js | MIT | 262 | 2026-11-07 | openskill 5.0.1 (2026-07-08) | Weng-Lin Bayesian. README tự nhận "up to 20x faster than TrueSkill" (số của tác giả, chưa kiểm chứng độc lập) |
| glicko2js | https://github.com/mmai/glicko2js | MIT | 160 | 2026-10-29 | glicko2 1.2.4 (2026-10-29) | Glicko-2, đúng thuật toán gốc của Glickman (README dẫn glicko.net) |

### Đề xuất cho giải series thương hiệu, amateur/bán chuyên

Dùng bảng điểm theo tier tự cấu hình trong DB (admin sửa được, không fix cứng số điểm, đúng quy tắc cấu hình động của dự án). Lý do: người chơi cần hiểu vì sao được bao nhiêu điểm, ban tổ chức cần kiểm soát từng tier; thuật toán rating chỉ thêm độ phức tạp khi chưa có đủ dữ liệu trận. Khi có đủ lịch sử trận, thêm OpenSkill (MIT, maintain tốt) cho xếp hạt giống (seeding) và sắp xếp nội bộ. Không dùng Glicko-2 làm mặc định vì không có lợi thế so với OpenSkill rõ ràng trong bối cảnh này (chưa chạy thử so sánh).

---

## Part A.5: Khuyến nghị build vs integrate

**Bracket engine: tích hợp.**
1. brackets-manager.js + brackets-prisma-db. Lý do: MIT/ISC, có adapter Prisma, tách storage. Điều kiện: nếu giải phase 1 không cần Swiss, đây là lựa chọn mặc định.
2. tournament-organizer nếu Swiss là yêu cầu phase 1. Lý do: có Swiss và tiebreak, MIT. Điều kiện: tự viết lớp lưu trữ, chưa rõ cơ chế persistence.
3. Tự viết: chỉ phần nghiệp vụ racket (điểm tier, quy tắc vòng loại, quy tắc giao bóng và tỉ số ván). Không có thư viện mã nguồn mở đã xác minh cho phần này.

**Bracket UI: tích hợp react-brackets v2 (MIT, headless).** Lý do: không style sẵn, dùng được Tailwind hoặc CSS của brand riêng, cover đủ format. Phương án dự phòng: brackets-viewer.js (phải bọc client component). Không dùng g-loot và moodysalem (không còn cập nhật hoặc đã archive).

**Rủi ro kỹ thuật cần lưu ý:** brackets-prisma-db cần tích hợp vào `schema.prisma` và chạy migration (không dùng `db push`). Đây là ràng buộc đã ghi trong quy tắc dự án.

---

## Part B: Công cụ capture layout và cấu trúc website

### Bảng so sánh (6 công cụ thiết thực)

| Công cụ | URL | Licence | Stars | Push / phát hành | Output | JS-rendered (SPA) | Self-host / phí | Windows |
|---|---|---|---|---|---|---|---|---|
| Playwright (script tự viết) | https://github.com/microsoft/playwright | Apache-2.0 | 99.825 | push 2026-11-11; v1.65.0 (2026-11-05) | Tùy script: HTML DOM, screenshot, JSON | Có (trình duyệt thật) | Miễn phí, self-host | Chưa kiểm chứng cài đặt trên Windows (không cài theo yêu cầu) |
| Dembrandt | https://github.com/dembrandt/dembrandt | MIT | 3.996 | updated 2026-11-11; npm 0.39.2 (2026-10-11) | Token JSON, W3C DTCG, CSS variables, Tailwind v4 `@theme`, DESIGN.md, PDF brand guide | Có (dùng Playwright, chờ hydrate 8s + 4s) | Miễn phí, chạy local | Chạy `npm i -g dembrandt`, `dembrandt install-browser`, `dembrandt <domain>`; Node 18+ (README). Chưa kiểm chứng trên Windows |
| SingleFile CLI | https://github.com/gildas-lormeau/single-file-cli | AGPL-3.0 (npm: AGPL-3.0-or-later) | 1.689 | push 2026-11-10; npm 2.26.0 (2026-11-10) | Một file HTML tự chứa (snapshot DOM đã render) | Có (chạy trình duyệt) | Miễn phí, local. AGPL: dùng nội bộ ổn; phân phối bản sửa có nghĩa vụ | Chưa kiểm chứng |
| Crawl4AI | https://github.com/unclecode/crawl4ai | Apache-2.0 | 87.203 | push 2026-11-10; PyPI 0.9.5 (2026-10-14) | Markdown, HTML, dữ liệu trích xuất | Có (dùng Playwright, theo mô tả repo) | Self-host miễn phí; repo cũng quảng bá Cloud API có free tier (chi tiết chưa kiểm chứng) | Python; chưa kiểm chứng |
| Firecrawl | https://github.com/firecrawl/firecrawl | AGPL-3.0 (repo); SDK `@mendable/firecrawl-js` MIT (npm 4.52.0, 2026-11-04) | 200.658 | push 2026-11-11 | Markdown, HTML, crawl | Có (theo mô tả) | Cloud trả phí: Free 1.000 credit/tháng; Hobby $19/tháng; Standard $99/tháng (https://www.firecrawl.dev/pricing). Self-host: trang giá không nói | Qua API, không cần cài local |
| BuilderIO figma-html | https://github.com/BuilderIO/figma-html | MIT | 3.717 | push 2025-08-19 (đã hơn 15 tháng) | Layer Figma editable | Chưa kiểm chứng | Miễn phí | Chưa kiểm chứng; có dấu hiệu không còn hoạt động |

Công cụ loại khỏi bảng chính, lý do:
- html.to.design: freemium độc quyền. Free: 10 import mỗi 30 ngày (AlternativeTo). Giá PRO chỉ là một bình luận Reddit (chưa kiểm chứng; trang chính thức https://html.to.design/docs/pro-plan chưa mở).
- screenshot-to-code (https://github.com/abi/screenshot-to-code, MIT, 81.147 sao, push 2026-11-05): sinh code từ ảnh chụp, không phải bản sao cấu trúc. Phù hợp làm prototype, không phù hợp làm tham chiếu layout chính xác. Yêu cầu API key LLM: chưa kiểm chứng.

### Khuyến nghị toolchain tối thiểu (xếp hạng)

1. **Playwright + Dembrandt (ưu tiên số 1).** Dembrandt dùng chính Playwright bên dưới (README), nên chỉ cần một engine trình duyệt. Playwright script chụp screenshot ở vài viewport (desktop/mobile) và xuất cây DOM rút gọn. Dembrandt xuất token màu, font, spacing. Miễn phí, local, MIT/Apache-2.0, không đưa dữ liệu ra dịch vụ bên ngoài.
2. **SingleFile CLI (bổ sung, khi cần lưu snapshot).** Lưu một file HTML tự chứa để xem offline. Lưu ý AGPL và việc snapshot chứa nguyên tài sản của site, chỉ giữ cục bộ cho mục đích tham khảo.

Không khuyến nghị Firecrawl/Crawl4AI cho mục đích này: thứ cần là layout và token, không phải dữ liệu markdown hàng loạt; Firecrawl có phí và AGPL; Crawl4AI thêm stack Python không cần thiết.

### Ràng buộc pháp lý và đạo đức

Kiểm chứng ngày 2026-11-11:

| Site | Kết quả | Ý nghĩa |
|---|---|---|
| worldtabletennis.com | `https://www.worldtabletennis.com/robots.txt` trả về HTML của SPA (trang Google Tag Manager và `<base href="/">`), không phải file robots thật | Không xác nhận được chính sách crawl qua robots.txt. Trang chủ WebFetch chỉ trả về tiêu đề, không lấy được footer/link điều khoản. Điều khoản sử dụng: chưa kiểm chứng |
| midomax.vn | `https://midomax.vn/robots.txt`: `User-Agent: *`, `Allow: /`, `Disallow: /private/`, có Sitemap | Được phép crawl trang công khai, trừ `/private/` |
| kamito.vn | `https://kamito.vn/robots.txt`: Disallow `/admin`, `/cart`, `/checkout`, `/account`, `/search`, `/orders`, và các biến thể collection/blog có `+` | Không crawl các đường dẫn bị chặn; site chạy trên Haravan (theo chính comment trong robots.txt) |

Nguyên tắc đề xuất (không phải pháp lý đã xác minh, mang tính thực hành):
- Chỉ capture để tham khảo layout, cấu trúc, token màu/font. Không sao chép hình ảnh, nội dung, logo, copy văn bản.
- Không tái phân phối snapshot HTML hay token của site người khác trong repo công khai.
- Tôn trọng robots.txt; giới hạn tốc độ (ví dụ vài request mỗi phút), không chạy crawl toàn site.
- Điều khoản sử dụng của WTT chưa xác minh được. Ví dụ tương tự từ ITF (https://www.itftennis.com/en/about-us/terms-conditions/ , qua kết quả tìm kiếm, chưa mở trang) ghi nội dung được bảo vệ bản quyền và chỉ cho tải một trang cho mục đích cá nhân, phi thương mại. Đây là điều khoản của tổ chức khác, không áp dụng trực tiếp cho WTT.
- Chưa kiểm chứng: luật sở hữu trí tuệ Việt Nam áp dụng cho việc tham khảo layout. Cần tư vấn pháp lý nếu sản phẩm thương mại hóa.

---

## Hạn chế của nghiên cứu

- Không cài và không chạy thử bất kỳ thư viện nào. Mọi tính năng chỉ dựa trên README/docs.
- Không mở được PDF quy định ITTF (403) và trang ittf.com/rankings (403). Điểm ranking bóng bàn chưa đối chiếu với nguồn chính.
- Không mở được trang điều khoản/footer của worldtabletennis.com.
- Không kiểm chứng: Apothem, giá html.to.design PRO, các trang tính năng thương mại (KeepTheScore, PicklePoints, ScoreBird) từ trang gốc.
- Không tìm thấy chuẩn dữ liệu trận racket có tỉ số theo ván và giao bóng.

## Unresolved questions

1. Quy định điểm ITTF/WTT bóng bàn (PDF 2025-04-22) có khớp số liệu Wikipedia không? Cần truy cập từ môi trường khác hoặc nguồn ITTF chính thức.
2. WTT (bóng bàn) có kế hoạch thay đổi hệ thống ranking không? Chưa tìm thấy nguồn xác nhận; tài liệu "ngưng 2027" là của ITF tennis.
3. brackets-manager.js có hỗ trợ consolation/3rd place và Swiss không? README không nói; cần đọc docs reference hoặc test.
4. tournament-organizer lưu trữ dữ liệu thế nào, có adapter DB không?
5. brackets-prisma-db tương thích phiên bản Prisma nào, schema có khớp schema giải đấu dự định không?
6. react-brackets v2 có xuất TypeScript types và chạy được trong Server Component của Next.js không?
7. Điều khoản sử dụng và chính sách crawl của worldtabletennis.com là gì? Nếu cấm crawl, phải chuyển sang tham khảo thủ công.
8. midomax.vn và kamito.vn có phải site của chính chủ dự án không? Nếu có, quyền capture rõ ràng hơn.
9. Cài đặt Dembrandt và SingleFile CLI trên Windows 11 có gặp lỗi gì không? Chưa thử.
10. Apothem và html.to.design: cần mở trang gốc để xác minh licence và giá.
11. Có cần chuẩn dữ liệu trận có tỉ số theo ván và giao bóng cho bóng bàn, cầu lông, pickleball không? Chưa tìm thấy chuẩn nào mở.
12. Licence thực tế của brackets-viewer.js (MIT trên repo, ISC trên npm) và g-loot (LGPL-2.1 trên repo, ISC trên npm) cần xác nhận từ tarball trước khi dùng.
