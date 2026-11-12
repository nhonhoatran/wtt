# Phân tích tính năng, kiến trúc thông tin và layout của worldtabletennis.com

- Ngày khảo sát: 2026-11-11 (14:52–15:08, giờ Asia/Saigon)
- Công cụ: trình duyệt thật qua Playwright MCP (desktop 1440x900, mobile 390x844). Không đăng nhập, không gửi form, chỉ đọc.
- Mục đích: rút ra danh sách tính năng, IA, mô hình dữ liệu, mẫu layout cho website giải đấu tự xây (Next.js client, React admin, NestJS API). Không sao chép logo, hình, nội dung, dữ liệu.
- Ảnh chụp: `plans/reports/wtt-screenshots/` (15 file, danh sách ở mục 9).

Quy ước: **[V]** = đã kiểm chứng trực tiếp (kèm URL/endpoint đã thấy). **[I]** = suy luận, chưa kiểm chứng.

---

## 1. Tóm tắt nhanh

- Site là SPA render hoàn toàn phía client: Angular 8.2.14 + Angular Material + Bootstrap 4 **[V]** (`ng-version="8.2.14"` trên `app-root`, bundle `main.*.js`, `vendor.*.js`).
- Không có SSR, không có meta SEO theo trang: `document.title` luôn là "World Table Tennis", trang bài viết không có `og:title`, `description`, `canonical`; `/robots.txt` và `/sitemap.xml` trả về chính `index.html` **[V]**.
- Dữ liệu đến từ 3 lớp **[V]**: (a) file JSON tĩnh trên Azure Front Door/Blob (lịch, danh sách giải, ranking, video, cấu hình), (b) API CMS (`.../api/cms/...`), (c) file JSON trận đấu cập nhật liên tục trên host "withoutcache".
- Live score dùng **HTTP polling**, không thấy WebSocket/SignalR **[V]**: Match Centre gọi lại file JSON trận mỗi ~10 giây.
- Dữ liệu thi đấu theo chuẩn kiểu ODF (Olympic Data Feed): mã tài liệu `TTEMSINGLES-----------RND2000100----------`, `DocumentType` = `DT_BRACKETS`, `DT_RESULT`, `DT_POOL_STANDING`, `Source: OVR` **[V]**.
- Điều hướng 7 mục: News, Videos, Players, Events, Matches, Rankings, Watch Live + Sign in / Subscribe **[V]**.
- Không có: đổi ngôn ngữ, shop, head-to-head, lịch sử kết quả trong hồ sơ VĐV (trên web) **[V]** (không tìm thấy ở các trang đã xem).

---

## 2. Sitemap / kiến trúc thông tin

### 2.1 Cây điều hướng [V] (https://www.worldtabletennis.com/home)

| Vùng | Mục | URL |
|---|---|---|
| Dải trên cùng | Thẻ tỉ số giải đang diễn ra (tên giải, "Hide Scores", "More") | "More" dẫn tới trang giải |
| Header | Logo | `/home` |
| Header | NEWS | `/news` |
| Header | VIDEOS | `/headervideo` |
| Header | PLAYERS | `/playerslist` |
| Header | EVENTS | `/eventslist` |
| Header | MATCHES | `/matches` |
| Header | RANKINGS | `/rankings` |
| Header | WATCH LIVE (chấm đỏ) | `/livevideo` |
| Header | Ô tìm kiếm toàn cục ("Search Articles,Videos,Players,Events") | trong header |
| Header | SIGN IN / SUBSCRIBE | Azure AD B2C / `/signup` |
| Footer cột 1 | What is WTT, Host a WTT event, Brand partnerships, Contact us | `/aboutus`, `/hostevent`, `/BrandPartnerships`, `/contact-us` |
| Footer cột 2 | Team, Careers, Technical Documents | `/team`, `careers.worldtabletennis.com`, `/technicaldocuments` |
| Footer cột 3 | Terms, Privacy, Media Portal, quảng bá app (App Store / Google Play) | `/terms`, `/privacy`, `/media_portal` |
| Footer | Logo nhóm tổ chức mẹ + 7 mạng xã hội + copyright | link ngoài |

- Không có mega menu; header là 1 hàng link phẳng **[V]**.
- Mobile: hamburger mở danh sách cùng các mục trên **[V]**.

### 2.2 Mẫu URL theo loại trang [V]

| Loại trang | Mẫu URL |
|---|---|
| Trang chủ | `/home` |
| Danh sách giải (thẻ lớn) | `/eventslist` |
| Lịch giải theo tháng | `/events_calendar` |
| Chi tiết giải | `/eventInfo?eventId={id}&selectedTab={Overview\|Matches\|Draws\|Groups\|Player List\|Event Info}` |
| Tab con Matches | `...&selectedTab=Matches&innerselectedTab={Live\|Completed\|Scheduled}` |
| Tab con Draws | `...&selectedTab=Draws&subEvt=MSINGLES` (youth: `MSINGLES--------U19`) |
| Tab con Event Info | `...&eventTab=Ranking Points and Prize Money Breakdown` |
| Trận toàn hệ thống | `/matches?selectedTab={LIVE\|COMPLETED\|SCHEDULED\|DRAWS}` |
| Match Centre (đang đấu) | `/MatchCenter?eventId={id}&docCode={mã trận}&type=live` |
| Match Centre (đã xong) | `/PostMatchCenter?eventId={id}&docCode={mã trận}&type=official` |
| Ranking tổng quan | `/rankings?Age={SENIOR\|YOUTH\|WTT SERIES FINALS RACE}&selectedTab={MEN'S SINGLES...}` |
| Ranking đầy đủ | `/allplayersranking?Age=SENIOR&selectedTab=MEN'S SINGLES` |
| Danh sách VĐV | `/playerslist` |
| Hồ sơ VĐV | `/playerDescription?playerId={ittfId}` |
| Tin tức | `/news`, lọc `/news?search={từ khoá/chuyên mục}` |
| Bài viết | `/description?artId={id}` |
| Video | `/headervideo`, mở video dạng dialog `/headervideo?vid={id}` |
| Xem trực tiếp | `/livevideo` |
| Đăng ký | `/signup` |
| Trang tĩnh từ CMS | `/{pageKey}` (vd `/media_portal`) |

Nhận xét: toàn bộ dùng query param + id số, không có slug thân thiện SEO. Trạng thái tab được đẩy lên URL nên chia sẻ link được (điểm tốt nên giữ).

---

## 3. Các loại trang và nội dung

### 3.1 Trang chủ [V] (`/home`, ảnh 01, 15)
Thứ tự khối: (1) dải thẻ tỉ số live, (2) header, (3) hero carousel 5 slide: nhãn chuyên mục, tiêu đề, chip VĐV liên quan (avatar + cờ + tên, bấm sang hồ sơ), trích đoạn, nút Read more, chấm chuyển slide, (4) "Top Stories" lưới 4 thẻ + link "More News", (5) "Latest Videos" nền tối: 1 thẻ lớn + 4 thẻ nhỏ, có thời lượng và "x months ago", (6) "Champions Spotlight": carousel VĐV nổi bật (ảnh, hạng thế giới, quốc gia, tuổi, tay thuận, % thắng trong năm, nút Player Profile), (7) footer.

### 3.2 Danh sách giải [V] (`/eventslist`, ảnh 02)
- Chuyển đổi List / Calendar; ô tìm theo tên giải; bộ lọc "Filter By Category" (All, WTT Series, WTT Feeder Series, WTT Youth Series, ITTF).
- Mỗi giải là 1 thẻ lớn toàn chiều ngang: ảnh nền thành phố, logo hạng giải, cờ + ngày, tên giải (kèm tên nhà tài trợ "Presented by ..."), địa điểm, thành phố/quốc gia, nút EVENT INFO, nút TICKETS (link ngoài, tuỳ giải), tổng tiền thưởng, đồng hồ đếm ngược (ngày/giờ/phút/giây), danh sách nội dung thi đấu kèm huy hiệu mã (MS, WS, MD, WD, XD).
- Nút "Show More Events" (tải thêm), không phân trang số.

### 3.3 Lịch giải [V] (`/events_calendar`, ảnh 03)
- Lọc theo năm (2021–2027) và nhóm giải; nhóm theo tháng ("JAN, 2026 – 3 events").
- Mỗi dòng: khoảng ngày (tháng/ngày/thứ), tên giải, hạng giải, nhà vô địch từng nội dung (link hồ sơ VĐV) nếu đã kết thúc, quốc gia, nút thêm vào lịch cá nhân (`app-add-event-tocalendar`).

### 3.4 Chi tiết giải [V] (`/eventInfo?eventId=3257`, ảnh 04, 05, 07, 16)
Phần hero dùng lại thẻ giải lớn + nút Back. Dưới là thanh tab:

| Tab | Nội dung |
|---|---|
| Overview | "CHAMPIONS" (nhà vô địch từng nội dung, chỉ hiện khi giải xong – thấy ở `eventId=3252`); "WHO IS PLAYING": menu dọc chọn nội dung + lưới thẻ VĐV (ảnh, tên, mã nước, hạng thế giới lúc đăng ký, điểm, hạt giống); dải tiền thưởng + nhà tài trợ theo vai trò (Global Premier Partner, Official Ball, Official Table, Official Floor, Official Betting Partner, Global Apparel Supplier); Related Videos; Related Articles |
| Matches | Tab con Live / Completed / Scheduled. Live: lưới thẻ trận 3 cột (vòng đấu, địa điểm + bàn, tỉ số ván, điểm từng ván, chỉ báo người giao bóng, "Current Game: n", nhãn LIVE, nút MATCH CENTRE, "Last updated"). Completed: lọc theo nội dung + tìm theo VĐV/vòng/bàn, nút LOAD MORE. Scheduled: lọc theo nội dung + theo ngày + tìm kiếm, đếm "35 Matches", ghi chú giờ địa phương, mỗi thẻ có giờ, vòng, link "Start List", 2 đấu thủ kèm hạt giống, bàn, địa điểm |
| Draws | Tab theo nội dung; nút chuyển "QLF DRAW (ngày)" / "MAIN DRAW (ngày)"; sơ đồ nhánh theo cột vòng (ROUND1, ROUND2... hoặc R32, R16, QF, SF, F); ô trận: cờ, avatar, tên, hạt giống trong ngoặc, số ván thắng, BYE, (WC) cho suất đặc cách, ngày giờ, số bàn hoặc nhãn Live, link Match Centre |
| Groups | Chỉ có khi giải có vòng bảng (thấy ở giải youth `eventId=3345`): mỗi bảng 1 bảng xếp hạng (#, Player/Pair, Results thắng–thua, Points, Status Q/NQ) + nút "Show Group Matches" |
| Player List | Tab theo nội dung; chuyển MAIN DRAW / QLF DRAW; lưới thẻ VĐV như Overview nhưng đầy đủ; chú thích "hạng thế giới tính tại thời điểm đăng ký" |
| Event Info | Tab con "Provisional Schedule": accordion theo ngày, bảng Session / Venue / Tables / Start time / Event. Tab con "Ranking Points and Prize Money Breakdown": bảng theo Singles/Doubles, từng vòng → tiền thưởng + điểm ranking. Giải youth không có tab này |

- Danh sách tab thay đổi theo giải (có/không Groups, Event Info) → tab được cấu hình động **[V]**.

### 3.5 Trang Matches toàn hệ thống [V] (`/matches`)
Cùng component với tab Matches của giải, áp cho giải đang diễn ra; thêm tab DRAWS.

### 3.6 Match Centre [V] (`/MatchCenter?...type=live`, `/PostMatchCenter?...type=official`, ảnh 09, 17)
- Hero nền tối: logo hạng giải, tên giải, nội dung – vòng, ảnh 2 đấu thủ hai bên, tỉ số ván lớn ở giữa, đồng hồ thời lượng trận, nhãn LIVE, tên + cờ + hạt giống.
- Bảng điểm: mỗi đấu thủ 1 hàng, cột tổng ván + điểm từng ván (5 hoặc 7 cột tuỳ thể thức), dấu tích người thắng.
- Dòng "Table n – tên nhà thi đấu", "Last updated on ...".
- "Match Commentary": dòng thời gian từng điểm (Point, Swap Serve, Game Point, Match Point, Start List, Match Completed) kèm giờ và tỉ số tại thời điểm đó.
- "Match Stats": chọn Match / G1 / G2...; chỉ số: Points won, Points won on own serve, Points won on opponent serve, Biggest lead, Most consecutive won, Greatest deficit overcome; ghi chú "Data unavailable on this table".
- Không thấy head-to-head, không thấy video nhúng trong trang này.

### 3.7 Rankings [V] (`/rankings`, `/allplayersranking`, ảnh 10, 11)
- Trang tổng quan: tiêu đề bảng xếp hạng, carousel VĐV nổi bật, 2 khối "Top ranked players" Nam/Nữ (top 5, tab SENIOR/YOUTH), bảng chính top 20 + "View All".
- Nhóm tab cấp 1: SENIOR / YOUTH / WTT SERIES FINALS RACE. Cấp 2 (Senior): Men's Singles, Women's Singles, Men's Doubles, Women's Doubles, Mixed Doubles, và 3 bảng "Doubles Individual". Youth: Boys'/Girls' tương ứng + dropdown "Youth Age Category" (thấy giá trị "Under 19").
- Cột: Rank (kèm mũi tên + số bậc thay đổi), Player (ảnh, tên), quốc gia, Points, nút mở rộng. "Rankings last updated on dd/mm/yyyy".
- Bảng "Finals Race": thêm mô tả cách tính, cột trạng thái QUALIFIED, nút DETAILS.
- Trang đầy đủ: dropdown khoảng hạng (Top 100, 101–200, ... tới 1101–1200+), lọc theo quốc gia (Flag), tìm theo tên, nút "Previous/Next top ranked 100".
- Mở rộng 1 dòng → bảng chi tiết điểm: Event (kèm hạng giải), Expires on, Position (W, F, SF, QF, R16, R128...), Points.

### 3.8 Danh sách VĐV và hồ sơ VĐV [V] (`/playerslist`, `/playerDescription?playerId=121558`, ảnh 12, 13)
- Danh sách: chuyển Men/Women, dropdown chọn nhiều VĐV, ô tìm theo tên hoặc quốc gia; bảng: #, tên, quốc gia, World Ranking, Gender, Age, Favourite (số lượt yêu thích); mặc định 25 dòng, sắp theo lượt yêu thích.
- Hồ sơ: nút "Mark as favourite", hero (ảnh lớn, tên, hạng thế giới, nhóm tuổi, quốc gia, tuổi, tay thuận, % thắng trong năm), lưới "Videos related to ...", mục "Biography" (trống ở VĐV đã xem).
- Payload có nhiều trường chưa hiển thị trên web: kiểu cầm vợt, thiết bị (cốt vợt, mặt vợt), tiền thưởng, trận gần nhất/kế tiếp, thống kê chi tiết (mục 5).

### 3.9 Tin tức, bài viết [V] (`/news`, `/description?artId=6816`, ảnh 14)
- Danh sách: tiêu đề NEWS, công tắc FAVOURITES, ô tìm (tên bài, tiêu đề, chuyên mục); thẻ bài: ảnh, nhãn chuyên mục (bấm để lọc), tiêu đề, "Related to {tên giải}", trích đoạn, "Mark as favourite". Tải theo trang 15 bài từ API.
- Bài viết: Back, yêu thích, chuyên mục, tiêu đề, carousel ảnh, chip VĐV liên quan, sapo, "Author | x days ago", nội dung, video YouTube nhúng, nút chia sẻ mạng xã hội, "Related Articles".

### 3.10 Video, xem trực tiếp [V] (`/headervideo`, `/livevideo`)
- Video: công tắc FAVOURITES, ô tìm; mỗi chuyên mục 1 carousel ngang (Compilations, Match Highlights, Full Matches, Top 10s, Player Features, Behind the scenes...) + "See More"; bấm thẻ mở dialog phát video (YouTube iframe), URL thêm `?vid=`.
- Nguồn video: 1.875/1.989 là YouTube nhúng, 111 là stream riêng (Azure Media) **[V]** (đếm từ `all_videos.json`).
- Watch Live: lúc khảo sát không có player hiển thị, chỉ có carousel video mới + tin mới. Payload live có `StreamingUrl` và `GeoBlocks` → có chặn theo vùng **[I]** về cách hoạt động.

### 3.11 Tài khoản [V] (`/signup`, chỉ xem, không gửi)
- Đăng nhập qua Azure AD B2C (`worldtabletennisb2c.b2clogin.com`, policy `B2C_1_Wtt_Web_SignIn`).
- Form đăng ký: tên, họ, thứ tự hiển thị tên, ngày sinh, giới tính, mã vùng + số điện thoại (tuỳ chọn), quốc tịch, nơi cư trú, mã bưu chính (tuỳ chọn), email, mật khẩu (có quy tắc), captcha, đồng ý điều khoản. Có lối "tạo thành viên sau".
- Lợi ích thành viên thấy được: yêu thích VĐV / bài / video, xem trực tiếp.

### 3.12 Trang phụ [V]
| Trang | Nội dung |
|---|---|
| `/aboutus` | Giới thiệu: tầm nhìn, sứ mệnh, lợi ích chính (thẻ tĩnh) |
| `/hostevent` | Kêu gọi đăng cai, 3 brochure PDF theo nhóm giải, ảnh "Event structure", link sang form liên hệ có sẵn category |
| `/BrandPartnerships` | Giới thiệu hợp tác thương hiệu + danh sách tin "Partnership updates" |
| `/contact-us` | Form: tên, quốc gia, điện thoại, tổ chức, thành phố, email, category (Potential Host, Host Event, Partnerships, Commercial Partner, Player, Fan, Other), nội dung |
| `/technicaldocuments` | Bảng tài liệu: Title, Category, Date, Type, Description; lọc theo category (Handbooks, General, Regulations, FAQ); file PDF trên Blob |
| `/media_portal` | Trang động từ CMS: đăng ký báo chí (link form ngoài `forms.worldtabletennis.com`), quick links, carousel tin, danh sách tài liệu truyền thông |
| `/team`, `/terms`, `/privacy` | Chưa mở – chỉ thấy link ở footer |

---

## 4. Cơ chế giải đấu quan sát được

| Chủ đề | Quan sát | Mức |
|---|---|---|
| Nhóm giải (tier) | 4 nhóm lọc: WTT Series, WTT Feeder Series, WTT Youth Series, ITTF | [V] |
| Hạng giải (event type) | Grand Smash, Champions, Star Contender, Contender, Finals, Feeder, Youth Smash, Youth Star Contender, Youth Contender + nhiều loại của liên đoàn (31 loại trong lịch 2026). Mỗi hạng có logo, màu, ảnh nền riêng | [V] |
| Nội dung thi đấu | MS, WS, MD, WD, XD; đồng đội MT, WT, XT; youth chia U11/U13/U15/U17/U19 (Boys'/Girls' Singles, Mixed Doubles) | [V] |
| Thể thức bốc thăm | Vòng loại (PREL: RND1–RND3, có BYE) → nhánh chính (MAIN: R32 → F). Giải youth có vòng bảng (GP01...) rồi knock-out | [V] |
| Thông số nhánh | `EntrySize`, `DrawSize`, `NoOfSeeds`, `NoOfByes`, `NoOfKOMatches` (vd vòng loại: 51 VĐV, draw 64, 16 hạt giống, 13 BYE) | [V] |
| Mã vòng | R512, R256, R128, R64, R48, R32, R24, 8FNL (R16), QFNL, SFNL, FNL | [V] |
| Hạt giống, suất | Seed #n trên thẻ VĐV; (n) cạnh tên trong nhánh; (WC) suất đặc cách; `EntryQuotaType`, `ProtectedRanking`, `Status: Confirmed` trong dữ liệu đăng ký | [V] |
| Thể thức trận | `matchConfig`: `bestOfXGames` (5 ở vòng loại, 7 ở chung kết Champions), `maxPointsPerGame` 11, `advantagePerGame` 2, thẻ vàng/đỏ, timeout, medical timeout | [V] |
| Trạng thái trận | Scheduled → LIVE (INTERMEDIATE) → OFFICIAL | [V] |
| Lịch thi đấu | Theo ngày, theo session (Session 01...: giờ bắt đầu, số bàn), theo bàn (T01...) + tên bàn hiển thị có thể ghi đè (vd tên sân chính) | [V] |
| Vòng bảng | Xếp hạng: thắng–thua, điểm (thắng 2, thua 1 theo số liệu thấy), Q/NQ; dữ liệu có thêm tỉ số điểm For/Against/Ratio | [V] / cách tính điểm [I] |
| Điểm ranking | Bảng điểm + tiền thưởng theo vòng cho từng giải; điểm có ngày hết hạn (khoảng 1 năm sau giải) | [V] / chu kỳ 12 tháng [I] |
| Ranking | Cập nhật theo tuần (`RankingYear/Month/Week`), có hạng trước và chênh lệch; bảng "Race" riêng cho giải cuối mùa | [V] |
| Trận đồng đội | Có trường `teamParentData`, `teamMatchNo`, `teamMatchScores` nhưng chưa xem giao diện | [I] |

---

## 5. Suy luận mô hình dữ liệu từ network

### 5.1 Host và endpoint quan sát được [V]

| Host (rút gọn) | Vai trò | Ví dụ đường dẫn |
|---|---|---|
| `wtt-web-frontdoor-*.azurefd.net` | JSON tĩnh có cache | `/websitestaticapifiles/general/{year}_eventcalendar.json`, `.../wtt_upcoming_only_events_list.json`, `.../event_prizemoney_list.json`, `.../wtt_event_ticket_list.json`, `.../event_type_details_transformed.json`, `/websitestaticapifiles/articles/wtt_new_articles.json`, `/websitestaticapifiles/videos/all_videos.json`, `/ranking/SEN_SINGLES.json`, `/ranking/PUBLISH_DATE.json`, `/websitestaticapifiles/{eventId}/{eventId}_player_seed_list_all_subevents.json`, `/websitestaticapifiles/appsettings/{key}.json` |
| `wtt-web-frontdoor-withoutcache-*.azurefd.net` | JSON thời gian thực, `cache-control: no-store` | `/matchdata/{eventId}/{docCode}.json`, `/matchdata/matchcentre/{eventId}/{docCode}.json`, `/websitestaticapifiles/running-events/{eventId}/{eventId}_livematchids.json`, `/websitecacheddata/{eventId}/schedule/schedule.json`, `/websitecacheddata/{eventId}/officialresult/officialresult_minimal.json` |
| `wtt-website-api-vm-frontdoor-*.azurefd.net` | API CMS | `/liveeventsapi/api/cms/GetBrackets/{eventId}/{subEventDoc}`, `GetEventDraws/{id}`, `GetPoolStandings/{id}`, `GetAllLiveOrActiveSubEventsDetails/{id}`, `GetPlayerEntriesforEventBySubEventId_WithParticDetails/{id}/{subEventId}`, `GetEventWinners/{id}`, `GetEventEquipmentwithLogo/{id}`, `event_provisional_schedule/list/{id}`, `event_points_breakdown/list/{id}`, `GetOfficialResult`; `/primary/api/cms/GetLatestArticleFilters/...`, `GetDetailedFavouriteArticle/{artId}/0`, `articlelistByCategory/...`, `GetPlayersListByFilters`, `GetPlayersDataByID/{id}`, `GetFeaturedPlayer`, `HasGroups/{id}`, `GetTechnicalDocumentsList`, `static_page/details/by_key/{key}`, `/primary/api/match/commentary/{eventId}/{docCode}` |
| `wtt-ttu-connect-frontdoor-*.azurefd.net`, `wttcmsapigateway-new.azure-api.net` | API dữ liệu thể thao (có lớp API gateway, một số endpoint yêu cầu khoá) | `/Players/GetPlayers?IttfId=`, `/ttu/Matches/GetLiveMatches?EventId=&TableId=`, `/internalttu/Rankings/GetRankingPointsBreakdown_FullList?...` |
| `wttwebcmsprod.blob.core.windows.net`, `wttsimfiles.blob...`, `photofiles.worldtabletennis.com`, `documentstore.ittf.com` | Ảnh, PDF, tài liệu | ảnh bài viết, ảnh VĐV, PDF kỹ thuật |
| `worldtabletennisb2c.b2clogin.com` | Đăng nhập | OpenID configuration |

Ghi chú: endpoint `internalttu/...` trả "Invalid API Key" khi gọi không kèm khoá – không thăm dò thêm.

### 5.2 Hình dạng payload tiêu biểu [V] (đã rút gọn)

**Event** (`wtt_upcoming_only_events_list.json`, 597 phần tử, ~1,7 MB):
`eventId, eventName, startDateTime, endDateTime, city, countryCode, countryName, venueId, venueName, venueCode, timeZoneId, status (Published), tournamentCategoryId, event_Tier_name, event_Color_Code, backgroundImage, logo, photo, isActive, isClosedEvent, isBubbleEvent, organizationId, sponsorName, subEvents[]`

**SubEvent**: `subEventId, eventId, subEventName, subEventCode (MS...), gender, subEventEntryType (Open/Closed), subEventDrawTypeId (1/2/3), waitingListAllowed, minTeamSize, maxTeamSize, isOptional, isActive`

**Draw**: `eventDrawsId, eventId, drawName (Main Draw / Qualification Draw), startDateTime, endDateTime`

**Entry** (đăng ký): `EventId, SubEventId, SubEventCode, SubEventAgeCategory, ittfid, IndividualName, OrgCode, Status, Seed, CurrentRanking, CurrentRankingPoints, ProtectedRanking, Penalized, IsDoubleEntry, TeamName, EntryDrawName, EntryQuotaType, GenderValue`

**Bracket** (`GetBrackets`): `TotalMatchesForSubEvent, QualificationRounds, ResultStatus, Competition.Bracket[] { Code (MAIN/PREL), EntrySize, DrawSize, NoOfSeeds, NoOfByes, NoOfKOMatches, GroupMatches, BracketItems[] { Code (vòng), BracketItem[] { Code (mã trận), Order, Position, Date, Time, Result, CompetitorPlace[2] { Code, Pos, Wlt, Result, Irm, PreviousUnit{Unit}, Competitor } } } }`

**Match** (`matchdata/{eventId}/{docCode}.json`, ~2 KB):
`eventId, documentCode, subEventName, subEventDescription, matchConfig{...}, venueName, tableNumber, tableName, competitiors[2] { competitorType (H/A), competitiorId, competitiorName, competitiorOrg, compCardY, compCardYR1, compCardYR2, compTimeout, compMedicalTimeout, players[] { playerId, playerName, playerOrgCode, playerPosition }, scores "11,11,3,0,0", irm }, currentGameNumber, gameScores "11-7,11-13,3-5", overallScores "1-1", resultStatus (LIVE/OFFICIAL), action { actionType, serverPlayer, serverReceiver, serverNext }, matchDateTime { duration, startDateLocal, startDateUTC }, playByPlaySequenceNumber, teamParentData, teamMatchNo, teamMatchScores`
- Bản "matchcentre" (~78 KB) thêm `full_msg.Results_all[]` (chuỗi message `DT_RESULT` có `SequenceNumber`) phục vụ commentary.

**Schedule unit** (`schedule.json`): `Code, StartDate, EndDate, ActualStartDate, ActualEndDate, Location (T02), ScheduleStatus, SubEvent, EventCategory, Round, Draw, VenueDescription{LocationName, VenueName}, StartList.Start[2], Order`

**Pool standing**: `Group, Rank, Result (điểm), Played, Won, Lost, For, Against, Diff, Ratio, GamesWon, GamesLost, QualificationMark, Competitor{Code, Organization, Composition.Athlete[]}`

**Player** (`GetPlayers`): `IttfId, PlayerName, PlayerGivenName, PlayerFamilyName, CountryCode, NationalityCode, OrganizationCode, Gender, DOB, Age, Handedness, Grip, Style, EquipmentSponsor, BladeType, RacketCoveringA/B, RacketColoringA/B, ActiveSince, EarningsCareer, EarningsYTD, LastMatch, NextMatch, HeadShot, HeadshotL/R, Bio`
- **Player stats** (theo `SubeventCode`, khoảng thời gian): `best_rank (+year, month), total_matches, total_wins, total_losses, winning_percentage, tournament_wins, finals_wins/losses, points_won, points_won_on_own_serve, points_won_on_opponent_serve, greatest_lead, greatest_deficit_overcome, yellow_cards_against, timeouts...`

**Ranking** (`SEN_SINGLES.json`, 500 dòng = 5 mã × top 100): `IttfId, PlayerName, CountryCode, AssociationCountryCode, CategoryCode (SEN/YOU), AgeCategoryCode, SubEventCode (MS, WS, MDI, WDI, XDI), RankingYear, RankingMonth, RankingWeek, RankingPointsYTD, CurrentRank, PreviousRank, RankingDifference, PublishDate`. Bảng đôi dùng `PairId` + 2 VĐV + `Points`.

**Article**: `id, article_Category_ID, category_Name, title, short_Title, shortDescription, description (đường dẫn file nội dung), photos_URL, articleDetailimages[], published_at, status, lang_ID, author_Name, isFeatured, slug, players, events, videos, relatedArticles, subCategories, showInWeb, showInMobile, publishOrg`

**Video**: `id, video_Type (Embedded / Direct), video_Category_ID, category_Name, title, description, video_URL, thumbnail, duration, published_at, status, eventsData[], players, isFeatured`

**Khác**: `prize money {eventId, prizeMoney, currencyName}`; `ticket {eventId, showTicket, ticketLink}`; `event sponsor {eventId, sponsorTypeName, logo, darkLogo, sponsorLink}`; `provisional schedule {date, startTime, sessionTitle, tables, competition, venue}`; `static page {pageKey, pageName, langId, isActive, menuPosition}`; `app setting {key, value, description}` (vd `live_video_streaming_event_id`, `website_show_header_score_cards` = ngày hết hạn bật, `wtt_series_event_id` = danh sách id).

### 5.3 Thực thể đề xuất cho hệ thống mới [I]
`Tier` → `EventType` → `Event` → `SubEvent` → `Draw (qualifying/main/group)` → `Round` → `Match` → `Game` → `PointEvent (play-by-play)`; `Player`, `Pair/Team`, `Entry (seed, status, quota)`, `Venue`, `Table`, `Session`, `GroupStanding`, `RankingSnapshot (tuần)`, `RankingPointsRule (theo EventType + vòng)`, `RankingPointsEarned (có hạn)`, `PrizeMoney`, `Article`, `ArticleCategory`, `Video`, `VideoCategory`, `Sponsor` + `SponsorRole`, `Document`, `StaticPage`, `AppSetting`, `User`, `Favourite`.

---

## 6. Mẫu layout theo loại trang

### 6.1 Khung chung [V]
- Header cố định (fixed) gồm 2 tầng: dải thẻ tỉ số (carousel ngang, mũi tên trái/phải, nút ẩn/hiện) + hàng nav nền đen (logo trái, link giữa, Sign in + nút Subscribe màu nổi bên phải).
- Thẻ tỉ số mini: vòng đấu, địa điểm + bàn, nhãn LIVE đỏ, 2 dòng đấu thủ (cờ, tên, số ván, điểm từng ván), mũi tên chỉ người giao bóng, dấu tích người thắng.
- Tông màu: nền đen cho header/hero/footer, nền trắng cho nội dung, 1 màu nhấn theo hạng giải (`event_Color_Code`).
- Nút cookie nổi góc dưới trái; banner cookie 3 lựa chọn khi vào lần đầu.
- Trang con có nút "Back" ở đầu.

### 6.2 Bảng tóm tắt layout

| Trang | Thứ tự khối (desktop) | Thành phần chính |
|---|---|---|
| Home | Dải tỉ số → nav → hero carousel toàn chiều ngang → lưới 4 thẻ tin → dải video nền tối (1 lớn + lưới 2x2) → thẻ VĐV nổi bật → footer | Carousel, card grid, CTA "More" |
| Events list | Tiêu đề + toggle List/Calendar + ô tìm → dropdown lọc → chồng thẻ giải lớn (ảnh nền, 2 cột: thông tin trái, nội dung thi đấu + đếm ngược phải) → nút tải thêm | Thẻ hero lặp, countdown |
| Events calendar | Bộ lọc năm + nhóm → tiêu đề tháng + số giải → danh sách dòng | Khối ngày, nhãn hạng giải |
| Event detail | Back → hero giải → thanh tab ngang (gạch chân tab đang chọn) → nội dung tab | Tab 2 cấp, menu dọc nội dung, lưới thẻ VĐV 4 cột, dải nhà tài trợ |
| Draws | Tab nội dung → nút chọn draw → các cột vòng với đường nối | Ô trận 2 dòng, cuộn dọc dài (~3.400 px với draw 64) |
| Matches | Tab trạng thái → bộ lọc → lưới thẻ trận 3 cột | Thẻ trận có header tỉ số ván, bảng điểm ván, nút Match Centre |
| Match Centre | Hero đối đầu → bảng điểm → thông tin bàn → timeline commentary → bảng thống kê 3 cột (giá trị – tên chỉ số – giá trị) | Timeline có icon theo loại sự kiện |
| Rankings | Tiêu đề → carousel nổi bật → 2 khối top 5 → tab → bảng | Bảng có dòng mở rộng |
| Players list | Tiêu đề → toggle giới tính + lọc + tìm → bảng | Bảng 7 cột |
| Player profile | Back + yêu thích → hero VĐV → lưới video → tiểu sử | Card grid |
| News | Tiêu đề + toggle yêu thích + ô tìm → danh sách thẻ bài (ảnh trái, chữ phải) | Tải thêm khi cuộn [I] |
| Article | Back → chuyên mục + tiêu đề → carousel ảnh → chip VĐV → nội dung → chia sẻ → bài liên quan | Rich text + embed |
| Videos | Tiêu đề + toggle + tìm → nhiều carousel theo chuyên mục | Dialog phát video |

### 6.3 Mobile (390 px) [V] (ảnh 15, 16, 17)
- Không tràn ngang toàn trang (`scrollWidth` = 390).
- Header cố định cao ~206 px (dải tỉ số 153 px + nav) – chiếm khoảng 1/4 màn hình; dải tỉ số chỉ hiện 1 thẻ, có mũi tên.
- Nav thu thành hamburger, mở danh sách phủ dưới header.
- Thanh tab chuyển sang cuộn ngang có mũi tên trái/phải.
- Sơ đồ nhánh: vùng chứa cuộn ngang (nội dung rộng ~1.045 px trong khung 355 px); mỗi cột vòng giữ nguyên kích thước.
- Match Centre: 2 ảnh đấu thủ hai bên, tỉ số giữa; bảng điểm ván cuộn ngang khi nhiều ván.
- Lưới thẻ chuyển về 1 cột.

---

## 7. Quan sát kỹ thuật

| Hạng mục | Quan sát | Mức |
|---|---|---|
| Front-end | Angular 8.2.14, Angular Material (tab, select, dialog, expansion panel), Bootstrap 4, jQuery slim, Font Awesome 5, ngx-slick-carousel, ng-bootstrap carousel, ngx-spinner | [V] |
| Render | CSR thuần; không meta theo trang; không robots/sitemap | [V] |
| Hạ tầng | Azure Front Door (2 profile: có cache / không cache), Azure Blob Storage, Azure API Management | [V] |
| Đăng nhập | Azure AD B2C | [V] |
| Video | YouTube iframe cho phần lớn; Azure Media Player (`amp.azure.net`, script đang lỗi chứng chỉ lúc khảo sát) cho stream riêng; URL live qua CDN riêng + `GeoBlocks` | [V] |
| Realtime | Polling XHR. Match Centre: `matchdata/{eventId}/{docCode}.json` mỗi ~10 s. Dải tỉ số: danh sách trận live + 10 kết quả gần nhất + từng file trận, chu kỳ khoảng 20–40 s (2 mẫu đo). Tham số `?q=` làm tròn thời gian để tận dụng cache theo khung 5–10 s | [V] chu kỳ Match Centre; [I] chu kỳ dải tỉ số |
| Bên thứ ba | Google Tag Manager, Google Ads/DoubleClick, Meta Pixel, RUM (`atmrum.net`), Bot Framework webchat (gọi token trả 403), form ngoài `forms.worldtabletennis.com`, vé qua link ngoài theo từng giải (2 nhà bán vé khác nhau đã thấy) | [V] |
| Cấu hình động | Nhiều hành vi bật/tắt bằng file `appsettings/{key}.json` (giải nào đang live, giải nào hiện lịch dự kiến, có hiện dải tỉ số...) và ghi đè (tên bàn, tên sân) | [V] |
| Bố cục động | Một số trang dựng bằng `app-dynamic-template-generator` / `app-dynamic-page` (khối do CMS quyết định) | [V] tên component; [I] mức độ cấu hình |

Điểm yếu nên tránh ở hệ thống mới [V]:
- Tải cả danh sách giải (~1,7 MB, 597 giải) và danh sách video (~2.000 mục) về trình duyệt rồi lọc phía client.
- Gọi lặp 1 request cho mỗi VĐV để lấy ảnh/tên (hàng chục request mỗi trang), nhiều request trùng nhau.
- Không SSR, không SEO, URL không có slug.
- Header mobile quá cao.
- `console.log` dữ liệu nội bộ ở môi trường production.

---

## 8. Bảng tính năng ưu tiên

| # | Tính năng | Trang | Hàm ý phía public / admin | Đề xuất |
|---|---|---|---|---|
| 1 | Danh sách + lịch giải, lọc theo nhóm/năm, tìm kiếm | Events | Public: list + calendar render server-side. Admin: CRUD giải, hạng giải, nhóm giải, địa điểm, ảnh nền, màu | MVP |
| 2 | Chi tiết giải với tab động | Event detail | Admin: bật/tắt tab theo giải, nội dung thi đấu, tiền thưởng | MVP |
| 3 | Đăng ký/danh sách VĐV theo nội dung, hạt giống, main/qualifying | Player List | Admin: nhập entry, seed, suất đặc cách, trạng thái | MVP |
| 4 | Bốc thăm + sơ đồ nhánh (vòng loại, nhánh chính, BYE) | Draws | Admin: tạo draw, bốc thăm, sửa tay, công bố. Public: bracket cuộn ngang trên mobile | MVP |
| 5 | Vòng bảng + xếp hạng bảng | Groups | Admin: chia bảng, quy tắc tính điểm cấu hình được | MVP nếu giải có vòng bảng, nếu không thì để sau |
| 6 | Lịch thi đấu theo ngày/session/bàn | Matches – Scheduled, Event Info | Admin: xếp lịch theo bàn, đổi tên bàn hiển thị | MVP |
| 7 | Nhập tỉ số + kết quả (ván/điểm), trạng thái Scheduled/Live/Official | Matches, Match Centre | Admin: màn hình nhập điểm cho trọng tài/bàn điều hành; `matchConfig` theo nội dung | MVP |
| 8 | Live score (thẻ trận live + dải tỉ số trên header) | Toàn site | API: snapshot trận nhỏ gọn + polling/SSE; cờ bật/tắt dải tỉ số | MVP (polling) |
| 9 | Match Centre: bảng điểm ván, thông tin bàn, thời lượng | Match Centre | Public: trang trận có URL riêng | MVP |
| 10 | Commentary từng điểm + thống kê trận | Match Centre | Cần nhập điểm theo từng pha (point-by-point) | Để sau |
| 11 | Tin tức: danh sách, chuyên mục, bài viết, liên kết giải/VĐV/video | News | Admin: soạn bài rich text, ảnh, gắn thẻ giải/VĐV, lịch đăng | MVP |
| 12 | Video: chuyên mục, nhúng YouTube, gắn giải/VĐV | Videos | Admin: CRUD video (URL nhúng), chuyên mục | MVP (chỉ nhúng) |
| 13 | Hồ sơ VĐV + danh sách VĐV có tìm kiếm | Players | Admin: CRUD VĐV, ảnh, đơn vị/quốc gia | MVP (bản gọn) |
| 14 | Bảng xếp hạng theo nhóm tuổi/nội dung, biến động hạng | Rankings | Admin: quy tắc điểm theo hạng giải + vòng, chốt bảng theo kỳ | Để sau (MVP nếu hệ thống giải cần ranking riêng) |
| 15 | Chi tiết điểm ranking có hạn dùng | Rankings | Cần sổ điểm theo giải + ngày hết hạn | Để sau |
| 16 | Bảng điểm + tiền thưởng theo vòng | Event Info | Admin: bảng cấu hình theo giải | Để sau |
| 17 | Nhà tài trợ theo vai trò (giải + toàn site), tên giải kèm "Presented by" | Event detail, footer | Admin: CRUD sponsor, vai trò, logo sáng/tối, link | MVP (bản gọn) |
| 18 | Link vé ngoài theo giải | Events | Admin: URL vé + cờ hiển thị | MVP |
| 19 | Tìm kiếm toàn cục (bài, video, VĐV, giải) | Header | API search server-side | Để sau |
| 20 | Tài khoản người hâm mộ, yêu thích VĐV/bài/video | Toàn site | Auth, bảng Favourite | Để sau |
| 21 | Xem trực tiếp (stream, chặn vùng) | Watch Live | Nhúng nền tảng ngoài trước | Để sau |
| 22 | Trang tĩnh từ CMS + tài liệu kỹ thuật (PDF, phân loại) | Footer pages | Admin: trang tĩnh, kho tài liệu | MVP (trang tĩnh), tài liệu để sau |
| 23 | Form liên hệ có phân loại | Contact | Admin: hộp thư liên hệ, danh mục cấu hình được | MVP |
| 24 | Cấu hình động/feature flag (giải đang live, bật dải tỉ số...) | Hệ thống | Bảng `AppSetting` sửa trên admin | MVP |
| 25 | Đếm ngược tới ngày khai mạc, thêm vào lịch cá nhân | Events | Thuần front-end | Để sau |
| 26 | Đa ngôn ngữ | – | Site gốc không có bộ chuyển ngôn ngữ (dữ liệu có `lang_ID`) | Cần quyết định riêng |
| 27 | SEO: SSR, slug, meta, sitemap | – | Site gốc không có; Next.js làm được ngay từ đầu | MVP |

---

## 9. Ảnh chụp

| File | Nội dung |
|---|---|
| `01-home-desktop-1440-full-page.png` | Trang chủ desktop |
| `02-events-list-desktop-1440-full-page.png` | Danh sách giải |
| `03-events-calendar-desktop-1440-viewport.png` | Lịch giải |
| `04-event-detail-overview-tab-desktop-1440-full-page.png` | Chi tiết giải – Overview |
| `05-event-detail-matches-tab-live-desktop-1440-full-page.png` | Chi tiết giải – Matches (Live) |
| `07-event-detail-draws-tab-qualifying-bracket-desktop-1440-viewport.png` | Sơ đồ nhánh vòng loại |
| `09-match-centre-live-desktop-1440-viewport.png` | Match Centre đang đấu |
| `10-rankings-desktop-1440-full-page.png` | Rankings tổng quan |
| `11-rankings-full-list-expanded-points-breakdown-desktop-1440-viewport.png` | Ranking đầy đủ + chi tiết điểm |
| `12-players-list-desktop-1440-viewport.png` | Danh sách VĐV |
| `13-player-profile-desktop-1440-viewport.png` | Hồ sơ VĐV |
| `14-news-list-desktop-1440-viewport.png` | Danh sách tin |
| `15-home-mobile-390-full-page.png` | Trang chủ mobile |
| `16-event-detail-draws-bracket-mobile-390-viewport.png` | Sơ đồ nhánh mobile |
| `17-post-match-centre-mobile-390-viewport.png` | Match Centre (đã xong) mobile |

(Số 06 và 08 đã xoá vì trùng nội dung với 05.)

---

## 10. Giới hạn của khảo sát

- Không đăng nhập: chưa thấy giao diện sau đăng nhập (yêu thích, hồ sơ thành viên, quyền xem live).
- Trang Watch Live không có player lúc khảo sát → chưa xác nhận player, DRM, cách chặn vùng.
- Chưa xem giao diện trận đồng đội, nhánh chính đã hoàn tất dạng đầy đủ, popup "Start List", "Show Group Matches", nút DETAILS của bảng Race.
- Chưa mở `/team`, `/terms`, `/privacy`.
- Chu kỳ polling của dải tỉ số chỉ đo 2 mẫu.
- Ý nghĩa `subEventDrawTypeId` (1/2/3) và `EntryQuotaType` chưa rõ.
- Không khảo sát hệ thống admin/CMS của site gốc (không công khai).

## 11. Câu hỏi chưa giải quyết

1. Giải đấu của dự án mới thuộc quy mô nào: 1 giải đơn lẻ, chuỗi giải theo mùa, hay nhiều hạng giải có ranking chung? (quyết định có cần mục 14–16 ở MVP hay không)
2. Có cần vòng bảng và nội dung đồng đội ngay từ đầu không?
3. Nhập điểm theo mức nào: chỉ kết quả ván, hay từng điểm (để có commentary + thống kê)? Ai nhập (trọng tài tại bàn bằng tablet, hay bàn điều hành)?
4. Độ trễ live score chấp nhận được là bao nhiêu? (polling 5–10 s như site gốc, hay cần SSE/WebSocket)
5. Có cần tài khoản người hâm mộ ở MVP không, hay chỉ có tài khoản quản trị?
6. Ngôn ngữ hiển thị: chỉ tiếng Việt, hay song ngữ?
7. Video/live: chỉ nhúng YouTube/Facebook, hay cần stream riêng?
8. Bán vé: link ngoài hay tích hợp nền tảng vé?
9. Nguồn dữ liệu VĐV và ranking: tự quản lý hay đồng bộ từ liên đoàn?
10. Có cần app mobile sau này không (ảnh hưởng thiết kế API và trường `showInWeb` / `showInMobile` cho nội dung)?
