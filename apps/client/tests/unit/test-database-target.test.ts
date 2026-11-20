import { describe, expect, it } from 'vitest';
import { confirmedTestDatabaseUrl } from '../e2e/support/test-database-target';

describe('CMS browser fixture database safety', () => {
  it('accepts only a confirmed local test database and preserves its credentials privately', () => {
    const url = 'postgresql://test-user:test-password@localhost:5433/kamito_phase12_test';
    expect(confirmedTestDatabaseUrl(url, 'localhost:5433/kamito_phase12_test')).toBe(url);
  });

  it('rejects a dev database, remote host, wrong protocol and missing confirmation', () => {
    for (const [url, confirmation] of [
      ['postgresql://u:p@localhost:5433/kamito_tt_dev', 'localhost:5433/kamito_tt_dev'],
      ['postgresql://u:p@db.example.test:5433/kamito_test', 'db.example.test:5433/kamito_test'],
      ['https://localhost:5433/kamito_test', 'localhost:5433/kamito_test'],
      ['postgresql://u:p@localhost:5433/kamito_test', 'localhost:5433/other_test'],
      ['postgresql://u:p@localhost:5433/kamito_test', undefined],
    ]) expect(() => confirmedTestDatabaseUrl(url, confirmation)).toThrow('confirmed local PostgreSQL');
    expect(() => confirmedTestDatabaseUrl(undefined, undefined)).toThrow('DATABASE_URL');
  });
});
