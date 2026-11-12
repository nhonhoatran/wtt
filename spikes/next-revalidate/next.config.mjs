import path from 'node:path';
export default {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname),
  poweredByHeader: false,
  cacheComponents: process.env.CACHE_COMPONENTS === '1',
};
