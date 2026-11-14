import { describe, expect, it, vi } from 'vitest';
import { PermanentRevalidateError, revalidateTags, revalidateUrl } from './revalidate-processor.js';

const deps = (response: Response | Error) => {
  const fetchFn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { fetchFn, deps: { clientInternalUrl: 'http://client:3000', secret: 's'.repeat(32), timeoutMs: 1000, fetch: fetchFn as unknown as typeof fetch } };
};

describe('revalidateTags', () => {
  it('posts the tags with the secret header', async () => {
    const { fetchFn, deps: d } = deps(new Response('{}', { status: 200 }));
    await expect(revalidateTags(d, ['match-giai-2026-12', 'results-strip'])).resolves.toEqual({ tags: 2 });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('http://client:3000/api/revalidate');
    expect((init.headers as Record<string, string>)['x-revalidate-secret']).toBe('s'.repeat(32));
    expect(JSON.parse(init.body as string)).toEqual({ tags: ['match-giai-2026-12', 'results-strip'] });
  });

  it('throws on a non-2xx answer so the job is retried', async () => {
    await expect(revalidateTags(deps(new Response('', { status: 503 })).deps, ['events'])).rejects.toThrow(/503/);
  });

  it('throws on network errors', async () => {
    await expect(revalidateTags(deps(new Error('ECONNREFUSED')).deps, ['events'])).rejects.toThrow(/ECONNREFUSED/);
  });

  it('rejects a bad payload permanently without calling the client', async () => {
    const { fetchFn, deps: d } = deps(new Response('{}'));
    await expect(revalidateTags(d, ['bad tag'])).rejects.toBeInstanceOf(PermanentRevalidateError);
    await expect(revalidateTags(d, [])).rejects.toBeInstanceOf(PermanentRevalidateError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('revalidateUrl', () => {
  it.each([
    ['http://client:3000', 'http://client:3000/api/revalidate'],
    ['http://client:3000/', 'http://client:3000/api/revalidate'],
    ['http://gateway/web', 'http://gateway/web/api/revalidate'],
    ['http://gateway/web/', 'http://gateway/web/api/revalidate'],
  ])('joins %s', (base, expected) => {
    expect(revalidateUrl(base).href).toBe(expected);
  });

  it('is the URL the request goes to for a base with a subpath', async () => {
    const { fetchFn, deps: d } = deps(new Response('{}', { status: 200 }));
    await revalidateTags({ ...d, clientInternalUrl: 'http://gateway/web' }, ['events']);
    expect(String((fetchFn.mock.calls[0] as unknown as [URL])[0])).toBe('http://gateway/web/api/revalidate');
  });
});
