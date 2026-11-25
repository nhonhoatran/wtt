import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/content-fixture';

test.describe('public accessibility baseline', () => {
  for (const locale of ['vi', 'en'] as const) {
    test(`${locale} core pages have no critical or serious axe violations`, async ({ page, world, cms }, testInfo) => {
      test.setTimeout(180_000);
      const paths = [
        `/${locale}`,
        `/${locale}/events?q=${world.world.tag}`,
        `/${locale}/events/calendar`,
        `/${locale}/events/${world.world.slug}`,
        `/${locale}/events/${world.world.slug}/draws/MS`,
        `/${locale}/rankings/${world.ranking.code}`,
        `/${locale}/players/${world.ranking.playerSlug}`,
        `/${locale}/news/${cms.articleSlug}`,
        `/${locale}/videos/${cms.videoSlug}`,
        `/${locale}/pages/${cms.pageSlug}`,
        `/${locale}/contact`,
      ];
      const summaries: object[] = [];
      for (const [index, route] of paths.entries()) {
        await test.step(route, async () => {
          const response = await page.goto(route);
          expect(response?.status(), route).toBe(200);
          await expect(page.locator('main')).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          await testInfo.attach(`axe-${locale}-${index}.json`, {
            body: JSON.stringify(results, null, 2), contentType: 'application/json',
          });
          const violations = results.violations.map(({ id, impact, description, nodes }) => ({
            id, impact, description, elements: nodes.map(({ target }) => target),
          }));
          summaries.push({ route, violations, incompleteRules: results.incomplete.map(({ id }) => id) });
          const blocking = violations.filter(({ impact }) => impact === 'critical' || impact === 'serious');
          expect.soft(blocking, `${route}: ${JSON.stringify(blocking)}`).toEqual([]);
          if (locale === 'vi' && index < 4) {
            await page.screenshot({ path: testInfo.outputPath(`accessibility-${index}.png`), fullPage: true });
          }
        });
      }
      await testInfo.attach(`axe-${locale}-summary.json`, {
        body: JSON.stringify(summaries, null, 2), contentType: 'application/json',
      });
    });
  }
});
