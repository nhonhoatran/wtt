let base = '/api/v1';

/** Mirrors http-client's base for plain links and raw uploads that cannot go through apiFetch. */
export function setApiUrlBase(value: string): void {
  base = value.replace(/\/$/, '');
}

export const apiUrl = (path: string): string => `${base}${path}`;
