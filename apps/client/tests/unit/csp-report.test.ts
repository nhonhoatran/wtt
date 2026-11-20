import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.spyOn(console, 'warn').mockImplementation(() => undefined); });
afterEach(() => vi.restoreAllMocks());
const route = () => import('../../src/app/api/csp-report/route');
const valid = { effectiveDirective: 'img-src', blockedURL: 'https://example.test/image', documentURL: 'https://site.test/vi' };

it('ignores malformed Reporting API entries and logs the valid report only', async () => {
  const { POST } = await route();
  const response = await POST(new Request('http://localhost/api/csp-report', { method: 'POST', body: JSON.stringify([null, { body: null }, { body: 'bad' }, { body: valid }]) }));
  expect(response.status).toBe(204);
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(JSON.parse(vi.mocked(console.warn).mock.calls[0]![0])).toEqual({ msg: 'csp-violation', directive: 'img-src', blocked: 'https://example.test', page: 'https://site.test' });
});

it('accepts legacy reports but redacts malformed long fields', async () => {
  const { POST } = await route();
  await POST(new Request('http://localhost/api/csp-report', { method: 'POST', body: JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(1000) } }) }));
  expect(JSON.parse(vi.mocked(console.warn).mock.calls[0]![0]).blocked).toBe('[redacted]');
});

it('rejects a declared oversized body before parsing it', async () => {
  const { POST } = await route();
  const response = await POST(new Request('http://localhost/api/csp-report', { method: 'POST', headers: { 'content-length': '9000' }, body: JSON.stringify({ 'csp-report': valid }) }));
  expect(response.status).toBe(204);
  expect(console.warn).not.toHaveBeenCalled();
});

it('caps actual streamed UTF-8 bytes and cancels the stream without trusting Content-Length', async () => {
  const { POST } = await route();
  const cancel = vi.fn();
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('{"csp-report":{"blocked-uri":"'));
    controller.enqueue(new TextEncoder().encode('ế'.repeat(3000)));
  }, cancel });
  const request = new Request('http://localhost/api/csp-report', { method: 'POST', headers: { 'content-length': '1' }, body, duplex: 'half' } as RequestInit);
  expect((await POST(request)).status).toBe(204);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(console.warn).not.toHaveBeenCalled();
});

it('accepts malformed JSON and empty reports silently and limits the logging window', async () => {
  const { POST } = await route();
  for (const body of ['bad-json', '[null]', '{}']) expect((await POST(new Request('http://localhost/api/csp-report', { method: 'POST', body }))).status).toBe(204);
  expect(console.warn).not.toHaveBeenCalled();
  const body = JSON.stringify(Array.from({ length: 40 }, () => ({ body: { effectiveDirective: 'img-src' } })));
  await POST(new Request('http://localhost/api/csp-report', { method: 'POST', body }));
  expect(console.warn).toHaveBeenCalledTimes(30);
});

it('logs only URL origins and known directives, stripping credentials, paths, queries and fragments', async () => {
  const { POST } = await route();
  const warn = vi.mocked(console.warn);
  const response = await POST(new Request('https://site.test/api/csp-report', {
    method: 'POST',
    body: JSON.stringify({ 'csp-report': {
      'violated-directive': "img-src 'self' https://private.test",
      'blocked-uri': 'https://user:password@image.test/person@example.test?token=secret#profile',
      'document-uri': 'https://site.test/contact/person@example.test?email=person@example.test#secret',
    } }),
  }));
  expect(response.status).toBe(204);
  expect(warn).toHaveBeenCalledOnce();
  expect(JSON.parse(warn.mock.calls[0]![0])).toEqual({ msg: 'csp-violation', directive: 'img-src', blocked: 'https://image.test', page: 'https://site.test' });
});

it('redacts untrusted directives and opaque or malformed report URL values', async () => {
  const { POST } = await route();
  const warn = vi.mocked(console.warn);
  await POST(new Request('https://site.test/api/csp-report', {
    method: 'POST',
    body: JSON.stringify([
      { body: { effectiveDirective: 'person@example.test', blockedURL: 'data:text/plain,secret', documentURL: 'not-a-url-with-secret' } },
      { body: { effectiveDirective: 'script-src', blockedURL: 'inline', documentURL: 'file:///private/person@example.test' } },
    ]),
  }));
  expect(warn.mock.calls.map(([message]) => JSON.parse(message))).toEqual([
    { msg: 'csp-violation', directive: 'unknown', blocked: 'data:', page: '[redacted]' },
    { msg: 'csp-violation', directive: 'script-src', blocked: 'inline', page: '[redacted]' },
  ]);
});
