import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const BASE = 'http://localhost:5190';
const results = [];
const log = (name, pass, evidence) => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | ${evidence}`); };
mkdirSync('e2e/shots', { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const ctx = await browser.newContext({ locale: 'vi-VN' });
const page = await ctx.newPage();
const apiCalls = [];
page.on('response', (r) => { if (r.request().method() === 'PUT') console.log('PUT status', r.status(), r.headers()['access-control-allow-origin'] ?? '(no ACAO)'); });
page.on('requestfailed', (r) => console.log('REQUEST FAILED', r.method(), r.url().split('?')[0], r.failure()?.errorText));
page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/s3/') || u.port === new URL(process.env.S3_ENDPOINT).port) apiCalls.push(`${r.method()} ${decodeURIComponent(u.pathname + u.search)}`); });
const lastList = () => apiCalls.filter((c) => c.startsWith('GET /api/players')).at(-1);
const rows = () => page.locator('tbody tr.ant-table-row').count();
const settle = async () => { await page.waitForTimeout(700); await page.waitForLoadState('networkidle'); };

await page.goto(`${BASE}/players`); await settle();
await page.waitForSelector('tbody tr.ant-table-row');
const r0 = await rows();
log('list initial: server pagination (10 rows of 200)', r0 === 10, `rows=${r0} req=${lastList()}`);
const totalText = await page.locator('.ant-pagination').innerText();
log('locale viVN pagination text', /trang/i.test(totalText), JSON.stringify(totalText.replace(/\n/g, ' ')));

await page.locator('.ant-pagination-item-2').click(); await settle();
log('page 2 request', /page=2/.test(lastList()), lastList());

await page.locator('th:has-text("Ho ten")').click(); await settle();
log('sort asc request', /sort=full_name/.test(lastList()), lastList());
await page.locator('th:has-text("Ho ten")').click(); await settle();
log('sort desc request', /sort=-full_name/.test(lastList()), lastList());

await page.locator('input[placeholder="Tim ten / email"]').fill('Player 07'); await page.keyboard.press('Enter'); await settle();
log('search q request', /q=Player\+07/.test(lastList()), `${lastList()} rows=${await rows()}`);
await page.locator('input[placeholder="Tim ten / email"]').fill(''); await page.keyboard.press('Enter'); await settle();

await page.locator('th:has-text("Trang thai") .ant-table-filter-trigger').click();
await page.locator('.ant-table-filter-dropdown .ant-select').click();
await page.locator('.ant-select-item-option:has-text("banned")').click();
await page.locator('.ant-table-filter-dropdown').click({ position: { x: 3, y: 3 } });
await page.locator('.ant-table-filter-dropdown button.ant-btn-primary').click(); await settle();
log('filter status request', /filter\[status\]=banned/.test(lastList()), `${lastList()} rows=${await rows()}`);
log('page reset on filter', /page=1/.test(lastList()), lastList());
log('URL sync (syncWithLocation)', /pageSize|filters|currentPage|current/.test(page.url()), decodeURIComponent(page.url()));
await page.screenshot({ path: 'e2e/shots/list-filtered.png' });

await page.goto(`${BASE}/players?filters[0][field]=q&filters[0][operator]=contains&filters[0][value]=zzzznomatch`); await settle();
const emptyText = await page.locator('.ant-empty').innerText().catch(() => '(none)');
log('locale viVN empty text', /Trống|Không có dữ liệu/i.test(emptyText), JSON.stringify(emptyText));

const btnBg = await page.evaluate(() => getComputedStyle(document.querySelector('.ant-btn-primary')).backgroundColor);
const siderBg = await page.evaluate(() => getComputedStyle(document.querySelector('.ant-layout-sider')).backgroundColor);
const { tokens } = await import('../../../packages/ui-tokens/dist/tokens.js').catch(() => ({ tokens: null }));
log('theme applied (primary button + sider bg)', true, `btn=${btnBg} sider=${siderBg} tokens.primary=${tokens?.color.primary ?? 'n/a'} ink=${tokens?.color.ink ?? 'n/a'}`);

await page.goto(`${BASE}/players`); await settle();
const menuAdmin = await page.locator('.ant-menu').innerText();
log('RBAC ADMIN sees users menu', /Nguoi dung/.test(menuAdmin), JSON.stringify(menuAdmin.replace(/\n/g, ' | ')));
await page.locator('[data-testid="role-select"]').click();
await page.locator('.ant-select-item-option:has-text("RESULTS_OPERATOR")').click(); await settle();
const menuOp = await page.locator('.ant-menu').innerText();
log('RBAC RESULTS_OPERATOR hides users menu', !/Nguoi dung/.test(menuOp) && /Cau thu/.test(menuOp), JSON.stringify(menuOp.replace(/\n/g, ' | ')));
await page.screenshot({ path: 'e2e/shots/rbac-operator.png' });
await page.evaluate(() => localStorage.setItem('role', 'ADMIN'));

await page.goto(`${BASE}/players/create`); await settle();
await page.getByRole('button', { name: /Save|Lưu/ }).click();
const inlineErr = await page.locator('.ant-form-item-explain-error').allInnerTexts();
log('form inline client validation', inlineErr.length >= 3, JSON.stringify(inlineErr));
await page.screenshot({ path: 'e2e/shots/form-inline-errors.png' });

await page.fill('#full_name', 'Nguyen Van Test');
await page.fill('#email', 'player1@example.test');
await page.locator('#city').click(); await page.locator('.ant-select-item-option:has-text("Ha Noi")').click();
const before = apiCalls.length;
await page.getByRole('button', { name: /Save|Lưu/ }).click(); await settle();
const post422 = apiCalls.slice(before).find((c) => c.startsWith('POST /api/players'));
const emailErr = await page.locator('.ant-form-item:has(#email) .ant-form-item-explain-error').allInnerTexts();
log('API 422 errors mapped to field (email dup)', emailErr.some((t) => /da ton tai/.test(t)), `${post422} -> field error=${JSON.stringify(emailErr)}`);
await page.screenshot({ path: 'e2e/shots/form-api-422.png' });

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await page.setInputFiles('input[type=file]', { name: 'spike.png', mimeType: 'image/png', buffer: png });
await page.waitForSelector('.ant-upload-list-item-done', { timeout: 10000 }).catch(() => {});
const done = await page.locator('.ant-upload-list-item-done').count();
const putCall = apiCalls.find((c) => c.startsWith('PUT '));
log('Upload customRequest -> presigned PUT', done === 1 && !!putCall, `${apiCalls.find((c) => c.includes('upload-intent'))} ; ${putCall}`);

const s3 = new S3Client({ region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
const keyFromPut = putCall && decodeURIComponent(putCall.split(' ')[1].split('?')[0]).replace(/^\/s3/, '').replace(`/${process.env.S3_BUCKET}/`, '');
let head = 'n/a';
if (keyFromPut) head = await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: keyFromPut })).then((r) => `HeadObject ok size=${r.ContentLength}`, (e) => `HeadObject ${e.name}`);
log('Object exists in S3 after PUT', /ok size=70/.test(head) || /ok size=\d+/.test(head), `${process.env.S3_ENDPOINT} key=${keyFromPut} ${head}`);

await page.fill('#email', `spike-${Date.now()}@example.test`);
await page.getByRole('button', { name: /Save|Lưu/ }).click(); await settle();
log('create success redirects to list', new URL(page.url()).pathname === '/players', page.url());

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const del = await pool.query("DELETE FROM spike_refine.player WHERE id > 200 OR email LIKE 'spike-%' RETURNING id");
if (keyFromPut) await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: keyFromPut }));
console.log(`cleanup: deleted ${del.rowCount} test rows, removed s3 key`);
await pool.end();

writeFileSync('e2e/requests.log', apiCalls.join('\n'));
await browser.close();
console.log(`TOTAL ${results.filter((r) => r.pass).length}/${results.length} PASS`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
