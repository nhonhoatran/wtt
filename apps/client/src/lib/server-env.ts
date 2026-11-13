const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

const seconds = (name: string): number => {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
};

/** Read per request, never at build time: the Docker build has no runtime env. */
export const serverEnv = {
  apiInternalUrl: () => required('API_INTERNAL_URL'),
  ssrSecret: () => required('SSR_INTERNAL_SECRET'),
  revalidateSecret: () => required('REVALIDATE_SECRET'),
  revalidateHosts: () => required('REVALIDATE_ALLOWED_HOSTS').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
  apiTimeoutMs: () => seconds('API_FETCH_TIMEOUT_MS'),
  publicRevalidateSeconds: () => seconds('PUBLIC_REVALIDATE_SECONDS'),
  matchdayRevalidateSeconds: () => seconds('MATCHDAY_REVALIDATE_SECONDS'),
};
