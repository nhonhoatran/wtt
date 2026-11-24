# Kiểm chứng độc lập — admin ranking và client audit

- Ngày: 2026-11-20.
- Vai trò: tester khác tác giả triển khai ranking và công cụ audit client.
- Không query/seed/migrate DB, không chạy fixture API/Playwright hoặc tải HTTP trong các lệnh dưới đây.

## Admin ranking

| Lệnh | Kết quả độc lập |
|---|---|
| `node --experimental-test-coverage --test test/ranking-rules-state.test.mjs` tại `apps/admin` | 18/18 đạt; module `ranking-rules-state.ts` đạt 100% line/branch/function; 280,73 ms |
| `pnpm --filter @kamito/admin test` tại root, PATH có Node và Git `bin`/`usr\bin` | 29/29 đạt, không lỗi/bỏ qua; 5.175,779 ms. Gồm đủ 5 ca entrypoint dùng shell thật, 18 ranking, 3 TipTap và 3 image policy |

Các ca ranking mới kiểm logic production đã tách: sửa/hoàn tác/xóa ô, số không, copy cột, không sửa input, scope đơn/đôi–draw–phiên bản, baseline ngày tương lai, danh mục inactive còn rule. Không coi unit này là kiểm React lifecycle/browser/API.

## Client audit — lượt kiểm đầu

| Lệnh | Kết quả |
|---|---|
| `pnpm --filter @kamito/client exec eslint src tests/e2e/accessibility.spec.ts` | PASS |
| `node --check apps/client/tests/performance/lighthouse-audit.mjs` | PASS |
| `pnpm --filter @kamito/client typecheck` | FAIL: TS2769/TS7006 ở callback `test.skip(({}, testInfo) => ...)` của `content-home.spec.ts:7`, `rate-limit.spec.ts:8`, `site-chrome-and-seo.spec.ts:121`. ConditionBody Playwright chỉ nhận fixture args; đã báo tác giả phase 08/root sửa |
| `node apps/client/tests/performance/lighthouse-audit.mjs --help` | FAIL: `TypeError: Invalid URL`, input `--help`; runner chưa xử lý help. Đã báo root |

Không suy kết quả Lighthouse hoặc axe từ việc công cụ đã cài, kiểm cú pháp hay typecheck. Chưa chạy audit trên site thật và chưa có điểm hiệu năng/khả năng truy cập trong báo cáo này.
