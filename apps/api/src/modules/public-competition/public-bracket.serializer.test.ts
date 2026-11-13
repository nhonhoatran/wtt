import { describe, expect, it } from 'vitest';
import { toPublicSource } from './public-bracket.serializer.js';

describe('toPublicSource', () => {
  it('copies the known placeholder shapes and nothing else', () => {
    expect(toPublicSource({ type: 'WINNER_OF', matchNo: 12, secret: 'x' })).toEqual({ type: 'WINNER_OF', matchNo: 12 });
    expect(toPublicSource({ type: 'QUALIFIER', index: 3, entryId: 'e' })).toEqual({ type: 'QUALIFIER', index: 3 });
    expect(toPublicSource({ type: 'GROUP_PLACE', group: 'A', place: 1, groupId: 'g' })).toEqual({ type: 'GROUP_PLACE', group: 'A', place: 1 });
  });

  it('drops unknown or malformed values', () => {
    for (const raw of [null, 'WINNER_OF', [1], {}, { type: 'ENTRY', entryId: 'e' }, { type: 'WINNER_OF', matchNo: '12' }, { type: 'GROUP_PLACE', group: 1, place: 1 }, { type: 'QUALIFIER', index: 1.5 }]) {
      expect(toPublicSource(raw)).toBeNull();
    }
  });
});
