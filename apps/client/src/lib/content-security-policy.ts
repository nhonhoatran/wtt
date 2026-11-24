import { randomBytes } from 'node:crypto';

type CspEnvironment = Partial<Record<'CSP_MODE' | 'NODE_ENV' | 'VIDEO_EMBED_HOSTS', string>>;
export type CspMode = 'report-only' | 'enforce';

export function cspMode(value: string | undefined): CspMode {
  if (value === undefined || value === 'report-only') return 'report-only';
  if (value === 'enforce') return 'enforce';
  throw new Error('CSP_MODE must be report-only or enforce');
}

// Embed origins are fixed by supported providers; the source URL allowlist is deployment configuration.
export function videoFrameOrigins(allowedHosts = 'youtube.com,m.youtube.com,youtu.be,facebook.com,fb.watch'): string[] {
  const hosts = new Set(allowedHosts.split(',').map((host) => host.trim().toLowerCase().replace(/^www\./, '')));
  return [
    ...(['youtube.com', 'm.youtube.com', 'youtu.be'].some((host) => hosts.has(host)) ? ['https://www.youtube-nocookie.com'] : []),
    ...(['facebook.com', 'fb.watch'].some((host) => hosts.has(host)) ? ['https://www.facebook.com'] : []),
  ];
}

export function pageCsp(incoming: Headers, env: CspEnvironment = process.env) {
  const mode = cspMode(env.CSP_MODE);
  const nonce = randomBytes(16).toString('base64');
  const frames = videoFrameOrigins(env.VIDEO_EMBED_HOSTS);
  const value = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    // Tier colors and the contact honeypot currently use style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${frames.length ? frames.join(' ') : "'none'"}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    'report-uri /api/csp-report',
  ].join('; ');
  const requestHeaders = new Headers(incoming);
  requestHeaders.delete('content-security-policy-report-only');
  requestHeaders.set('content-security-policy', value);
  requestHeaders.set('x-nonce', nonce);
  return { nonce, value, requestHeaders, header: mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only' };
}
