import { revalidateTag, revalidatePath, updateTag } from 'next/cache';

const INTERNAL_HOSTS = (process.env.INTERNAL_HOSTS ?? 'localhost:4101,127.0.0.1:4101').split(',');

export async function POST(req) {
  if (req.headers.get('x-revalidate-secret') !== (process.env.REVALIDATE_SECRET ?? 'dev-secret')) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const host = req.headers.get('host') ?? '';
  if (process.env.CHECK_HOST === '1' && !INTERNAL_HOSTS.includes(host)) {
    return new Response('Not Found', { status: 404 });
  }
  const { tags, mode } = await req.json();
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string' || t.length > 256)) {
    return Response.json({ error: 'bad tags' }, { status: 400 });
  }
  try {
    for (const t of tags) {
      if (mode === 'max') revalidateTag(t, 'max');
      else if (mode === 'expire0') revalidateTag(t, { expire: 0 });
      else if (mode === 'legacy') revalidateTag(t);
      else if (mode === 'update') updateTag(t);
      else if (mode === 'path') revalidatePath(`/match/${t.replace('match-', '')}`);
      else return Response.json({ error: 'bad mode' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: String(e.message) }, { status: 500 });
  }
  return Response.json({ revalidated: true, mode, tags });
}
