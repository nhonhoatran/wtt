import { expect, test } from './support/fixtures';

const base = (slug: string) => `/vi/events/${slug}`;

test.describe('events list', () => {
  test('shows the seeded event card; bogus filters still render', async ({ page, world }) => {
    await page.goto(`/vi/events?q=${world.world.tag}`);
    const card = page.getByRole('link', { name: new RegExp(world.eventName) });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', base(world.world.slug));
    await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(/\d{4}/);
    await expect(page.getByRole('navigation', { name: 'Trạng thái' }).getByRole('link', { name: 'Tất cả' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Thưởng')).toHaveCount(0);
    await expect(page.getByText('Hạn đăng ký')).toHaveCount(0);

    const response = await page.goto('/vi/events?tier=bogus&page=abc');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Giải đấu' })).toBeVisible();
  });
});

test.describe('event overview', () => {
  test('names the event, shows only tabs that have content, and the stats', async ({ page, world }) => {
    await page.goto(base(world.world.slug));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(world.eventName);

    const tabs = page.getByRole('navigation', { name: 'Mục của giải' });
    for (const name of ['Tổng quan', 'Trận đấu', 'Nhánh đấu', 'Bảng đấu', 'Vận động viên']) {
      await expect(tabs.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(tabs.getByRole('link', { name: 'Thông tin' })).toBeVisible();

    const stat = (label: string) => page.locator('dl dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]');
    await expect(stat('Vận động viên')).toHaveText('16');
    await expect(stat('Nội dung')).toHaveText('4');
    await expect(page.getByRole('heading', { level: 2, name: /^Nội dung thi đấu \(4\)$/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Thông tin nhanh' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tất cả giải đấu' })).toHaveAttribute('href', '/vi/events');
  });

  test('other tabs use the slim hero without the figures', async ({ page, world }) => {
    await page.goto(`${base(world.world.slug)}/matches`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(world.eventName);
    await expect(page.locator('[data-event-hero] dl')).toHaveCount(0);
  });
});

test.describe('draws tab', () => {
  test('renders the published bracket', async ({ page, world, isMobile }) => {
    // A phone shows one round at a time (chips switch it); wider screens show every round column.
    const response = await page.goto(`${base(world.world.slug)}/draws/MS${isMobile ? '?round=3' : ''}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 2, name: /^Nhánh đấu · / })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chung kết' })).toBeVisible();
    if (isMobile) await expect(page.getByRole('navigation', { name: /^Chọn vòng/ }).getByRole('link', { name: /Bán kết/ })).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'Bán kết' })).toBeVisible();
    expect(await page.getByText(/^Trận #\d+$/).count()).toBeGreaterThanOrEqual(7);
  });

  test('each match box links to its match page and the champion column is present', async ({ page, world, isMobile }) => {
    await page.goto(`${base(world.world.slug)}/draws/MS${isMobile ? '?round=3' : ''}`);
    const link = page.getByRole('link', { name: /^Chi tiết trận #\d+:/ }).first();
    await expect(link).toHaveAttribute('href', new RegExp(`${base(world.world.slug)}/matches/\\d+$`));
    await expect(page.getByRole('heading', { name: 'Vô địch' })).toBeVisible();
  });

  test('on a phone ?round picks the single round that is shown', async ({ page, world }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base(world.world.slug)}/draws/MS?round=2`);
    await expect(page.getByRole('navigation', { name: /^Chọn vòng/ }).getByRole('link', { name: /Bán kết/ })).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-screen-bracket] [data-match-number]:visible')).toHaveCount(2);
    await expect(page.getByRole('link', { name: /^Vòng sau: Chung kết/ })).toHaveAttribute('href', /[?&]round=3$/);
    await page.goto(`${base(world.world.slug)}/draws/MS?round=3`);
    await expect(page.getByRole('link', { name: /^Vòng sau:/ })).toHaveCount(0);
    await page.goto(`${base(world.world.slug)}/draws/MS?round=2`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('[data-screen-bracket] [data-match-number]:visible')).toHaveCount(7);
  });

  test('answers 404 for the unpublished WD draw', async ({ page, world }) => {
    const response = await page.goto(`${base(world.world.slug)}/draws/WD`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  });

  test('the index redirects to the first sub-event with a draw', async ({ page, world }) => {
    await page.goto(`${base(world.world.slug)}/draws`);
    await expect(page).toHaveURL(new RegExp(`${base(world.world.slug)}/draws/(MS|WS)$`));
  });
});

test.describe('groups tab', () => {
  test('lists a standings row per entry and match cards linking to match pages', async ({ page, world }) => {
    await page.goto(`${base(world.world.slug)}/groups/MD`);
    const table = page.getByRole('table', { name: /Bảng xếp hạng bảng/ });
    await expect(table.locator('tbody tr')).toHaveCount(3);

    const cards = page.getByRole('link', { name: /^Trận #\d+/ });
    await expect(cards).toHaveCount(3);
    const target = page.locator(`a[href="${base(world.world.slug)}/matches/${world.groupMatchNo}"]`);
    await target.click();
    await expect(page).toHaveURL(new RegExp(`/matches/${world.groupMatchNo}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`Trận #${world.groupMatchNo}`);
  });

  test('a played match page shows the game-by-game score table', async ({ page, world }) => {
    await page.goto(`${base(world.world.slug)}/matches/${world.playedMatchNo}`);
    await expect(page.getByRole('heading', { name: 'Điểm từng ván' })).toBeVisible();
    const table = page.getByRole('table', { name: 'Điểm từng ván' });
    await expect(table.locator('thead th')).toHaveText(['Bên thi đấu', 'Ván 1', 'Ván 2', 'Ván 3', 'Ván thắng']);
    await expect(table.locator('tbody tr').first().locator('td')).toHaveText(['11', '11', '11', '3']);
    await expect(table.locator('tbody tr').nth(1).locator('td')).toHaveText(['5', '5', '5', '0']);
  });
});

test.describe('players tab', () => {
  test('lists the confirmed MS entries only', async ({ page, world }) => {
    await page.goto(`${base(world.world.slug)}/players/MS`);
    await expect(page.getByText('5 vận động viên')).toBeVisible();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(5);
  });

  test('shows the display name of a private player and never the legal name on any page', async ({ page, request, world }) => {
    const root = base(world.world.slug);
    await page.goto(`${root}/players/WS`);
    await expect(page.getByRole('rowheader', { name: world.shownName })).toBeVisible();

    const paths = [
      `/vi/events?q=${world.world.tag}`, root, `${root}/matches`, `${root}/draws/WS`, `${root}/players/WS`, `${root}/players/MS`,
      `${root}/groups/MD`, `${root}/matches/${world.playedMatchNo}`, `/en${root.slice(3)}/players/WS`, `/en${root.slice(3)}/draws/WS`,
    ];
    for (const path of paths) {
      const html = await (await request.get(path)).text();
      expect({ path, leaks: html.includes(world.hiddenLegalName) || html.includes(`Hidden En ${world.world.tag}`) }).toEqual({ path, leaks: false });
    }
    const bracket = await (await request.get(`${root}/draws/WS`)).text();
    expect(bracket).toContain(world.shownName);
  });
});
