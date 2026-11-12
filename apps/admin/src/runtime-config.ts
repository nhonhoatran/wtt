export interface AdminRuntimeConfig {
  API_BASE_PATH: string;
  ADMIN_PUBLIC_URL: string;
  PUBLIC_SITE_URL: string;
}

const FALLBACK: AdminRuntimeConfig = {
  API_BASE_PATH: '/api/v1',
  ADMIN_PUBLIC_URL: window.location.origin,
  PUBLIC_SITE_URL: '',
};

/** /config.json is written at container start, so URLs change without a rebuild. */
export async function loadRuntimeConfig(): Promise<AdminRuntimeConfig> {
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (!res.ok) return FALLBACK;
    return { ...FALLBACK, ...((await res.json()) as Partial<AdminRuntimeConfig>) };
  } catch {
    return FALLBACK;
  }
}
