import { describe, expect, it } from 'vitest';
import { MATCH_STATUS_PILL, tableName } from '../../src/lib/match-display';

describe('tableName', () => {
  it('prefers the display name and falls back to the localized code template', () => {
    expect(tableName({ code: 'T1', displayName: 'Bàn chính' }, 'Bàn {code}')).toBe('Bàn chính');
    expect(tableName({ code: 'T1', displayName: null }, 'Bàn {code}')).toBe('Bàn T1');
    expect(tableName({ code: 'T1', displayName: null }, 'Table {code}')).toBe('Table T1');
  });

  it('is null without a table', () => {
    expect(tableName(null, 'Bàn {code}')).toBeNull();
    expect(tableName(undefined, 'Bàn {code}')).toBeNull();
  });
});

describe('MATCH_STATUS_PILL', () => {
  it('maps every match status to a pill variant', () => {
    expect(MATCH_STATUS_PILL).toEqual({ SCHEDULED: 'scheduled', LIVE: 'live', OFFICIAL: 'official' });
  });
});
