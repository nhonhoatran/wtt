export const PII_MASK = '***';

// Substring match on the lower-cased key (guardianPhone, dateOfBirth, contactEmail, apiKey...).
const SENSITIVE_PARTS = [
  'phone',
  'email',
  'birth',
  'dob',
  'address',
  'cccd',
  'idnumber',
  'password',
  'token',
  'secret',
  'apikey',
  'authorization',
  'cookie',
];
const MAX_DEPTH = 20;

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_PARTS.some((part) => lower.includes(part));
}

/** Deep-copies a JSON-like value, replacing sensitive keys with a mask. */
export function maskPii(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return PII_MASK;
  if (Array.isArray(value)) return value.map((item) => maskPii(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (value === null || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) && item !== null && item !== undefined ? PII_MASK : maskPii(item, depth + 1);
  }
  return result;
}
