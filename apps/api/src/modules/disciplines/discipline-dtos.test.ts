import { describe, expect, it } from 'vitest';
import { createDisciplineBody, updateDisciplineBody } from './discipline-dtos.js';

const body = { code: 'MS', name: 'Đơn nam', competitorKind: 'SINGLES', genderRule: 'MEN' };

describe('optional discipline schedule color', () => {
  it('accepts old clients without a color and normalizes an explicit RGB hex', () => {
    expect(createDisciplineBody.parse(body)).not.toHaveProperty('colorHex');
    expect(createDisciplineBody.parse({ ...body, colorHex: ' #aBc123 ' })).toHaveProperty('colorHex', '#ABC123');
  });

  it('clears a saved color with null or an empty picker value while an omitted patch keeps it', () => {
    expect(updateDisciplineBody.parse({ colorHex: null })).toEqual({ colorHex: null });
    expect(updateDisciplineBody.parse({ colorHex: '' })).toEqual({ colorHex: null });
    expect(updateDisciplineBody.parse({ name: 'Đơn nam mới' })).not.toHaveProperty('colorHex');
  });

  it.each(['red', '#fff', '#12345678', 'url(https://example.invalid/pixel)'])('rejects unsafe or non-RGB catalog color %s', (colorHex) => {
    expect(createDisciplineBody.safeParse({ ...body, colorHex }).success).toBe(false);
    expect(updateDisciplineBody.safeParse({ colorHex }).success).toBe(false);
  });
});
