import { expect, it, vi } from 'vitest';

vi.mock('../../src/lib/api-client', () => ({ publicGet: vi.fn() }));
import { isUrlPart } from '../../src/lib/public-data';

it('lets catalog codes reach server-rendered public routes, including leading separators and composed codes', () => {
  for (const code of ['_MS', '-MS', `${'D'.repeat(40)}-${'C'.repeat(40)}`]) expect(isUrlPart(code)).toBe(true);
});

it('rejects dots and URL delimiters before building an internal API path', () => {
  for (const code of ['.', '..', '../MS', 'MS/MD', '%2e%2e', 'MS?kind=main', 'MS#MD', 'x'.repeat(129)]) expect(isUrlPart(code)).toBe(false);
});
