import { expect, test } from './support/fixtures';

test('an ongoing event with only upcoming matches opens its populated tab', async ({ page, world }) => {
  const root = `/vi/events/${world.longEvent.slug}/matches`;
  await page.goto(root);
  const states = page.getByRole('navigation', { name: 'Trạng thái trận' });
  await expect(states.getByRole('link', { name: 'Sắp tới', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator(`#content a[href="${root}/${world.longEvent.matchNo}"]:visible`)).toBeVisible();
  await page.goto(`${root}?state=live`);
  await expect(states.getByRole('link', { name: 'Đang đấu', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Không có trận nào đang đấu.', { exact: true })).toBeVisible();
});

test('date filtering supports the full event duration with native bounds and GET URLs', async ({ page, world }) => {
  const { slug, firstDate, lastDate, lateDate, matchNo } = world.longEvent;
  const root = `/vi/events/${slug}/matches`;
  await page.goto(root);
  const input = page.getByLabel('Ngày', { exact: true });
  await expect(input).toHaveAttribute('type', 'date');
  await expect(input).toHaveAttribute('min', firstDate);
  await expect(input).toHaveAttribute('max', lastDate);
  expect((Date.parse(lateDate) - Date.parse(firstDate)) / 86_400_000).toBeGreaterThan(62);
  await input.fill(lateDate);
  await page.getByRole('search', { name: 'Lọc trận' }).getByRole('button', { name: 'Lọc', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`date=${lateDate}`));
  await expect(input).toHaveValue(lateDate);
  await expect(page.locator(`#content a[href="${root}/${matchNo}"]:visible`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('long-event-date-filter.png'), fullPage: true });
});

test('invalid, repeated and outside-event date queries are discarded on the server', async ({ page, world }) => {
  const { slug, firstDate, lateDate, matchNo } = world.longEvent;
  const root = `/vi/events/${slug}/matches`;
  const before = new Date(Date.parse(firstDate) - 86_400_000).toISOString().slice(0, 10);
  for (const query of ['date=not-a-day', 'date=2027-02-30', `date=${before}`, `date=${lateDate}&date=${firstDate}`]) {
    const response = await page.goto(`${root}?state=upcoming&${query}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByLabel('Ngày', { exact: true })).toHaveValue('');
    await expect(page.locator(`#content a[href="${root}/${matchNo}"]:visible`)).toBeVisible();
  }
});
