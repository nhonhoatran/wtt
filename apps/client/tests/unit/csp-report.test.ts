import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.spyOn(console, 'warn').mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); });
const route = () => import('../../src/app/api/csp-report/route');
const valid = { effectiveDirective: 'img-src', blockedURL: 'https://example.test/image', documentURL: 'https://site.test/vi' };

it('ignores malformed Reporting API entries and logs the valid report only', async () => {
  const { POST } = await route();
  const response = await POST(new Request('http://localhost/api/csp-report', { method: 'POST', body: JSON.stringify([null, { body: null }, { body: 'bad' }, { body: valid }]) }));
  expect(response.status).toBe(204);
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(JSON.parse(vi.mocked(console.warn).mock.calls[0]![0])).toEqual({ msg: 'csp-violation', directive: 'img-src', blocked: valid.blockedURL, page: valid.documentURL });
});

it('accepts legacy reports but truncates logged fields', async () => {
  const { POST } = await route();
  await POST(new Request('http://localhost/api/csp-report', { method: 'POST', body: JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(1000) } }) }));
  expect(JSON.parse(vi.mocked(console.warn).mock.calls[0]![0]).blocked).toHaveLength(300);
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
