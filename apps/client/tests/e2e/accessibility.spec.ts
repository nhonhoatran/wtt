import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/content-fixture';

test.describe('public accessibility baseline', () => {
  for (const locale of ['vi', 'en'] as const) {
    test(`${locale} core pages have no axe violations`, async ({ page, world, cms }, testInfo) => {
      test.setTimeout(180_000);
      const paths = [
        `/${locale}`,
        `/${locale}/events`,
        `/${locale}/search`,
        `/${locale}/search?q=${world.world.tag}`,
        `/${locale}/events?q=${world.world.tag}`,
        `/${locale}/events/calendar`,
        `/${locale}/events/${world.world.slug}`,
        `/${locale}/events/${world.world.slug}/matches`,
        `/${locale}/events/${world.world.slug}/draws/MS`,
        `/${locale}/events/${world.world.slug}/draws/MS?round=2`,
        `/${locale}/events/${world.world.slug}/groups/MD`,
        `/${locale}/events/${world.world.slug}/matches/${world.playedMatchNo}`,
        `/${locale}/events/${world.world.slug}/matches/${world.groupMatchNo}`,
        `/${locale}/rankings`,
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
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze();
          await testInfo.attach(`axe-${locale}-${index}.json`, {
            body: JSON.stringify(results, null, 2), contentType: 'application/json',
          });
          const violations = results.violations.map(({ id, impact, description, nodes }) => ({
            id, impact, description, elements: nodes.map(({ target }) => target),
          }));
          summaries.push({ route, violations, incompleteRules: results.incomplete.map(({ id }) => id) });
          expect.soft(violations, `${route}: ${JSON.stringify(violations)}`).toEqual([]);
          await page.screenshot({ path: testInfo.outputPath(`accessibility-${locale}-${index}.png`), fullPage: true });
        });
      }
      await testInfo.attach(`axe-${locale}-summary.json`, {
        body: JSON.stringify(summaries, null, 2), contentType: 'application/json',
      });
    });
  }
});
