import { existsSync } from 'node:fs';
import { REVALIDATE_SECRET_HEADER } from '@kamito/shared';
import { runApiSeed } from './support/api-world-runner';
import { readWorld } from './support/world-file';

/** Drops cached lists (events, sitemap) so this run's event shows up at once, like the worker does after a publish. */
async function revalidateSiteCache(): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) throw new Error('REVALIDATE_SECRET is not set');
  const response = await fetch(`${process.env.E2E_SITE_URL}/api/revalidate`, {
    method: 'POST',
    headers: { [REVALIDATE_SECRET_HEADER]: secret, 'content-type': 'application/json' },
    body: JSON.stringify({ tags: ['events', 'settings', 'results-strip'] }),
  });
  if (!response.ok) throw new Error(`revalidate answered ${response.status}`);
}

/** `next dev` compiles each route on first hit; do it once, in order, so parallel tests do not race the compiler. */
async function warmUpRoutes(): Promise<void> {
  const { world, playedMatchNo } = readWorld();
  const root = `/vi/events/${world.slug}`;
  const paths = [
    '/vi', `/vi/events?q=${world.tag}`, root, `${root}/draws/MS`, `${root}/draws`, `${root}/groups/MD`, `${root}/players/MS`,
    `${root}/matches/${playedMatchNo}`, '/en/events', '/sitemap.xml', '/robots.txt',
  ];
  for (const path of paths) await fetch(`${process.env.E2E_SITE_URL}${path}`, { redirect: 'manual' });
}

export default async function globalSetup(): Promise<void> {
  if (existsSync(process.env.E2E_WORLD_FILE!)) runApiSeed('public-world.cleanup.seed.ts');
  runApiSeed('public-world.seed.ts');
  await revalidateSiteCache();
  await warmUpRoutes();
}
