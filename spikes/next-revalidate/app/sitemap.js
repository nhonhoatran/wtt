const UP = process.env.UPSTREAM ?? 'http://127.0.0.1:4100';
const SITE = process.env.SITE_URL ?? 'http://localhost:4101';

// Request-time rendering (no static prerender at build); data cache bounded by TTL + tag.
export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const ids = await (await fetch(`${UP}/matches`, { next: { revalidate: 60, tags: ['sitemap'] } })).json();
  return ids.map((id) => ({ url: `${SITE}/match/${id}`, changeFrequency: 'hourly' }));
}
