# Báo cáo nghiên cứu: admin UI kit và hạ tầng queue / realtime / storage / deploy

Ngày: 2026-11-11 (Asia/Saigon). Phạm vi: admin UI, BullMQ vs Kafka, realtime live score, MinIO, Dokploy, monorepo, ORM, auth.

Ký hiệu: "[npm]" = `https://registry.npmjs.org/<pkg>/latest` (phiên bản, giấy phép, ngày publish). "[gh]" = `https://api.github.com/repos/<repo>` và `/releases/latest`. "chưa kiểm chứng" = không có nguồn đã mở trong lượt nghiên cứu này.

## 0. Tóm tắt xếp hạng

| Hạng mục | Xếp hạng | Lý do ngắn |
|---|---|---|
| Admin UI | 1) Refine + Ant Design; 2) Ant Design ProComponents + TanStack Query (không framework) | MIT, data layer REST, antd có locale vi_VN; RBAC của Refine chỉ ở client |
| Grid admin | antd Table/ProTable mặc định; TanStack Table khi cần tùy biến; AG Grid Community chỉ khi cần kiểu bảng tính | Tránh Enterprise/Pro |
| Queue | BullMQ (không Kafka) | Đủ cho toàn bộ job đã liệt kê |
| Realtime | 1) Polling JSON có cache ngắn hạn; 2) SSE; 3) Socket.IO + Redis adapter | Scale vừa phải, luồng một chiều |
| Storage | Giữ MinIO hiện có qua S3 API, không dùng MinIO SDK; lên kế hoạch thay thế | MinIO đã archive |
| Deploy | Dokploy Docker Compose, domain qua UI | Tài liệu xác nhận |
| Monorepo | pnpm workspaces + Turborepo | Đơn giản hơn Nx cho 4 app |
| ORM | 1) Prisma 7.10.x; 2) Drizzle; 3) TypeORM 1.x | Prisma 8 còn RC |
| Auth | 1) Better Auth (có admin plugin); 2) Passport/JWT tự viết; 3) Keycloak/Logto/Zitadel | Quy mô admin nhỏ |

## A. Admin UI foundation

### A.1 Các lựa chọn

| Lựa chọn | Phiên bản (npm) | Giấy phép | Nguồn | Ghi chú kiểm chứng |
|---|---|---|---|---|
| Refine core | @refinedev/core 5.0.12, publish 2026-04-02 | MIT | [npm](https://registry.npmjs.org/@refinedev/core/latest), [gh](https://api.github.com/repos/refinedev/refine) | Peer React ^18 hoặc ^19; cần @tanstack/react-query ^5.81.5 |
| Refine + antd | @refinedev/antd 6.0.3 | MIT | [npm](https://registry.npmjs.org/@refinedev/antd/latest) | Peer `antd ^5.23.0`, không khai báo antd 6. Rủi ro khi dùng antd 6.7.0 |
| Refine + MUI | @refinedev/mui 8.0.2 | MIT | [npm](https://registry.npmjs.org/@refinedev/mui/latest) | chưa kiểm chứng peer range |
| Ant Design | antd 6.7.0, publish 2026-11-04 | MIT | [npm](https://registry.npmjs.org/antd/latest), [gh](https://api.github.com/repos/ant-design/ant-design) | Peer React >=18. Locale `vi_VN` có trong [doc i18n](https://ant.design/docs/react/i18n) |
| ProComponents | @ant-design/pro-components 2.8.10 | MIT | [npm](https://registry.npmjs.org/@ant-design/pro-components/latest) | Peer `antd ^4.24.15 \|\| ^5.11.2`, không khai báo antd 6 |
| react-admin | 5.15.6, publish 2026-11-07 | MIT (core) | [npm](https://registry.npmjs.org/react-admin/latest), [gh](https://api.github.com/repos/marmelab/react-admin), [trang chính](https://marmelab.com/react-admin/) | Peer React ^18 hoặc ^19. ra-ui-materialui kéo theo MUI, react-router, TanStack Query |
| shadcn/ui CLI | 4.23.0 | MIT | [npm](https://registry.npmjs.org/shadcn/latest), [gh](https://api.github.com/repos/shadcn-ui/ui) | Không phải admin framework: phải tự lắp ráp layout, bảng, form, auth |
| TanStack Table | @tanstack/react-table 9.3.1 | MIT | [npm](https://registry.npmjs.org/@tanstack/react-table/latest) | Headless, peer React >=18 |
| TanStack Query | 5.107.1 | MIT | [npm](https://registry.npmjs.org/@tanstack/react-query/latest) | |
| TanStack Router | 1.170.46 | MIT | [npm](https://registry.npmjs.org/@tanstack/react-router/latest) | |
| CoreUI / Tabler | chưa kiểm chứng | chưa kiểm chứng | chưa kiểm chứng | Không mở được nguồn trong lượt này, không xếp hạng |

### A.2 Enterprise / trả phí

| Sản phẩm | Bị khóa sau gói trả phí | Giá / mô hình | Nguồn |
|---|---|---|---|
| react-admin Enterprise | Fine-grained permissions (RBAC), editable datagrid, nested forms, many-to-many, soft delete, versioning, realtime, calendar, tree, JSON Schema form, site search, audit log, scheduler | Từ 145 EUR/tháng theo trang marmelab. Các trang giá bên thứ ba ghi con số khác nhau, không dùng | [marmelab](https://marmelab.com/react-admin/), [EE](https://react-admin-ee.marmelab.com/) |
| AG Grid Enterprise | Set/Multi/Advanced filter, Excel/PDF export, row grouping, pivot, tree data, master detail, server-side row model, column menu, status bar | Theo developer. Không công khai giá trên trang, phải cấu hình trên web. Trên 10 dev hoặc app khách hàng phải liên hệ sales | [AG Grid license](https://www.ag-grid.com/license-pricing/) |
| MUI X Pro | Multi-sort, multi-filter, column pinning, resizing | Thương mại, theo developer. Không có giá trên trang | [MUI X licensing](https://mui.com/x/introduction/licensing/) |
| MUI X Premium | Row grouping, Excel export (kế thừa Pro) | Như trên | [MUI X licensing](https://mui.com/x/introduction/licensing/) |
| Refine pricing | Trang giá là gói nền tảng AI (Starter $0.99/tháng, Pro $20/tháng, Enterprise liên hệ), không phải giá framework MIT. Không rõ ngày hiệu lực | Gói tín dụng | [refine pricing](https://refine.dev/pricing/) |

Lưu ý: MUI X không có key sẽ hiện watermark ở cả dev lẫn production; đặt `NODE_ENV=production` và key để ẩn ([MUI X licensing](https://mui.com/x/introduction/licensing/)).

### A.3 So sánh theo tiêu chí

| Tiêu chí | Refine + antd | ProComponents + antd | react-admin 5 | shadcn + TanStack |
|---|---|---|---|---|
| Khớp REST NestJS | Data provider REST, hook chuẩn | Tự viết lớp gọi API qua TanStack Query | Data provider REST, chuẩn | Tự viết toàn bộ |
| Phân trang/lọc/sắp xếp phía server | Có qua data hook; chi tiết chưa kiểm chứng | ProTable có chế độ request; chưa kiểm chứng | Có | Tự viết |
| Form + validation | antd Form | ProForm | Form react-hook-form | Tự ghép |
| RBAC | accessControlProvider MIT, chỉ kiểm soát UI; doc ghi "won't enforce access control by itself" | Tự viết | RBAC chi tiết là Enterprise | Tự viết |
| i18n tiếng Việt | antd `vi_VN` đã kiểm chứng; i18n của Refine chưa kiểm chứng | antd `vi_VN` | chưa kiểm chứng | Tự làm |
| Upload presigned S3 | Tự viết bằng hook/Upload của antd; chưa kiểm chứng API cụ thể | Như trên | Tự viết | Tự viết |
| Theming | antd theme tokens; chưa kiểm chứng chi tiết | Như antd | MUI theme | Tailwind/CSS variables |
| Học, lock-in | Trung bình; hook gắn Refine, UI gắn antd | Thấp lock-in, nhiều code keo | Trung bình-cao (cả framework) | Thấp lock-in, tốn công UI nhất |
| Phiên bản React | React 18/19 | React 18/19 (ProComponents peer rộng) | React 18/19 | React 18/19 |
| Bundle size, chất lượng docs | chưa đo; docs chính thức có | chưa đo; docs có | chưa đo; docs tốt | chưa đo |

### A.4 Xếp hạng và đánh đổi

1. **Refine 5 + @refinedev/antd.** Ưu: MIT, data layer và menu/resource sẵn, antd có `vi_VN`. Đánh đổi chính: RBAC chỉ ở client, backend NestJS phải tự enforce bằng guard. Rủi ro: peer `antd ^5.23` nên có thể phải giữ antd 5.x thay vì 6.7.0, cần thử trước khi chốt.
2. **Ant Design ProComponents + antd + TanStack Query/Router.** Ưu: ít lock-in, kiểm soát hoàn toàn data layer. Đánh đổi chính: nhiều code keo (menu, auth, resource, phân trang) hơn, trái mục tiêu "tốn ít thời gian làm UI". Peer ProComponents chưa khai báo antd 6.
3. **react-admin 5.** Core MIT, mạnh về CRUD. Đánh đổi chính: RBAC chi tiết và nhiều tính năng hữu ích nằm trong Enterprise (từ 145 EUR/tháng); kéo theo MUI, nếu brand không dùng MUI sẽ phải theme lại.
4. **shadcn/ui + TanStack.** Tùy biến cao nhất nhưng tự làm nhiều UI, trái yêu cầu tối thiểu công sức.

Grid: dùng antd Table/ProTable (server-side) cho admin; TanStack Table nếu cần headless tự vẽ; AG Grid Community (MIT, dùng production được) chỉ khi cần kiểu bảng tính; tránh AG Enterprise và MUI Pro/Premium vì bị khóa filter/export/grouping server-side.

## B. Queue / messaging

### B.1 BullMQ
- bullmq 6.7.4, publish và GitHub release 2026-11-11, MIT, repo push 2026-11-11, 9.588 sao. Nguồn: [npm](https://registry.npmjs.org/bullmq/latest), [gh](https://api.github.com/repos/taskforcesh/bullmq/releases/latest).
- @nestjs/bullmq 12.0.1, MIT, publish 2026-11-06. Peer bullmq ^3 đến ^6, Nest ^10 đến ^12. Nguồn: [npm](https://registry.npmjs.org/@nestjs/bullmq/latest), [gh](https://api.github.com/repos/nestjs/bull).
- Redis: bắt buộc `maxmemory-policy noeviction`, "the only setting that guarantees the correct behavior of the queues"; khuyến nghị bật AOF, mức fsync 1 giây. Nguồn: [BullMQ going to production](https://docs.bullmq.io/guide/going-to-production). Không nêu phiên bản Redis tối thiểu và không nói về Redis Cluster trong trang đó (chưa kiểm chứng).
- Flows: FlowProducer tạo cha–con nguyên tử; cha chờ đến khi mọi con xong; lồng nhiều tầng; `getChildrenValues()`. Caveat: không dùng deduplication trên node flow; `jobId` không có dấu hai chấm. Nguồn: [BullMQ flows](https://docs.bullmq.io/guide/flows).
- Delayed, repeatable, job schedulers, rate limit: trang tài liệu có nhưng chưa mở trong lượt này (chưa kiểm chứng chi tiết).
- Dashboard: @bull-board/api và @bull-board/express 9.13.0, MIT, repo push 2026-11-10 ([npm](https://registry.npmjs.org/@bull-board/express/latest), [gh](https://api.github.com/repos/felixmosh/bull-board)). @bull-board/nestjs cũng có bản 9.13.0 MIT.

Rủi ro BullMQ: maintain tích cực. Rủi ro chính là Redis dùng chung với cache có eviction (allkeys-lru) sẽ làm hỏng queue. Redis `maxmemory-policy` là cấu hình cấp instance (kiến thức Redis, chưa kiểm chứng bằng nguồn trong báo cáo), nên phải tách Redis riêng hoặc xác nhận cấu hình hiện tại trên server.

### B.2 Kafka
- kafkajs 2.2.4 là publish gần nhất 2023-02-27 (đã hơn 3 năm không cập nhật). Đây là rủi ro bỏ rơi. Nguồn: [npm](https://registry.npmjs.org/kafkajs/latest). Nếu dùng Kafka, nên xem client khác (chưa kiểm chứng).
- Apache Kafka: trang upgrade 4.3 ghi "Apache Kafka 4.3 only supports KRaft mode - ZooKeeper mode has been removed" ([Kafka 4.3 upgrade](https://kafka.apache.org/43/getting-started/upgrade/)). Trang chủ downloads không đọc được nội dung, nên phiên bản mới nhất chính xác chưa kiểm chứng.
- Footprint (Confluent docs): heap JVM tối thiểu 1 GB khuyến nghị; RAM tối thiểu 4 GB cho KRaft server; combined mode (broker + controller) "is for local experimentation only and is not supported"; khuyến nghị ít nhất 3 controller cho production. Nguồn: [Confluent KRaft config](https://docs.confluent.io/platform/current/kafka-metadata/config-kraft.html). Con số footprint docker-compose một node (khoảng 4 GB container) là suy luận, chưa kiểm chứng.
- Tích hợp NestJS (@nestjs/microservices Kafka transport): chưa kiểm chứng.

### B.3 Khuyến nghị và ánh xạ job

| Job | Cơ chế đơn giản nhất đủ dùng |
|---|---|
| Xử lý ảnh sau upload (resize, webp) | BullMQ queue `media`, worker dùng sharp |
| Gửi email / Zalo / thông báo | BullMQ queue `notify`, retry + backoff |
| Tính lại ranking sau khi nhập kết quả | BullMQ job, hoặc gọi đồng bộ trong transaction nếu đủ nhanh |
| Lịch công bố (scheduled publishing) | BullMQ delayed job hoặc job scheduler (chưa kiểm chứng chi tiết) |
| Fan-out live score | Pub/Sub Redis + realtime (xem C), không qua queue |
| Import/export | BullMQ job, lưu file trên MinIO |

Kết luận: chỉ BullMQ. Không chạy Kafka. Kafka chỉ đáng cân nhắc khi có nhiều hệ thống độc lập cùng tiêu thụ một luồng sự kiện, cần replay nhiều ngày, hoặc lưu lượng sự kiện bền vững cao; ngưỡng số cụ thể chưa kiểm chứng.

## C. Realtime live score

| Phương án | Ưu | Nhược | Nguồn |
|---|---|---|---|
| Polling JSON + cache ngắn (5–15 s) | Đơn giản nhất, cache được, không cần state | Trễ tối đa bằng chu kỳ poll | [Next.js ISR](https://nextjs.org/docs/app/guides/incremental-static-regeneration) |
| SSE (NestJS `@Sse`) | Một chiều, EventSource tự reconnect, không cần sticky | Cần Redis pub/sub để fan-out giữa nhiều instance; buffering qua proxy cần kiểm tra (chưa kiểm chứng trên Traefik) | [NestJS SSE](https://docs.nestjs.com/techniques/server-sent-events) |
| Socket.IO + @socket.io/redis-adapter | Rooms, hai chiều, adapter Redis | Phải sticky session; Redis adapter không có connection state recovery; thêm phức tạp | [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/), [npm adapter 8.3.0 MIT](https://registry.npmjs.org/@socket.io/redis-adapter/latest), [npm socket.io 4.8.4](https://registry.npmjs.org/socket.io/latest) |
| Native WebSocket (Nest WsAdapter) | Nhẹ | Tự làm rooms, reconnect, fan-out | [NestJS gateways](https://docs.nestjs.com/websockets/gateways) |

Hạ tầng ISR cần lưu ý: khi nhiều instance, cache file mặc định là theo từng instance; on-demand revalidate chỉ xóa cache ở instance nhận lệnh. Cần custom cache handler dùng chung nếu chạy nhiều instance ([Next.js ISR caveats](https://nextjs.org/docs/app/guides/incremental-static-regeneration)).

Khuyến nghị với quy mô giả định (hàng nghìn đến vài chục nghìn khách trong sự kiện, vài admin): ưu tiên 1) polling endpoint JSON live score, cache 5–10 s ở API hoặc CDN; 2) nếu cần đẩy ngay, thêm SSE cho trang trận đấu, fan-out bằng Redis pub/sub; 3) Socket.IO chỉ khi cần tương tác hai chiều. Con số tải (ví dụ 10k client poll mỗi 10 s ≈ 1.000 req/s) là ước tính của tác giả, chưa đo.

## D. Storage và deploy

### D.1 MinIO
- Repo minio/minio đã archive ngày 2026-04-25, read-only. README ghi "THIS REPOSITORY IS NO LONGER MAINTAINED". Community chỉ phân phối source, không còn binary. Nguồn: [gh](https://api.github.com/repos/minio/minio), [README](https://github.com/minio/minio).
- Release cuối trên GitHub: RELEASE.2025-10-15T17-29-55Z (2025-10-16), có sửa lỗ hổng leo thang đặc quyền. Nguồn: [gh release](https://api.github.com/repos/minio/minio/releases/latest).
- Console web đã bị gỡ khỏi community từ commit ngày 26-02-2025; tác giả nói bản admin UI "haven't actively maintained". Nguồn: [Blocks and Files](https://blocksandfiles.com/2025/06/19/minio-removes-management-features-from-basic-community-edition-object-storage-code/).
- Thay thế được MinIO khuyến nghị: AIStor Free (license free, điều khoản chi tiết chưa kiểm chứng) và AIStor Enterprise (trả phí). Nguồn: [README MinIO](https://github.com/minio/minio). Các fork và alternative khác (Garage, SeaweedFS, Ceph RGW) chỉ thấy trong blog bên thứ ba, chưa kiểm chứng.
- minio npm 8.0.7 Apache-2.0, publish 2026-02-27. Nguồn: [npm](https://registry.npmjs.org/minio/latest).

Rủi ro: cao về bảo mật dài hạn, vì không còn patch đảm bảo. Giải pháp: giữ MinIO hiện có (cô lập mạng, pin phiên bản), và dùng `@aws-sdk/s3-request-presigner` 3.1166.0 (Apache-2.0, publish 2026-11-10) qua S3 API, không dùng MinIO SDK, để sau này đổi endpoint là xong. Nguồn: [npm](https://registry.npmjs.org/@aws-sdk/s3-request-presigner/latest).

Presigned upload: NestJS cấp URL PUT có hạn, client upload trực tiếp lên storage, client báo xong, API đưa job xử lý ảnh vào BullMQ. Pattern tài liệu AWS chưa mở trong lượt này (chưa kiểm chứng chi tiết).

Tối ưu ảnh: `next/image` tối ưu mặc định, cần `remotePatterns` cho host MinIO ([Next.js Image](https://nextjs.org/docs/app/api-reference/components/image)). Trang này không xác nhận chi tiết sharp khi tự host (chưa kiểm chứng). sharp 0.35.5 Apache-2.0 ([npm](https://registry.npmjs.org/sharp/latest)). Ảnh biến thể nên tạo bằng worker BullMQ, không xử lý trong request.

### D.2 Dokploy
- dokploy v0.31.0, release 2026-11-05, repo push 2026-11-09. GitHub báo license "NOASSERTION", chưa kiểm chứng file LICENSE. Nguồn: [gh](https://api.github.com/repos/dokploy/dokploy).
- Domain: thêm trong tab Domains, Dokploy tự chèn Traefik labels lúc deploy. Labels thủ công cần gắn `dokploy-network`, `expose` thay `ports`, mỗi service một router name riêng. Nguồn: [Dokploy domains](https://docs.dokploy.com/docs/core/docker-compose/domains).
- Env: biến đặt trong UI được ghi vào file `.env` cạnh compose, nhưng KHÔNG tự inject vào container; phải dùng `env_file` hoặc `${VAR}`. Nguồn: [Dokploy docker-compose](https://docs.dokploy.com/docs/core/docker-compose). Hai nguồn thứ cấp mâu thuẫn; tài liệu chính thức là căn cứ.
- Build: Docker Compose hỗ trợ build; Stack (Swarm) không hỗ trợ `build`, phải dùng image registry. Nguồn: cùng trang trên.
- Không có nội dung về rollback, zero-downtime trong trang compose (chưa kiểm chứng). Trang preview deployments trả 404 (chưa kiểm chứng).

Bẫy monorepo 3 app + worker: mỗi service phải gắn network thủ công nếu không bật Isolated Deployments (xác nhận trong trang domains); tránh một compose gộp cả 4 service chung một domain; env phải khai báo từng biến cho từng service.

### D.3 Monorepo
- Turborepo 2.11.10, MIT, publish 2026-10-20 ([npm](https://registry.npmjs.org/turbo/latest), [gh](https://api.github.com/repos/vercel/turborepo)).
- Nx 24.0.6, MIT, publish 2026-11-10 ([npm](https://registry.npmjs.org/nx/latest), [gh](https://api.github.com/repos/nrwl/nx)).
- Khuyến nghị: pnpm workspaces + Turborepo. Đơn giản, đủ cho 4 app. Chọn Nx chỉ khi cần generator và ràng buộc module. Lưu ý: chưa mở tài liệu hai công cụ, đánh giá dựa trên trạng thái bảo trì và độ phức tạp.
- Vite 8.3.8 MIT ([npm](https://registry.npmjs.org/vite/latest)) cho admin SPA.

### D.4 ORM
- Prisma: npm `prev` và bản ổn định là 7.10.1 (publish 2026-10-15). npm tag `latest` hiện là 8.0.0-rc.33 (RC, publish 2026-11-06), GitHub prisma/orm có prerelease rc.23 (2026-11-06). Không nên dùng 8 RC cho production. Nguồn: [npm prisma](https://registry.npmjs.org/prisma), [gh prisma/orm](https://api.github.com/repos/prisma/orm/releases). Prisma 7 là bản Rust-free, cần driver adapter và config riêng ([Announcing Prisma 7](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0)).
- Drizzle: drizzle-orm 0.45.4 là latest (2026-10-08), dist-tag rc 1.0.0-rc.5 đang tồn tại. Nguồn: [npm](https://registry.npmjs.org/drizzle-orm). Apache-2.0 ([gh](https://api.github.com/repos/drizzle-team/drizzle-orm)).
- TypeORM: 1.1.2 latest (2026-10-08), MIT, repo push 2026-11-07, 36.675 sao ([npm](https://registry.npmjs.org/typeorm/latest), [gh](https://api.github.com/repos/typeorm/typeorm)).

Khuyến nghị: Prisma 7.10.x. Luồng `prisma migrate dev --create-only` rồi `migrate deploy` khớp quy định migration trong git. Drizzle là lựa chọn thứ hai (gọn, SQL-first, cần kiểm chứng kit migrate). TypeORM 1.x là bản major mới, ít kinh nghiệm cộng đồng hơn.

### D.5 Auth
- Better Auth 1.7.20, MIT, publish 2026-11-10 ([npm](https://registry.npmjs.org/better-auth/latest), [gh](https://api.github.com/repos/better-auth/better-auth)). Admin plugin có role, `createAccessControl`, `banUser` có lý do và thời hạn, impersonation mặc định 1 giờ. Nguồn: [Better Auth admin](https://better-auth.com/docs/plugins/admin). Cách mount vào NestJS chưa kiểm chứng.
- Keycloak 26.8.2 Apache-2.0 (2026-11-05), Logto v1.46.0 MPL-2.0 (2026-11-05), Zitadel v4.20.2 AGPL-3.0 (2026-11-09). Nguồn: [gh keycloak](https://api.github.com/repos/keycloak/keycloak), [gh logto](https://api.github.com/repos/logto-io/logto), [gh zitadel](https://github.com/zitadel/zitadel). Đây là dịch vụ riêng, thêm vận hành; footprint RAM chưa kiểm chứng.

Khuyến nghị theo độ phức tạp: 1) Better Auth + admin plugin (RBAC, ban có sẵn, MIT); 2) Passport + JWT tự viết (nhiều code bảo mật phải tự làm); 3) Keycloak/Logto/Zitadel chỉ khi cần SSO nhiều hệ thống. Với vài admin, không cần IdP riêng.

## Điểm bị bỏ qua và giới hạn
- Chưa mở tài liệu: Refine i18n và RBAC server, react-admin i18n, Dokploy preview/zero-downtime, AWS presign doc, Nest + Better Auth mount, Socket.IO trong NestJS với Redis adapter, Turborepo/Nx docs, delayed/rate-limit BullMQ.
- Chưa đo: bundle size, footprint RAM Kafka/Keycloak, tải thực tế.
- Không kiểm chứng: CoreUI/Tabler, shadcn admin starter cụ thể, Zalo API.
- Trang giá Refine là gói AI, không phải framework; giá react-admin EE chỉ lấy từ trang chính thức, các con số khác không dùng.

## Câu hỏi chưa giải quyết
1. Chốt antd 5.x hay 6.x: @refinedev/antd và @ant-design/pro-components chưa khai báo antd 6. Cần thử build thực tế trước.
2. Redis hiện tại có dùng chung cho cache với eviction policy không? Nếu có, phải tách cho BullMQ.
3. Có muốn dùng AIStor Free thay MinIO? Điều khoản license chưa kiểm chứng.
4. Dokploy license "NOASSERTION": cần đọc file LICENSE.
5. Dokploy có hỗ trợ rollback/zero-downtime cho compose không?
6. Quy mô sự kiện chính thức (số khách đồng thời) để chốt realtime.
7. Có cần Zalo/email là kênh bắt buộc trong giai đoạn 1 không?
