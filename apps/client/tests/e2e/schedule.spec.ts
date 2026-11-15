import { expect, test } from './support/fixtures';

const root = (slug: string, locale = 'vi') => `/${locale}/events/${slug}/info`;

test('schedule renders on the server with public player names and the event timezone', async ({ page, request, world }) => {
  const response = await request.get(root(world.world.slug));
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('Buổi sáng');
  expect(html).toContain('Buổi chiều');
  expect(html).toContain(world.shownName);
  expect(html).not.toContain(world.hiddenLegalName);
  expect(html).toContain('08:00');
  await page.goto(root(world.world.slug));
  await expect(page.getByRole('heading', { level: 2, name: 'Lịch theo buổi / bàn' })).toBeVisible();
  await expect(page.locator('[data-schedule-table="T1"]')).toHaveCount(2);
  await expect(page.locator('[data-schedule-table="T2"]')).toHaveCount(1);
  await expect(page.locator(`a[href="/vi/events/${world.world.slug}/matches/${world.groupMatchNo}"]`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: test.info().outputPath('schedule-screen.png'), fullPage: true });
});

test('session and table filters use GET and survive an English locale switch', async ({ page, world }) => {
  await page.goto(root(world.world.slug));
  const form = page.getByRole('search', { name: 'Lọc lịch thi đấu' });
  await form.getByRole('combobox', { name: 'Buổi thi đấu', exact: true }).selectOption('S02');
  await form.getByRole('combobox', { name: 'Bàn', exact: true }).selectOption('T1');
  await form.getByRole('button', { name: 'Lọc', exact: true }).click();
  await expect(page).toHaveURL(/session=S02.*table=T1/);
  await expect(page.locator('[data-schedule-table]')).toHaveCount(1);
  await expect(page.locator('[data-schedule-table]')).toContainText('Buổi chiều');
  await expect(page.locator('[data-schedule-table]')).not.toContainText('Buổi sáng');
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/.*session=S02.*table=T1/);
  await expect(page.locator('[data-schedule-table]')).toContainText('Afternoon session');
  await page.goto(`${root(world.world.slug)}?session=S02&table=T2`);
  await expect(page.getByText('Chưa có trận nào trong lịch đã chọn.')).toBeVisible();
});

test('schedule prints the selected session and table with context and no site chrome', async ({ page, world }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Chromium PDF is verified on the desktop project');
  await page.goto(`${root(world.world.slug)}?session=S01&table=T1`);
  await expect(page.getByRole('button', { name: 'In lịch thi đấu' })).toBeVisible();
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'true'; }; });
  await page.getByRole('button', { name: 'In lịch thi đấu' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-called', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('header').first()).toBeHidden();
  await expect(page.locator('footer').first()).toBeHidden();
  await expect(page.getByRole('search', { name: 'Lọc lịch thi đấu' })).toBeHidden();
  await expect(page.locator('[data-schedule-table]')).toHaveCount(1);
  await expect(page.locator('[data-schedule-table]')).toContainText(world.eventName);
  await expect(page.locator('[data-schedule-table]')).toContainText('Buổi sáng');
  await page.screenshot({ path: testInfo.outputPath('schedule-print.png'), fullPage: true });
  const pdf = await page.pdf({ path: testInfo.outputPath('schedule.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  expect(pdf.byteLength).toBeGreaterThan(1000);
  // Stress the real print stylesheet with long names and a table spanning several pages.
  await page.locator('[data-schedule-table] tbody').evaluate((body) => {
    const row = body.querySelector('tr')!;
    for (let i = 0; i < 40; i++) {
      const copy = row.cloneNode(true) as HTMLTableRowElement;
      copy.cells[2]!.textContent = `Vận động viên có tên dài để kiểm tra ngắt dòng và phân trang — Dòng ${i + 1}`;
      body.append(copy);
    }
  });
  await page.pdf({ path: testInfo.outputPath('schedule-long-table.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
});
