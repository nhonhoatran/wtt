# Spike E - Revalidate theo tag trên Next 16.4.3 (chạy cục bộ)

Ngày 2026-11-12. Spike vứt đi tại `spikes/next-revalidate/` (ngoài workspace, `pnpm install --ignore-workspace`). Chạy bản production (`next build` + standalone `node server.js`, giống `docker/client.Dockerfile`). Không commit gì.

## Phiên bản

- next 16.4.3 (MIT, phát hành 2026-10-23; hiện có 16.4.5), react/react-dom 19.3.1, Node 24.15.0, pnpm 11.3.0, Windows 11.
- Không thêm thư viện nào khác. Docs đọc từ gói cài sẵn: `node_modules/next/dist/docs/01-app/03-api-reference/...` (`revalidateTag.md`, `updateTag.md`, `proxy.md`, `sitemap.md`).

## Kết luận API (từ docs đã cài + đo thật)

| Dạng gọi (trong Route Handler) | Ngữ nghĩa theo docs | Kết quả đo | Verdict |
|---|---|---|---|
| `revalidateTag(tag, 'max')` | stale-while-revalidate (khuyến nghị) | request đầu vẫn nhận HTML CŨ, request 2 mới mới (lặp 2 lần, cùng kết quả) | FAIL cho yêu cầu "request đầu phải mới" |
| `revalidateTag(tag, { expire: 0 })` | hết hạn ngay, request kế tiếp chặn chờ dữ liệu mới | request đầu HTML mới (2/2 lần) | PASS (dạng chọn) |
| `revalidateTag(tag)` (1 tham số) | deprecated, = `{expire:0}` | request đầu mới (2/2) | PASS nhưng deprecated, "có thể bị gỡ"; không dùng |
| `updateTag(tag)` | chỉ Server Action | trong route handler ném lỗi: `updateTag can only be called from within a Server Action` | N/A cho webhook/route nội bộ |
| `revalidatePath('/match/{id}')` | vô hiệu theo path | request đầu mới (2/2) | PASS (dự phòng, không cần) |

Chưa thử: `'use cache'` + `cacheTag` / `cacheComponents` (bật cờ này đổi mô hình render cả app, ngoài phạm vi spike; docs ghi `revalidateTag` áp dụng giống nhau). Chưa test `updateTag` trong Server Action thật (không dùng cho luồng này).

### Số đo thô (run 1, `node measure.mjs max,expire0,legacy,path`; ms)

```
max     warm 1-0/1  revalidate 3.6ms  first=1-0/1 (STALE) second=2-0/2 third=2-0/2  PASS_first_fresh=false
expire0 warm 1-0/1  revalidate 2.2ms  first=2-0/2 (7.5ms) second 2-0/2             PASS_first_fresh=true  revalidate->first fresh 15.5ms
legacy  warm 1-0/1  revalidate 2.6ms  first=2-0/2 (5.0ms)                           PASS_first_fresh=true  14.9-15.4ms
path    warm 1-0/1  revalidate 2.2ms  first=2-0/2 (5.2ms)                           PASS_first_fresh=true  16.5ms
```
Run 2: max stale lần đầu lại; expire0 14.3ms, legacy 14.1ms, path 11.0ms, đều PASS. Độ trễ gồm cả lời gọi revalidate (~2-3ms) + request đầu chặn chờ upstream cục bộ (~5-9ms). Upstream thật sẽ cộng thêm thời gian gọi API. Cách đo này chỉ là 1 process, 1 instance.

Ghi chú: trang `/match/[id]` hiển thị `ƒ Dynamic` (render mỗi request); phần được cache là Data Cache của `fetch(..., { cache: 'force-cache', next: { tags } })`. Muốn cache cả HTML thì phải bàn riêng, spike này chưa đo.

## Restart (quan trọng)

Cache fetch lưu trên đĩa tại `.next/cache/fetch-cache`. Trạng thái "tag đã hết hạn" KHÔNG sống sót qua restart tiến trình.

| Kịch bản | Không xóa cache | Xóa `.next/cache` khi khởi động |
|---|---|---|
| A: warm v1, đổi v2, `expire0`, restart TRƯỚC khi có ai GET, rồi GET | **STALE v1 (FAIL)** | v2 (PASS) |
| B: warm v1, đổi v2 khi server TẮT (mất lệnh revalidate), start, GET | **STALE v1 (FAIL)**, sau revalidate mới v2 | v2 (PASS) |
| C: warm, restart, dữ liệu không đổi | phục vụ từ đĩa (upstream không bị gọi lại) | gọi lại upstream 1 lần |
| D: xóa tay `fetch-cache` rồi start | v2 (PASS) | - |

Lệnh: `sh restart-test.sh` và `WIPE=1 sh restart-test.sh`.

`docker/client.Dockerfile`: không có VOLUME cho `.next/cache`, CMD là `node apps/client/server.js`. Tạo lại container (redeploy Dokploy) = cache sạch, an toàn. Nhưng container tự khởi động lại bởi restart policy (crash, `docker restart`) giữ nguyên lớp ghi, nên cache cũ còn và kịch bản A/B xảy ra. Đề xuất: đổi CMD/entrypoint thành xóa `apps/client/.next/cache` trước khi chạy server (chi phí: cache nguội sau restart, chấp nhận được). Không mount volume cho `.next/cache`. Chưa kiểm trên Docker thật (chờ staging).

## Chiến lược tag: chọn tag dựng từ slug/mã trong URL

`match-{id}` lấy thẳng từ `params` của route, khai báo trước mọi fetch, không cần request nhẹ trước (tránh thêm 1 round-trip và 1 điểm lỗi). Điều kiện: URL công khai phải chứa định danh ổn định (id hoặc mã trận) để backend biết tag cần vô hiệu cùng khóa đó. Nếu URL dùng slug đổi được thì dùng mã bất biến trong URL, hoặc tag gộp theo giải (`tournament-{code}`) song song. Chuỗi tag tối đa 256 ký tự, phân biệt hoa thường.

## Chặn `/api/revalidate` trên domain công khai (cục bộ)

Hai lớp đều chạy đúng (Host giả bằng `curl -H "Host: ..."`), lệnh `sh host-block-test.sh`:

| Trường hợp | Route kiểm Host+secret (`CHECK_HOST=1`) | `proxy.js` chặn theo Host (`PROXY_BLOCK=1`) |
|---|---|---|
| Host nội bộ + secret đúng | 200 | 200 |
| Host công khai + secret đúng | 404 | 404 |
| Host công khai, không secret | 403 | 404 |
| Host nội bộ, secret sai | 403 | 403 |
| Host công khai + `X-Forwarded-Host` nội bộ giả | 404 | 404 |

Khuyến nghị: dùng cả secret (so sánh hằng thời gian ở bản thật) + kiểm Host nội bộ (danh sách cấu hình qua env, không fix cứng) + chặn tại Traefik. Dùng header `Host` thật, không tin `X-Forwarded-Host`.

Rule Traefik đề xuất, CHƯA KIỂM CHỨNG, chờ staging Dokploy: không gắn router công khai nào khớp `PathPrefix(`/api/revalidate`)`; hoặc router công khai của client thêm điều kiện loại trừ, ví dụ `Host(`<domain>`) && !PathPrefix(`/api/revalidate`)`, hoặc middleware `replacepathregex`/trả 404 cho path này. Backend gọi nội bộ qua tên service trong mạng Docker (`http://client:3000/api/revalidate`) nên Host khác domain công khai. Cần kiểm trên staging: Dokploy cho khai rule thế nào (labels/UI), Traefik có `passHostHeader` mặc định (giữ Host công khai), và request từ trình duyệt tới path đó nhận 404.

## `middleware.ts` vs `proxy.ts` (đã build thử)

- 16.4.3: tên `proxy.ts` (export `proxy`) là chuẩn, build hiển thị `ƒ Proxy (Middleware)`.
- `middleware.*` vẫn chạy nhưng cảnh báo `The "middleware" file convention is deprecated. Please use "proxy" instead.`.
- Có cả hai file: build lỗi `Both middleware file ... and proxy file ... are detected`.
- `proxy` mặc định Node.js runtime (docs v16.0.0). Docs ghi `revalidateTag` KHÔNG gọi được trong Proxy.
- Quyết định: dùng `proxy.ts`.

## Sitemap sinh lúc chạy

`app/sitemap.(js|ts)` với `export const dynamic = 'force-dynamic'`, fetch danh sách từ API kèm `next: { revalidate: <TTL>, tags: ['sitemap'] }`. Build hiển thị `ƒ /sitemap.xml` (không prerender). Đã đo: thêm trận mới ở upstream không rebuild; trong TTL vẫn cũ, sau `revalidateTag('sitemap', { expire: 0 })` hiện URL mới ngay request đầu. Không có `force-dynamic` thì sitemap bị cache mặc định (docs `sitemap.md`).

## Quyết định

Pass cả 3 tiêu chí với điều kiện:
1. Dùng `revalidateTag(tag, { expire: 0 })` trong route handler. KHÔNG dùng `'max'` (stale ở request đầu), KHÔNG dùng dạng 1 tham số (deprecated).
2. Xóa `.next/cache` mỗi lần khởi động tiến trình client (nếu không, restart sau revalidate có thể trả HTML cũ - kịch bản A/B).
3. Chặn route bằng 3 lớp (Traefik, `proxy.ts`/Host nội bộ, secret). Lớp Traefik chờ staging.
4. Dự phòng vẫn nên giữ: `next.revalidate: MATCHDAY_REVALIDATE_SECONDS` trên fetch của trang ngày thi đấu làm trần độ cũ, phòng khi lệnh revalidate bị mất (server tắt, backend lỗi mạng). Revalidate theo tag là tăng tốc.

## Ghi chú cho phase

- Phase 08 (trang công khai): tag `match-{id}` dựng từ params URL; fetch `cache: 'force-cache'` + tags + TTL trần; sitemap `force-dynamic`.
- Phase 07 (backend phát lệnh): gọi `POST http://client:3000/api/revalidate` với header secret và body `{ tags: [...] }`; cố gắng gửi sau khi commit giao dịch; retry/ghi log khi lỗi; xử lý theo lô nhiều tag (đã nhận mảng, kiểm độ dài ≤256).
- Phase 01 (Dockerfile client, deploy): sửa CMD/entrypoint client xóa `.next/cache`; rule Traefik chặn path; env `REVALIDATE_SECRET`, `INTERNAL_HOSTS` (hiện mặc định trong spike chỉ là ví dụ).
- Nếu phase 08 bật `cacheComponents`/`'use cache'` thì chạy lại spike này với dạng đó (chưa kiểm).

## Cách chạy lại

```
cd spikes/next-revalidate
pnpm install --ignore-workspace
node upstream.mjs &            # cổng 4100
pnpm exec next build
sh run-standalone.sh [CHECK_HOST=1|PROXY_BLOCK=1]   # cổng 4101, PID trong .pid-next
node measure.mjs               # PASS_first_fresh từng dạng
sh restart-test.sh             # WIPE=1 để thử dạng xóa cache
sh host-block-test.sh
# tắt: kill $(cat .pid-next) / PID của upstream
```
Đã tắt hết tiến trình đã khởi động (netstat xác nhận 4100/4101 không còn LISTEN). Thư mục spike giữ lại; `.next/` và `node_modules/` nằm trong .gitignore.

## Chưa giải quyết

- Rule Traefik/Dokploy thực tế và hành vi `passHostHeader` (chờ staging).
- Hành vi cache trên Docker thật với restart policy (chưa dựng container).
- `'use cache'`/`cacheTag`, `updateTag` trong Server Action: chưa test.
- Trang đa instance (nhiều replica client): cache cục bộ mỗi instance, lệnh revalidate chỉ trúng 1 instance. Chưa test; hiện chạy 1 replica thì ổn.

**Status:** DONE_WITH_CONCERNS
**Summary:** `revalidateTag(tag, { expire: 0 })` cho HTML mới ngay request đầu (14-16ms); `'max'` thì stale ở request đầu. Chặn route theo Host+secret và `proxy.ts` đều hoạt động cục bộ.
**Concerns/Blockers:** Restart tiến trình sau revalidate trả bản cũ nếu không xóa `.next/cache` (phải sửa entrypoint client). Rule Traefik/Dokploy và Docker restart chưa kiểm, chờ staging. Single-instance chưa kiểm multi-replica.
