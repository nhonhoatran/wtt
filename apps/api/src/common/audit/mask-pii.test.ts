import { describe, expect, it } from 'vitest';
import { maskPii, PII_MASK } from './mask-pii.js';

describe('maskPii', () => {
  it('masks phone, email and birthDate regardless of case', () => {
    expect(maskPii({ phone: '0901', Email: 'a@b.c', birthDate: '2010-01-01', name: 'An' })).toEqual({
      phone: PII_MASK,
      Email: PII_MASK,
      birthDate: PII_MASK,
      name: 'An',
    });
  });

  it('masks any key containing password, token or secret', () => {
    expect(maskPii({ passwordHash: 'h', refreshToken: 't', clientSecret: 's', tokenizer: 'x' })).toEqual({
      passwordHash: PII_MASK,
      refreshToken: PII_MASK,
      clientSecret: PII_MASK,
      tokenizer: PII_MASK,
    });
  });

  it.each(['phoneNumber', 'guardianPhone', 'contactEmail', 'dateOfBirth', 'dob', 'homeAddress', 'cccd', 'id_number', 'apiKey', 'Authorization', 'cookie'])(
    'masks %s',
    (key) => {
      expect(maskPii({ [key]: 'v' })).toEqual({ [key]: PII_MASK });
    },
  );

  it('recurses into nested objects and arrays without mutating input', () => {
    const input = { players: [{ name: 'B', contact: { phone: '1' } }] };
    expect(maskPii(input)).toEqual({ players: [{ name: 'B', contact: { phone: PII_MASK } }] });
    expect(input.players[0]?.contact.phone).toBe('1');
  });

  it('keeps null values visible so a cleared field stays auditable', () => {
    expect(maskPii({ email: null })).toEqual({ email: null });
  });

  it('serialises dates and passes primitives through', () => {
    expect(maskPii(new Date('2026-01-02T00:00:00Z'))).toBe('2026-01-02T00:00:00.000Z');
    expect(maskPii(42)).toBe(42);
    expect(maskPii(undefined)).toBeUndefined();
  });
});
