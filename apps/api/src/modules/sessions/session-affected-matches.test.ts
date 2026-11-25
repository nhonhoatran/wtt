import { describe, expect, it, vi } from 'vitest';
import { sessionMatchNosToRefresh, sessionRelabeled } from './session-affected-matches.js';

const labels = { code: 'S1', name: 'Sáng 1', nameEn: null };

describe('sessionRelabeled', () => {
  it('is false when code, name and nameEn are unchanged', () => {
    expect(sessionRelabeled(labels, { ...labels })).toBe(false);
  });

  it.each([{ code: 'S2' }, { name: 'Vòng loại sáng' }, { nameEn: 'Morning' }])('is true when %o changes', (change) => {
    expect(sessionRelabeled(labels, { ...labels, ...change })).toBe(true);
  });
});

describe('sessionMatchNosToRefresh', () => {
  const db = (matchNos: number[]) => ({ match: { findMany: vi.fn().mockResolvedValue(matchNos.map((matchNo) => ({ matchNo }))) } });

  it('returns only the retimed matches without a rename and does not query', async () => {
    const stub = db([1, 2, 3]);
    await expect(sessionMatchNosToRefresh(stub as never, 's1', false, [2])).resolves.toEqual([2]);
    expect(stub.match.findMany).not.toHaveBeenCalled();
  });

  it('returns every match of the session on a rename, merged with retimed ones', async () => {
    const stub = db([1, 2, 3]);
    await expect(sessionMatchNosToRefresh(stub as never, 's1', true, [3, 9])).resolves.toEqual([3, 9, 1, 2]);
    expect(stub.match.findMany).toHaveBeenCalledWith({ where: { sessionId: 's1' }, select: { matchNo: true } });
  });
});
