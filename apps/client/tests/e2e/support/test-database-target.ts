export function confirmedTestDatabaseUrl(raw: string | undefined, confirmation: string | undefined): string {
  if (!raw) throw new Error('DATABASE_URL is required for CMS browser fixtures');
  const url = new URL(raw);
  const target = `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || !/^\/[a-z][a-z0-9_]*_test$/.test(url.pathname)
    || confirmation !== target) {
    throw new Error('CMS browser fixtures require a confirmed local PostgreSQL *_test target');
  }
  return raw;
}
