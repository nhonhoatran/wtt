import { describe, expect, it } from 'vitest';
import { cspMode, pageCsp, videoFrameOrigins } from '../../src/lib/content-security-policy';

const production = { NODE_ENV: 'production', VIDEO_EMBED_HOSTS: 'youtube.com,fb.watch' } as const;

describe('page CSP configuration', () => {
  it('defaults to report-only and requires an explicit valid enforcement mode', () => {
    expect(cspMode(undefined)).toBe('report-only');
    expect(cspMode('report-only')).toBe('report-only');
    expect(cspMode('enforce')).toBe('enforce');
    for (const value of ['', 'off', 'Enforce', 'enforce; default-src *']) expect(() => cspMode(value)).toThrow('CSP_MODE');
    expect(pageCsp(new Headers(), production).header).toBe('Content-Security-Policy-Report-Only');
    expect(pageCsp(new Headers(), { ...production, CSP_MODE: 'enforce' }).header).toBe('Content-Security-Policy');
  });

  it('uses a new cryptographic 128-bit nonce on every request without unsafe production scripts', () => {
    const first = pageCsp(new Headers(), production);
    const second = pageCsp(new Headers(), production);
    expect(first.nonce).not.toBe(second.nonce);
    expect(Buffer.from(first.nonce, 'base64')).toHaveLength(16);
    const script = first.value.split('; ').find((part) => part.startsWith('script-src '));
    expect(script).toBe(`script-src 'self' 'nonce-${first.nonce}' 'strict-dynamic'`);
    expect(first.value).toContain("script-src-attr 'none'");
    expect(first.value).toContain("font-src 'self'");
    expect(first.value).toContain("style-src 'self' 'unsafe-inline'");
    expect(first.value).not.toContain('unsafe-eval');
    expect(pageCsp(new Headers(), { ...production, NODE_ENV: 'development' }).value).toContain("'unsafe-eval'");
  });

  it('overwrites client nonce and both policy headers before rendering', () => {
    const incoming = new Headers({ 'x-nonce': 'attacker', 'content-security-policy': "script-src * 'unsafe-inline'", 'content-security-policy-report-only': 'default-src *', cookie: 'locale=vi' });
    const csp = pageCsp(incoming, production);
    expect(csp.requestHeaders.get('x-nonce')).toBe(csp.nonce);
    expect(csp.requestHeaders.get('content-security-policy')).toBe(csp.value);
    expect(csp.requestHeaders.has('content-security-policy-report-only')).toBe(false);
    expect(csp.requestHeaders.get('cookie')).toBe('locale=vi');
    expect(incoming.get('x-nonce')).toBe('attacker');
  });

  it('maps only configured supported provider hosts to fixed HTTPS iframe origins', () => {
    expect(videoFrameOrigins(' WWW.YOUTUBE.COM ,youtu.be')).toEqual(['https://www.youtube-nocookie.com']);
    expect(videoFrameOrigins('facebook.com, fb.watch')).toEqual(['https://www.facebook.com']);
    expect(videoFrameOrigins('')).toEqual([]);
    expect(videoFrameOrigins("evil.test,youtube.com; script-src *")).toEqual([]);
    expect(pageCsp(new Headers(), { ...production, VIDEO_EMBED_HOSTS: '' }).value).toContain("frame-src 'none'");
  });
});
