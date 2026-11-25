---
phase: C11
title: "Rà mobile 390, cổng axe/Lighthouse/SEO/in và cập nhật tài liệu"
status: pending
priority: P1
effort: 3h
depends_on: [C3, C4, C5, C6, C7, C8, C9, C10]
---

# Phase C11 — Rà mobile, cổng chất lượng, tài liệu

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục "Kiểm thử hiện có bị ảnh hưởng"
- `docs/public-site.md` (Trạng thái, Route, Lighthouse, axe), `docs/cache-revalidation.md`, `docs/deployment-guide.md#playwright-e2e-client`
- Figma mobile: `figma/client/1-31.png`, `1-34.png`, `1-37.png`

## Overview
- Ưu tiên: P1 (cổng nghiệm thu của nửa client).
- Mobile đã làm trong từng phase; phase này rà chéo mọi route ở 390 và 1440, mở rộng phạm vi axe, chạy Lighthouse, in PDF, i18n, rồi cập nhật tài liệu. Không deploy staging/production.

## Key insights
- Axe hiện quét 9 route (`tests/e2e/accessibility.spec.ts:8-18`); thiếu danh sách giải, tab trận, tab bảng, trang trận, `/rankings` → thêm (route mới = điểm bị đổi nhiều nhất).
- Lighthouse chỉ bắt buộc 4 route (`docs/public-site.md:71-76`); thêm tham khảo `/vi/events` và trang trận.
- Kiểm 390 không tràn ngang ở `site-chrome-and-seo.spec.ts:124-139` → thêm route mới vào danh sách.
- Tài liệu cập nhật qua agent `docs-manager` (luật `documentation-management.md`).

## Requirements
- Mọi suite đạt, 0 lỗi/0 flaky, workers 1, retries 0 (như mốc hiện tại).
- Không chuỗi cứng mới trong component (`grep` chuỗi tiếng Việt có dấu trong `apps/client/src/components`, `src/app` → chỉ còn trong dictionary/không có).
- Không hex mới trong component; không file mã > 200 dòng mới (CSS/TSX).

## Architecture
```
build client (production) + API dist + PostgreSQL/Redis local _test (theo deployment guide)
  ├ vitest: client unit, i18n-keys, print (test:print)
  ├ Playwright desktop 1440 + mobile 390: toàn bộ tests/e2e
  ├ axe: route mở rộng × vi/en × 2 viewport
  └ Lighthouse mobile: 4 route gate + 2 route tham khảo
```

## Related code files
Sửa:
- `apps/client/tests/e2e/accessibility.spec.ts` (thêm `/events`, `/events/:slug/matches`, `/events/:slug/groups/<code>` nếu fixture có, `/events/:slug/matches/<no>`, `/rankings`, `/search` nếu có)
- `apps/client/tests/e2e/site-chrome-and-seo.spec.ts` (danh sách route 390; canonical không chứa `ranking`, `round`)
- `docs/public-site.md` (route + tham số `ranking`, `round`; setting hiển thị; Figma deviations; kết quả kiểm)
- `docs/cache-revalidation.md` (tag mới `subEvent.*` → `events`, `venueTable.write`)
- `docs/project-changelog.md`, `docs/development-roadmap.md`, `docs/system-architecture.md` (nếu luồng đổi)

Tạo:
- `plans/261125-0951-figma-ui-redesign-admin-client/reports/tester-<yymmdd>-client-figma-regression.md` (báo cáo kiểm, do tester viết)
- Ảnh chụp 1440/390 mỗi route vào `plans/261125-0951-figma-ui-redesign-admin-client/reports/screenshots-client/`

## Implementation steps
1. Thêm route vào axe và kiểm 390; thêm assert canonical bỏ `ranking`/`round`.
2. Build production; chạy fixture theo deployment guide (DB `_test`, `MIGRATE_CONFIRM_TARGET` khớp; không `prisma db push`; không đổi `.env` gốc).
3. Chạy: `pnpm --filter @kamito/client typecheck lint test test:print`, `pnpm --filter @kamito/client test:e2e` (2 project), Lighthouse 4+2 URL.
4. Mở ảnh chụp từng route ở 1440/390, so với Figma chốt; ghi lệch có chủ đích (bảng "Lệch Figma có lý do" trong `docs/public-site.md`).
5. Rà grep: chuỗi cứng, hex, file > 200 dòng, xưng hô riêng tư trong `plans/` và `docs/` vừa sửa.
6. `docs-manager` cập nhật tài liệu; `code-reviewer` review toàn bộ diff client + API.

## Todo
- [ ] Mở rộng axe + 390 + canonical
- [ ] Chạy toàn bộ suite + Lighthouse + in
- [ ] Ảnh chụp + đối chiếu Figma
- [ ] Rà grep chất lượng
- [ ] Cập nhật docs + review

## Success criteria
- Playwright toàn bộ đạt (desktop + mobile), axe 0 vi phạm mọi mức trên route mở rộng, `test:print` đạt, i18n-keys đạt.
- Lighthouse mobile 4 route gate ≥ 85/90/95 (`runtimeError=null`); số thực ghi trong báo cáo.
- `docs/public-site.md` mô tả đúng route/tham số/setting mới; `docs/cache-revalidation.md` có tag mới.
- Báo cáo tester tách unit / API / browser / Lighthouse, không cộng trùng lượt chạy.

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Lighthouse Performance tụt vì hero/ảnh | Trung bình × Cao | Đo từng phase (C4, C6, C7, C10); sửa trước khi tới C11 |
| Fixture e2e thiếu dữ liệu cho khối mới (bàn, session, setting) | Trung bình × Trung bình | Bổ sung world/fixture ở phase tương ứng; không dùng dữ liệu giả trên UI |
| Flaky do nhiều route mới | Thấp × Trung bình | Workers 1, retries 0, đợi `document.fonts.ready` như spec hiện có |

## Security considerations
- Chạy kiểm chỉ trên DB local `_test`; không truyền `DATABASE_URL` từ dòng `.env` đã comment; không đụng staging/production.

## Next steps
- Bàn giao kết quả cho lead; mục hoãn (Q1–Q9) chờ quyết định sản phẩm.
- Rollback toàn bộ nửa client: revert theo thứ tự ngược C10 → C3; C2 giữ được độc lập (trường API bổ sung, không phá client cũ).
