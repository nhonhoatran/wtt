# Phân tích nhận diện thương hiệu Midomax / Kamito cho website giải đấu

- Ngày khảo sát: 2026-11-11 (Asia/Saigon). Phương pháp: `curl` HTML + CSS công khai, đọc ảnh logo/banner bằng mắt, lấy mẫu màu pixel logo. Không đăng nhập, không gửi form.
- Phạm vi: `https://midomax.vn` (trang chủ, `/introduce`, `/kham-pha`, `/kamito`, `/news`, sitemap) và `https://kamito.vn` (trang chủ, `/pages/about-us`, `/pages/kamito-loyalty-member`, `/blogs/su-kien`, `/blogs/pickleball-team-kamito`, `/collections/bong-ban`, 4 bài viết, sitemap, robots).
- Quy ước: mọi giá trị màu/font bên dưới lấy từ CSS hoặc ảnh thật; chỗ nào ghi **chưa kiểm chứng** là chưa có bằng chứng trực tiếp.

## 0. Tóm tắt nhanh

| | Midomax (`midomax.vn`) | Kamito (`kamito.vn`) |
|---|---|---|
| Vai trò | Website công ty (corporate, B2B/tuyển dụng) | Cửa hàng online bán lẻ (B2C) |
| Nền tảng | Next.js (Turbopack) + Tailwind v4, CMS riêng | Haravan (theme tuỳ biến, Bootstrap 4 + Swiper) |
| Màu chủ đạo | Xanh navy/indigo `#2E3D94` + đỏ nhấn `#E31E24` | Đỏ `#EC1E24`/`#E30925` + đen `#0A0A0A`; bản mới thêm navy `#0F285D` + vàng chanh `#E3F42A` |
| Font | Oswald (mặc định) + Be Vietnam Pro (+ Inter) | Archivo |
| Bo góc | Lớn: 12 / 18 / 24px | Nhỏ: 4 / 8px (trang Member mới: 20px) |
| Tài khoản | Không có | Có: tài khoản Haravan + chương trình Kamito Member |

Điểm quan trọng nhất cho website giải đấu: trang **Kamito Member** (ra mắt 22/09/2026 theo nội dung trang) là biểu hiện thương hiệu mới nhất, dùng bộ **đỏ + navy + vàng chanh** — trùng khớp tự nhiên với cặp màu navy/đỏ của Midomax, và chính sách Member đã nêu quyền lợi "suất tham gia giải đấu do Kamito tổ chức".

## 1. Thông tin thương hiệu

### Midomax
- Pháp nhân: Công ty Cổ phần Midomax Việt Nam, MS ĐKKD 0106845582 (nguồn: footer `kamito.vn`, `kamito.vn/pages/about-us`).
- Mô tả: "MIDOMAX chuyên cung cấp các trang thiết bị, dụng cụ và giải pháp trong nhiều môn thể thao và hướng tới tương lai trở thành đơn vị hàng đầu về thể thao tại thị trường Việt Nam." (`og:description` trang chủ).
- Meta description: "nhà phân phối độc quyền Kamito tại Việt Nam". Lời chứng thực đối tác trên trang chủ còn nhắc "nhà phân phối độc quyền thương hiệu thể thao Mizuno và Kamito".
- Khẩu hiệu hero: "VƯƠN TỚI ĐỈNH CAO"; `/introduce`: "Hành trình vươn tầm – Vì cộng đồng Thể thao"; `/kham-pha`: "Hơn cả một trận đấu".
- Đối tượng: đại lý/đối tác (mục "Đối tác nói gì", "hệ thống đại lý trải dài khắp 43 tỉnh thành"), ứng viên (`/hiring`, CTA "Gia nhập đội ngũ chiến thắng"), báo chí.
- Giọng văn: trang trọng, tự hào, dùng ẩn dụ thi đấu ("chinh phục", "chạm đỉnh", "làm chủ cuộc chơi").
- Liên hệ: hotline 024 3944 9999, info@midomax.vn; trụ sở 42 Miếu Đầm (Hà Nội), 188 Bis Trần Quang Khải (TP HCM).

### Kamito
- `<title>`: "Kamito: Thương hiệu thể thao Việt Nam"; `og:site_name`: "KAMITO SPORT".
- Tagline footer: **"ENJOY THE GAME"** (`<h6>` trong `.mainFooter`). Banner Member: **"MOVE. GROW. TOGETHER."**. Banner sản phẩm: "PLAY BEYOND YOUR LEVEL". `midomax.vn/kamito`: "Vì một Việt Nam thể thao hơn".
- Bán: quần áo, giày, vợt, bóng, balo/túi, bàn bóng bàn, phụ kiện; có dịch vụ "Đặt đồng phục" (`/pages/may-do`) và đăng ký đại lý (`/pages/dai-ly`).
- Môn thể thao (menu "Môn thể thao"): Pickleball, Cầu lông, Bóng đá, Bóng chuyền, Bóng bàn, Running, Thời trang đa dụng/Training.
- Đối tượng: người chơi phong trào đến bán chuyên, cả nam/nữ/trẻ em (tab "Nam giới / Nữ giới / Trẻ em / Unisex"), nhạy giá (mục "Đồng giá 99k-199k", "FREESHIP ĐƠN HÀNG TRÊN 499K").
- Giọng văn: năng động, ngắn, nhiều chữ in hoa và tiếng Anh xen kẽ ("NEW ARRIVAL", "XEM TẤT CẢ", "SHOP NOW"); bài blog thiên về tường thuật sự kiện + hướng dẫn kỹ thuật.
- Cửa hàng: Miếu Đầm (Hà Nội), Thảo Điền và Trần Quang Khải (TP HCM) — `kamito.vn/pages/about-us`.

## 2. Nhận diện thị giác đang dùng

### 2.1 Màu

**Kamito** — biến `:root` trong `<style>` nội tuyến của `kamito.vn`:

| Vai trò | Hex | Nguồn |
|---|---|---|
| Đỏ logo | `#EC1E24` | lấy mẫu pixel `logo.png`, `favicon.png` (96–100% điểm ảnh) |
| Đỏ chữ/nhấn | `#EC2228` | `--text-secondary-v1` (hover menu, mục Sale) |
| Đỏ đậm chính | `#A31115` | `--shop-color-main`, `--background-primary-v1` (`.btn:hover`) |
| Đỏ giá bán | `#C60F14` | `--background-primary-v2`, `.pro-price span` |
| Đỏ sáng | `#FD363C`, `#FF666B` | `--background-secondary-v1/v2` (`.topbar-header` nền `#FF666B`) |
| Đen | `#0A0A0A` | `--shop-color-text`, nền `.btn`, tag giảm giá, tab active |
| Xám chữ | `#404040`, `#737373` | `--text-dark-v2/v3` |
| Nền/viền | `#FAFAFA` (body), `#F5F5F5`, `#E5E5E5`, `#D4D4D4`, `#FFFFFF` | `--background-light-*`, `--shop-color-border` |
| Dải chạy chữ | gradient `#475569 → #1E293B` | `.bg-gradient-1` |

**Kamito Member** (bản mới nhất) — `.kml-page` trong `cdn.hstatic.net/themes/1000341630/1001416770/14/style-kamito-member.css`:
`--kml-red:#E30925; --kml-navy:#0F285D; --kml-navy2:#0F2452; --kml-lime:#E3F42A; --kml-grey:#606060; --kml-light:#F4F6F8`. Banner `kamito_member_2_2048x2048.png` xác nhận bằng mắt: mảng đỏ + mảng navy cắt chéo bằng vạch trắng, bóng pickleball vàng chanh.

**Midomax** — `@layer theme :root` trong `midomax.vn/_next/static/chunks/f182dee6da265bc1.css`:

| Vai trò | Hex | Nguồn |
|---|---|---|
| Xanh logo | `#2E3D95` | lấy mẫu pixel `/images/icon.png` (100%) |
| Chữ chính / tiêu đề | `#2E3D94` | `--color-foreground` |
| Menu active | `#1D2E83` | class `text-[#1D2E83]` trên `<nav>` |
| Nền tối (footer, CTA tuyển dụng) | `#21317F`, `#24317A`, `#0D2580` | `--color-surface-dark`, `--color-surface-darker`, `bg-[#0D2580]` |
| Đỏ nhấn (nút chính) | `#E31E24`, hover `#C8181E` | `--color-accent`, `--color-accent-hover` |
| Nền | `#FFFFFF`, `#F4F4F6` | `--color-background`, `--color-surface` |
| Viền | `#D1D5DB`, `#E5E7EB`, `#EFEFEF` (nav) | `--color-border`, `--color-border-light` |
| Chữ phụ | `#6B7280`, `#4B5563`, `#7A7A7A`, `#343434` | `--color-muted`, `--color-muted-foreground`, class nav |
| Nút "Contact Us" | `#2B2B2B`, hover `#1F1F1F` | class trên `<nav>` |
| Trạng thái | success `#16A34A`, warning `#D97706` (sao đánh giá), error `#E31E24` | `--color-success/warning/error` |

Nhận xét: đỏ nhấn Midomax `#E31E24` gần như trùng đỏ Kamito (`#EC1E24`, `#E30925`) → đỏ là cầu nối giữa hai thương hiệu.

### 2.2 Font

| Site | Font | Trọng số | Nạp từ đâu | Dùng ở đâu |
|---|---|---|---|---|
| Kamito | Archivo | 300, 400, 500, 600, 700 | `fonts.googleapis.com/css?family=Archivo:300,400,500,600,700&subset=vietnamese` | `--font-family` cho toàn site; body 14px, `letter-spacing:-0.2px`; heading `font-weight:500`, h1 56px → h5 32px, `letter-spacing:-1.2px` |
| Kamito Member | `KmlArchivo` (tự host) + `KmlMyriad` | 100, 300, 600, 800 | `style-kamito-member.css` | body 300; eyebrow 600 in hoa màu đỏ; `.kml-h2` 800 in hoa màu navy |
| Midomax | Oswald | 400–700 | `next/font` tự host tại `/_next/static/media/*.woff2` | `--font-sans` = font mặc định của `body` |
| Midomax | Be Vietnam Pro | 300–900 | như trên | nav (`.midomax-design-font *{font-family:var(--nf-be-vietnam-pro)…!important}`), nội dung bài viết |
| Midomax | Inter | 400–700 | như trên | có khai báo `@font-face`; vị trí sử dụng trên trang chủ **chưa kiểm chứng** |

- Tiêu đề Midomax: `font-semibold tracking-tight leading-[1.1]`, cỡ `clamp(2.5rem,3vw,3rem)`; hero h1 `font-black`, cỡ `clamp(2.5rem,4vw,6rem)`; nhãn nhỏ `uppercase tracking-widest text-xs`.
- Ghi chú kỹ thuật: class `font-[var(--font-be-vietnam-pro)]` trên nav bị Tailwind biên dịch thành `font-weight` (không phải `font-family`); font thật sự đến từ class `.midomax-design-font`. Không nên sao chép cách viết này.

### 2.3 Logo (chỉ ghi URL, không tải vào dự án)

| Biến thể | URL |
|---|---|
| Kamito – biểu tượng cánh chim + chữ, màu đỏ, nền trong | `https://cdn.hstatic.net/themes/1000341630/1001416770/14/logo.png?v=6975` (128×120) |
| Kamito – favicon | `https://cdn.hstatic.net/themes/1000341630/1001416770/14/favicon.png?v=6975` |
| Kamito – chữ nhỏ trong menu Midomax | `https://midomax.vn/images/menu.png` |
| Kamito – ảnh chia sẻ MXH | `https://cdn.hstatic.net/themes/1000341630/1001416770/14/share_fb_home.png?v=6975` |
| Kamito Member – wordmark trắng trên nền đỏ (chỉ có dạng banner) | `https://cdn.hstatic.net/files/1000341630/file/kamito_member_2_2048x2048.png` |
| Midomax – wordmark xanh, nghiêng | `https://midomax.vn/images/icon.png` |
| Midomax – wordmark trắng (footer) | `https://midomax.vn/logo/logo-white.svg` (SVG bọc ảnh bitmap, ~390KB — không phải vector thật) |
| Midomax – favicon | `https://midomax.vn/icon.svg` (cũng là SVG bọc PNG) |

Cả hai site không công khai file logo vector → cần xin file gốc.

### 2.4 Nút, thẻ, bo góc, đổ bóng

| | Kamito | Midomax |
|---|---|---|
| Nút chính | `.btn`: nền `#0A0A0A`, chữ trắng in hoa, `letter-spacing:1px`, `font-weight:500`, `border-radius:4px`, padding `8px 32px`; hover chuyển đỏ đậm `#A31115` | nền `#E31E24`, chữ trắng, `font-semibold`, `rounded-md` (12px), `px-8 py-3 text-lg`, hover `#C8181E`, `active:scale-[0.97]` |
| Nút phụ | — | viền 2px `#E31E24`, chữ đỏ, hover tô đỏ |
| Nút đặc trưng | Member: `.kml-btn` bo 8px, in hoa, 600 | "Contact Us": nền `#2B2B2B`, **vát góc trên-phải 10px** bằng `clip-path:polygon(...)` |
| Thẻ | `.product-block`: nền trắng, viền `#FAFAFA`, bo 8px; ảnh vuông; tag giảm giá nền đen bo 4px; giá đỏ `#C60F14` 20px | thẻ trắng bo 24px (`rounded-xl`, `--radius-xl`), bóng `0 1px 3px #0000000f`, hover `0 4px 12px #00000014` |
| Thang bo góc | 4px (chủ đạo), 8px, 50%; Member: 20px | 8 / 12 / 16 / 18 / 24 / 32px, `rounded-full` |
| Tab | `.tabs-style-1`: tab active nền đen chữ trắng, bo `4px 4px 0 0` | bộ lọc "Mới nhất / Sản phẩm / Sự kiện" trên `/news` (kiểu dáng chưa kiểm chứng) |

### 2.5 Ảnh và icon
- Kamito – ảnh chiến dịch: vận động viên chụp studio trên nền tối, vệt sáng chuyển động đỏ/xanh, có chữ ký vận động viên (`share_fb_home.png`).
- Kamito – ảnh danh mục/sản phẩm: chân dung studio nền xám sáng, sản phẩm là điểm màu (`file/b_ng_b_n_large.jpg`); ảnh sản phẩm vuông 600×600.
- Kamito – ảnh bộ sưu tập: ảnh ghép lifestyle, nền trời xanh, chữ trắng đậm (`cover_web_pc__5__2048x2048.png` – V-League Collection 26/27).
- Midomax – ảnh xem trước: nền navy, ánh vàng kim, kiểu vinh danh doanh nghiệp (`midomax.vn/preview.jpg`). Hero trang chủ là video + ảnh từ CMS — nội dung video **chưa kiểm chứng** bằng mắt.
- Icon Kamito: SVG nét mảnh `stroke-width:1.5` (symbol `#arrow-right`), kèm vài icon Font Awesome (`fa fa-long-arrow-right`) và icon bitmap nổi (Zalo, Messenger, điện thoại).
- Icon Midomax: file SVG rời tại `/icon/phone.svg`, `/icon/mail.svg`, `/icon/map-pin.svg`; icon MXH trong ô vuông bo `rounded-md` nền `white/10`.

## 3. Quy ước bố cục

### Kamito (`kamito.vn`)
- **Thanh thông báo** trên cùng (`.topbar-header`, nền `#FF666B`): "Đăng ký Kamito Member hôm nay - Nhận ngay Voucher 50K…".
- **Header**: logo trái → mega menu (New, Môn thể thao, Nam, Nữ, Bộ sưu tập, Sale, Đặt đồng phục) → tìm kiếm, giỏ hàng, tài khoản; dính khi cuộn (`.header-wrapper.is-sticky header{position:fixed;background:#fff}`); hover menu đổi đỏ + in nghiêng.
- **Trang chủ theo thứ tự**: slider hero toàn chiều rộng (1920×960, mobile 768×1024) → băng chuyền danh mục môn thể thao (ảnh vuông bo 10px, tên bên dưới) → banner "NEW ARRIVAL" + băng chuyền sản phẩm → tab sản phẩm theo giới → dải chữ chạy (freeship, đổi trả) → "KAMITO BLOG'S" với tab TEAM KAMITO / SỰ KIỆN / KỸ THUẬT THỂ THAO / SẢN PHẨM MỚI.
- **Lưới**: Bootstrap 4; `.container-fluid{width:1520px;padding:0 40px}`; sản phẩm 4 cột (`col-md-3`), trượt bằng Swiper; khoảng cách section 64px (mobile 40px).
- **Footer** nền trắng: logo + "ENJOY THE GAME" + ĐKKD + hotline | VỀ KAMITO | SẢN PHẨM | CHÍNH SÁCH | THANH TOÁN | FOLLOW SOCIAL (Facebook, YouTube, Instagram) | chứng nhận Bộ Công Thương; nút nổi Zalo/Messenger/điện thoại.
- **Mobile**: breakpoint chính 767px và 991px; header desktop ẩn dưới 992px (`d-none d-lg-block`); có **thanh điều hướng dính đáy** (`.header-mobile{position:fixed;bottom:0;border-radius:8px 8px 0 0}`); menu dạng panel trượt nhiều cấp; cột footer thu gọn kiểu accordion.

### Midomax (`midomax.vn`)
- **Nav** cố định cao 76px, nền trắng, viền dưới `#EFEFEF`: logo trái → Trang chủ, Khám phá, Blog, Tuyển dụng, Giới thiệu, logo Kamito (link `/kamito`) → nút "Contact Us". Mục active có 2 tam giác nhỏ trên/dưới chữ.
- **Trang chủ theo thứ tự**: hero video toàn màn hình + h1 + 2 nút ("Mua ngay", "Khám phá →") + bộ đếm slide "01 / 03" → "Thành tựu" (trích dẫn CEO + 4 số liệu đếm) → "Danh mục thể thao" (dải ảnh chạy, link sang `kamito.vn/collections/...`) → "Đội ngũ lãnh đạo" → "Đối tác nói gì" (5 sao) → "Tin tức & Sự kiện" → CTA tuyển dụng nền navy → "Liên hệ với chúng tôi".
- **Lưới**: Tailwind v4; bề rộng nội dung `--max-width-wide:75rem` (tăng lên ở màn hình lớn hơn), lề `clamp(1.5rem,5vw,6rem)`, khoảng cách section `clamp(2rem,4vw,4rem)`; nền section xen kẽ trắng / `#F4F4F6` / navy.
- **Footer** nền navy `#21317F`, chữ `white/50`: logo trắng + mô tả + MXH | Khám phá | Sản phẩm | Liên hệ; dòng dưới là link chính sách (trỏ sang `kamito.vn/pages/...`).
- **Mobile**: breakpoint Tailwind chuẩn (640/768/1024/1280/1536px); dưới 1024px nav thành nút hamburger mở lớp phủ trắng toàn màn hình, chữ menu `text-xl font-bold`.

## 4. Nền tảng và hệ thống tài khoản

| | Bằng chứng |
|---|---|
| Kamito = **Haravan** | `robots.txt`: "# we use Haravan as our ecommerce platform"; header `X-ShopId: 1000341630`; tài nguyên từ `cdn.hstatic.net`; biến `Haravan.shop`, `Haravan.theme` |
| Kamito front-end | `bootstrap-live-v4.css`, `swiper.css`, `fancybox.css`, jQuery; theme `1001416770` |
| Midomax = **Next.js** | header `X-Powered-By: Next.js`; chunk `turbopack-*.js`; ảnh qua `/_next/image` |
| Midomax CSS | Tailwind v4 (`@layer theme`, biến `--color-*`, `--spacing:.25rem`) |
| Midomax nội dung | ảnh/CMS từ `api-storge.midomax.vn/cms-midomax/...`; loại CMS **chưa kiểm chứng** |

**Tài khoản / thành viên (chỉ có ở Kamito):**
- Đăng nhập: `kamito.vn/account/login` chuyển hướng sang `kamito.vn/auth/1000341630/sign-in` — ứng dụng đăng nhập của Haravan (`checkouts.haravan.app`), render bằng JS. Có dòng "Đăng nhập bằng" (đăng nhập qua MXH) nhưng nhà cung cấp cụ thể **chưa kiểm chứng**. Có reCAPTCHA.
- **Kamito Member** (`/pages/kamito-loyalty-member`): 4 hạng Member / Đồng (2.000.000đ) / Bạc (10.000.000đ) / Vàng (30.000.000đ), chiết khấu 2% / 3% / 5%; định danh bằng **số điện thoại**; đồng bộ website + cửa hàng + fanpage. Đơn từ sàn TMĐT tích "sticker sao" qua **Zalo Mini App Kamito**.
- Quyền lợi liên quan trực tiếp tới giải đấu (nguyên văn): "Sự kiện thể thao – Suất tham gia giải đấu, buổi tập và sự kiện do Kamito tổ chức cùng cộng đồng người chơi cả nước" (hạng Bạc, Vàng). Mục cộng đồng: "Cập nhật tin giải đấu sớm nhất", link nhóm Facebook.
- Cách hệ thống Member lưu trữ/tính hạng (app Haravan hay hệ thống riêng) và có API công khai hay không: **chưa kiểm chứng** — script `kamito-member-loyalty.js` chỉ xử lý giao diện, không gọi API.
- Midomax: không tìm thấy chuỗi "login / account / register / đăng nhập" trong HTML trang chủ → không có hệ thống tài khoản.

## 5. Nội dung giải đấu / sự kiện / tài trợ / vận động viên đã có

Nguồn: `kamito.vn/sitemap_blogs_1.xml` (447 bài: `news` 359, `kamito-tuyen-dung` 48, `pickleball-team-kamito` 19, `su-kien` 13, `san-pham-moi` 5).

| Môn | Bằng chứng | Quy mô |
|---|---|---|
| **Pickleball** (trọng tâm hiện tại) | Blog "TEAM KAMITO": Lý Hoàng Nam, Alix Trương, Tống Nhật Minh, Joma Pague… (12 hồ sơ ở trang 1, còn trang 2); tin `midomax.vn/news`: Trịnh Linh Giang (vô địch PPA Tour Asia 2025) làm đại sứ thương hiệu; vợt kỷ niệm "Alpha-X Champion Series Hanoi Crown" (vô địch PPA Tour Asia – MB Hà Nội Cup); `midomax.vn/introduce`: "ra mắt Kamito Pickleball Global Team" (2026) | Tài trợ vận động viên chuyên nghiệp cấp châu Á |
| **Cầu lông** | Bài "Giải cầu lông Kamito Open III năm 2024": 08–10/11/2024 tại NTĐ Cầu Giấy, "gần 1000 vận động viên", 6 nội dung, Kamito là "nhà tài trợ kim cương" | Giải phong trào mang tên Kamito, đã qua 3 kỳ |
| **Bóng đá** | Bộ sưu tập "V.LEAGUE 26/27"; áo đấu SLNA, Bắc Ninh FC, Becamex HCM FC; "Kamito Cup 2024" (London, 15 đội, 300+ cầu thủ, kỳ thứ 6 — Kamito là đồng tài trợ) | Tài trợ trang phục CLB chuyên nghiệp |
| **Running** | "Kamito Running Day" (24/11/2024); `midomax.vn/introduce` ghi 2025 "tổ chức giải chạy Kamito Running Day quy mô lớn" | Sự kiện do Kamito tổ chức |
| **Bóng bàn** | Danh mục `/collections/bong-ban` có 11 sản phẩm (bàn, bóng K40+, giày, áo); bài "Bàn bóng bàn Kamito Premium đạt tiêu chuẩn thi đấu quốc tế, được chứng nhận bởi ITTF" (2021); 2 thành viên Team Kamito là cựu tuyển thủ bóng bàn | Có sản phẩm chuẩn thi đấu, **không thấy giải bóng bàn nào** |
| Khác | Tài trợ VBA (bóng rổ), hockey nữ, MFC (võ thuật), Mixi Cup 2024 (esports) | Tài trợ trang phục |

Hàm ý: Kamito đã có tiền lệ giải mang tên mình ("Kamito Open") quy mô ~1000 vận động viên, nhiều nội dung theo trình độ/lứa tuổi. Truyền thông hiện tại nghiêng mạnh về **pickleball**; cấu trúc tham chiếu (worldtabletennis.com) lại là bóng bàn → môn mục tiêu cần được xác nhận. Hợp lý nhất là thiết kế **đa môn, cấu hình được** (danh sách môn, nội dung thi đấu, hạng trình độ không cố định trong code).

## 6. Quan hệ hai thương hiệu và khác biệt thị giác

- Midomax là công ty mẹ/đơn vị vận hành; Kamito là thương hiệu sản phẩm. Trích: "Dưới tâm huyết của CEO Chu Cẩm Linh, Midomax đã tạo nên Kamito bằng việc kết hợp công nghệ Nhật Bản cùng sự am hiểu bản địa" (`midomax.vn`); "KAMITO là thương hiệu thể thao Việt Nam được phân phối độc quyền bởi MIDOMAX" (`midomax.vn/kamito`).
- Hai site dùng chung hotline, email (`info@midomax.vn`), ĐKKD; footer Midomax trỏ chính sách sang `kamito.vn`; menu Midomax có logo Kamito; danh mục thể thao trên Midomax link thẳng sang `kamito.vn/collections/...`.
- Sự kiện được ký tên cả hai: "Công ty Midomax tổ chức sự kiện 'The Pickleball Princess'… thương hiệu Kamito".

| Khía cạnh | Midomax | Kamito |
|---|---|---|
| Cảm giác | Doanh nghiệp, tin cậy, điềm tĩnh | Thể thao, mạnh, bán hàng |
| Màu nền chủ đạo | Trắng + navy | Trắng/xám rất nhạt + đen |
| Màu nhấn | Đỏ dùng tiết kiệm (nút) | Đỏ dùng nhiều (logo, giá, hover, thanh thông báo) |
| Chữ | Oswald hẹp, cao + Be Vietnam Pro | Archivo rộng, in hoa nhiều |
| Hình khối | Bo tròn lớn, bóng mềm, nút vát góc | Góc gần vuông, viền mảnh, phẳng |
| Mật độ | Thoáng, section cao | Dày, nhiều băng chuyền sản phẩm |

## 7. Đề xuất bộ design token khởi đầu

Lưu ý chung: mọi giá trị dưới đây là **mặc định đề xuất**, nên khai báo thành biến theme (CSS custom properties / file cấu hình theme) để đổi được mà không sửa component; không chôn hex trong component.

### Phương án A — "Kamito-led" (khuyến nghị cho site giải đấu mang tên Kamito)

| Token | Giá trị | Căn cứ |
|---|---|---|
| `color.primary` | `#E30925` | `--kml-red` (bản mới nhất) |
| `color.primary-strong` | `#A31115` | `--shop-color-main` (hover) |
| `color.secondary` | `#0F285D` | `--kml-navy` |
| `color.secondary-deep` | `#0F2452` | `--kml-navy2` |
| `color.accent` | `#E3F42A` | `--kml-lime` — chỉ dùng cho điểm nhấn nhỏ (trận đang diễn ra, tỉ số trực tiếp), luôn đặt trên nền navy/đen |
| `color.ink` | `#0A0A0A` | `--shop-color-text` |
| `color.text-muted` | `#404040`, `#737373` | `--text-dark-v2/v3` |
| `color.border` | `#E5E5E5` | `--shop-color-border` |
| `color.surface` | `#FFFFFF`, `#FAFAFA`, `#F5F5F5` | `--background-light-*` |
| `font.family` | Archivo (300–800), fallback `system-ui` | `--font-family`; Google Fonts có subset tiếng Việt |
| `font.heading` | 700–800, in hoa, `letter-spacing:-0.02em` cho cỡ lớn | `.kml-h2`, heading site |
| `font.body` | 15–16px / 1.5, weight 400 | body site 14px — đề xuất nâng lên 15–16px cho bảng lịch/kết quả dễ đọc |
| `radius` | 4px (nút, tag), 8px (thẻ, ô nhập), 20px (thẻ nổi bật/hero), 999px (pill trạng thái) | `.btn`, `.product-block`, `--kml-radius` |
| `shadow` | gần như phẳng; viền 1px `#E5E5E5`; bóng chỉ cho lớp nổi | `.product-block`, `.header-mobile` |
| `space.section` | 64px desktop / 40px mobile | `.section` |
| `layout.container` | tối đa 1520px, lề 40px (mobile 16–20px) | `.container-fluid`, `--kml-gutter` |
| Nút chính | nền đen `#0A0A0A` → hover đỏ; hoặc nền đỏ cho CTA đăng ký | `.btn`, `.kml-btn` |

Cảm giác: tương phản cao, phẳng, in hoa, đỏ–navy cắt chéo (mô-típ vạch sân trong banner Member).

### Phương án B — "Midomax-led" (nếu site là nền tảng giải đấu cấp công ty, nhiều thương hiệu)

| Token | Giá trị | Căn cứ |
|---|---|---|
| `color.primary` | `#2E3D94` | `--color-foreground`, màu logo |
| `color.primary-deep` | `#21317F`, `#0D2580` | `--color-surface-dark`, `bg-[#0D2580]` |
| `color.accent` | `#E31E24`, hover `#C8181E` | `--color-accent`, `--color-accent-hover` |
| `color.surface` | `#FFFFFF`, `#F4F4F6` | `--color-background`, `--color-surface` |
| `color.border` | `#D1D5DB`, `#E5E7EB` | `--color-border`, `--color-border-light` |
| `color.text-muted` | `#6B7280`, `#4B5563` | `--color-muted`, `--color-muted-foreground` |
| `color.status` | success `#16A34A`, warning `#D97706`, error `#E31E24` | `--color-success/warning/error` |
| `font.display` | Oswald 500–700 (tiêu đề, số liệu, tỉ số) | `--font-sans` |
| `font.body` | Be Vietnam Pro 400–700 | `.midomax-design-font` |
| `radius` | 12px (nút), 18px, 24px (thẻ), `full` (pill) | `--radius-md/lg/xl` |
| `shadow` | `0 1px 3px #0000000f` / `0 4px 12px #00000014` / `0 8px 30px #0000001f` | `--shadow-sm/md/lg` |
| `space.section` | `clamp(2rem,4vw,4rem)` | `--spacing-section` |
| `layout.container` | tối đa 75rem, lề `clamp(1.5rem,5vw,6rem)` | `--max-width-wide`, `--spacing-container` |
| Chi tiết riêng | nút vát góc 10px (`clip-path`) cho CTA phụ | nút "Contact Us" |

Cảm giác: navy chủ đạo, thoáng, bo tròn mềm, đỏ chỉ ở hành động chính.

### So sánh nhanh

| | A – Kamito-led | B – Midomax-led |
|---|---|---|
| Được | Khớp thương hiệu người chơi nhận ra; liền mạch với trang Member và cửa hàng; năng lượng thể thao | Trung tính, dễ mở rộng cho nhiều thương hiệu/nhà tài trợ; bảng dữ liệu dày dễ đọc trên nền navy–trắng |
| Mất | Đỏ dùng nhiều dễ lấn màu nhà tài trợ/áo đấu; cần kiểm soát tương phản vàng chanh | Ít "chất Kamito"; Oswald hẹp kém hợp với bảng dữ liệu chữ nhỏ |
| Hợp khi | Giải mang tên Kamito (kiểu "Kamito Open") | Nền tảng giải đấu chung của công ty |

Gợi ý dung hoà: lấy A làm nền, dùng navy `#0F285D` cho các vùng dữ liệu dày (lịch thi đấu, bảng đấu, bảng xếp hạng) và đỏ cho hành động/điểm nhấn — đúng với bộ màu Kamito Member, đồng thời gần với cặp navy/đỏ của Midomax.

### Cần đối chiếu với brand guideline chính thức
1. Mã đỏ chuẩn của Kamito: web đang có 4 giá trị (`#EC1E24` logo, `#E30925` Member, `#EC2228`, `#A31115`).
2. Navy `#0F285D` và vàng chanh `#E3F42A` là màu thương hiệu chính thức hay chỉ của chiến dịch Member.
3. Font chính thức (Archivo?) và font cho wordmark "KAMITO MEMBER"; quyền sử dụng `KmlMyriad`.
4. Logo vector (SVG/AI), bản âm bản/đơn sắc, vùng an toàn, kích thước tối thiểu, quy tắc đặt cạnh logo Midomax và logo nhà tài trợ.
5. Tagline dùng cho giải đấu: "ENJOY THE GAME", "MOVE. GROW. TOGETHER." hay câu khác.
6. Kiểm tra tương phản WCAG cho các cặp màu sau khi chốt (đặc biệt chữ trắng trên `#E30925`, chữ trên `#E3F42A`).

## 8. Điểm bất nhất quan sát được (nên biết khi dùng làm tham chiếu)
- Năm thành lập: trang chủ Midomax ghi "thành lập từ năm 2010", trong khi ĐKKD ghi ngày cấp 12/05/2015; hero còn hiện "EST. 2026".
- Tên hạng thành viên: bảng hạng dùng Member/Đồng/Bạc/Vàng, phần đặc quyền lại ghi "PRO • Elite".
- Footer Midomax: "© 2026 2026"; nhãn link "Hình thức thanh toán" trỏ tới trang chính sách bảo mật.
- Số liệu "Thành tựu" trên trang chủ Midomax hiển thị "0 +" trong HTML (bộ đếm chạy bằng JS) → giá trị thật **chưa kiểm chứng**.
- `kamito.vn/pages/about-us`: số điện thoại cửa hàng là `0987654321` (dữ liệu mẫu).

## Câu hỏi chưa giải đáp
1. Website giải đấu phục vụ môn nào trước (pickleball, cầu lông, bóng bàn hay đa môn)? Quy mô kỳ vọng mỗi giải (số vận động viên, số nội dung)?
2. Site đứng dưới tên Kamito (phương án A) hay là nền tảng chung của Midomax (phương án B)? Tên miền dự kiến?
3. Có brand guideline chính thức và file logo vector cho Kamito, Kamito Member, Midomax không?
4. Có cần liên kết tài khoản với Kamito Member (đăng nhập chung, xác minh hạng để cấp suất tham gia giải) không? Nếu có: hệ thống Member chạy trên app Haravan nào và có API không?
5. Vận động viên đăng ký giải bằng số điện thoại (trùng khoá định danh của Member) hay bằng tài khoản riêng?
6. Có cần hỗ trợ tiếng Anh không (Team Kamito có vận động viên quốc tế; site hiện chỉ có tiếng Việt)?
7. Logo/màu của nhà tài trợ và CLB sẽ xuất hiện nhiều tới mức nào (ảnh hưởng lựa chọn nền trung tính hay nền đỏ)?
