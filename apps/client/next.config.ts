import path from 'node:path';
import type { NextConfig } from 'next';
import { DEFAULT_LOCALE } from './src/i18n/locales';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo root so standalone output traces workspace packages.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  poweredByHeader: false,
  async redirects() {
    return [{ source: '/', destination: `/${DEFAULT_LOCALE}`, permanent: false }];
  },
};

export default nextConfig;
