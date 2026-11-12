import { describe, expect, it } from 'vitest';
import { buildPlayerIndex, matchPlayer, newPlayerKey, type KnownPlayer } from './player-matcher.js';

const player = (id: string, fullName: string, normalizedName: string, over: Partial<KnownPlayer> = {}): KnownPlayer => ({
  id,
  code: `KMT${id}`,
  fullName,
  normalizedName,
  gender: 'MALE',
  birthYear: 1990,
  club: null,
  ...over,
});

const index = buildPlayerIndex([
  player('1', 'Nguyễn Văn An', 'nguyen van an'),
  player('2', 'Trần Thị Bình', 'tran thi binh', { gender: 'FEMALE', birthYear: 2001 }),
  player('3', 'Lê Văn Cường', 'le van cuong', { birthYear: 1985 }),
  player('4', 'Lê Văn Cường', 'le van cuong', { birthYear: 1999 }),
]);
const input = (over: object) => ({ code: null, fullName: '', gender: null, birthYear: null, ...over });

describe('matchPlayer', () => {
  it('links by code', () => {
    expect(matchPlayer(input({ code: 'kmt1' }), index)).toMatchObject({ action: 'LINK_PLAYER', player: { id: '1' } });
  });

  it('errors when the code does not exist', () => {
    expect(matchPlayer(input({ code: 'KMT999' }), index)).toEqual({ action: 'ERROR', message: 'Không có VĐV mã KMT999' });
  });

  it('errors when a code matches but the birth year differs', () => {
    const result = matchPlayer(input({ code: 'KMT1', fullName: 'Nguyen Van An', birthYear: 1991 }), index);
    expect(result).toMatchObject({ action: 'ERROR' });
    expect((result as { message: string }).message).toContain('Khác dữ liệu VĐV mã KMT1');
    expect((result as { message: string }).message).toContain('năm sinh');
  });

  it('links a code row whose name differs only by diacritics', () => {
    expect(matchPlayer(input({ code: 'KMT1', fullName: 'NGUYEN VAN AN' }), index).action).toBe('LINK_PLAYER');
  });

  it('links accented and unaccented spellings of one exact identity', () => {
    const accented = matchPlayer(input({ fullName: 'Nguyễn Văn An', gender: 'MALE', birthYear: 1990 }), index);
    const plain = matchPlayer(input({ fullName: '  nguyen   van an ', gender: 'MALE', birthYear: 1990 }), index);
    expect(accented).toMatchObject({ action: 'LINK_PLAYER', player: { id: '1' } });
    expect(plain).toMatchObject({ action: 'LINK_PLAYER', player: { id: '1' } });
  });

  it('asks for confirmation on a name-only match', () => {
    const result = matchPlayer(input({ fullName: 'Nguyen Van An', gender: 'MALE', birthYear: 1995 }), index);
    expect(result).toMatchObject({ action: 'NEEDS_CONFIRM', candidates: [{ id: '1' }] });
  });

  it('asks for confirmation when several players share the name and no birth year is given', () => {
    const result = matchPlayer(input({ fullName: 'Lê Văn Cường', gender: 'MALE' }), index);
    expect(result.action).toBe('NEEDS_CONFIRM');
    expect(result.action === 'NEEDS_CONFIRM' && result.candidates.map((candidate) => candidate.id)).toEqual(['3', '4']);
  });

  it('creates a new player with a dedupe key and requires gender', () => {
    expect(matchPlayer(input({ fullName: 'Phạm Mới', gender: 'FEMALE', birthYear: 2005 }), index)).toEqual({
      action: 'CREATE_PLAYER',
      newPlayerKey: 'pham moi|FEMALE|2005',
    });
    expect(matchPlayer(input({ fullName: 'Phạm Mới' }), index).action).toBe('ERROR');
  });

  it('gives the same key to two spellings of one new person', () => {
    const a = newPlayerKey({ code: null, fullName: 'Phạm  Mới', gender: 'FEMALE', birthYear: 2005 });
    const b = newPlayerKey({ code: null, fullName: 'pham moi', gender: 'FEMALE', birthYear: 2005 });
    expect(a).toBe(b);
  });

  it('points a merged code at the surviving code', () => {
    const merged = buildPlayerIndex([], new Map([['KMT9', 'KMT1']]));
    expect(matchPlayer(input({ code: 'kmt9' }), merged)).toEqual({ action: 'ERROR', message: 'VĐV mã kmt9 đã được gộp vào mã KMT1 — dùng mã KMT1' });
    expect(matchPlayer(input({ code: 'KMT8' }), merged)).toMatchObject({ action: 'ERROR', message: 'Không có VĐV mã KMT8' });
  });
});
