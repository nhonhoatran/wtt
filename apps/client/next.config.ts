import path from 'node:path';
import type { NextConfig } from 'next';

// Report-only in phase 08; phase 12 switches to enforcing (with nonces for Next's inline scripts).
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://www.youtube-nocookie.com https://www.facebook.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'report-uri /api/csp-report',
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo root so standalone output traces workspace packages.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY }] }];
  },
};

export default nextConfig;
