import { describe, expect, it, vi } from 'vitest';
import type { PublicMatchList, PublicMatchState } from '@kamito/shared';
import { dateWithin, toQuery } from '../../src/lib/public-query';
import { loadMatchList } from '../../src/lib/load-match-list';

const list = (state: PublicMatchState, total: number): PublicMatchList => ({ state, total, page: 1, pageSize: 24, items: [] });

describe('event date filters', () => {
  const rules = { date: dateWithin('2028-01-01', '2028-12-31') };

  it('keeps a real date beyond the old 62-day rendering limit and both event boundaries', () => {
    for (const date of ['2028-01-01', '2028-02-29', '2028-12-30', '2028-12-31']) {
      expect(toQuery({ date }, rules)).toBe(`?date=${date}`);
    }
  });

  it('drops invalid, repeated and out-of-event dates before forming an API/cache query', () => {
    for (const date of ['2028-02-30', '2028-00-01', '2028-13-01', '2027-12-31', '2029-01-01', 'not-a-date', ['2028-01-01', '2028-02-02']]) {
      expect(toQuery({ date }, rules)).toBe('');
    }
    expect(toQuery({ date: '2029-02-29' }, { date: dateWithin('2029-01-01', '2029-12-31') })).toBe('');
  });
});

describe('automatic match state', () => {
  it('opens upcoming matches between sessions without querying completed once upcoming has data', async () => {
    const fetch = vi.fn(async (state: PublicMatchState) => list(state, state === 'upcoming' ? 3 : 0));
    const result = await loadMatchList('ONGOING', undefined, fetch);
    expect(result.state).toBe('upcoming');
    expect(fetch.mock.calls.map(([state]) => state)).toEqual(['live', 'upcoming']);
  });

  it('stops after one request when live matches exist', async () => {
    const fetch = vi.fn(async (state: PublicMatchState) => list(state, 2));
    expect((await loadMatchList('ONGOING', undefined, fetch)).state).toBe('live');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('checks completed only after live and upcoming are empty', async () => {
    const fetch = vi.fn(async (state: PublicMatchState) => list(state, state === 'completed' ? 4 : 0));
    expect((await loadMatchList('ONGOING', undefined, fetch)).state).toBe('completed');
    expect(fetch.mock.calls.map(([state]) => state)).toEqual(['live', 'upcoming', 'completed']);
  });

  it('preserves an explicit empty tab and does not issue fallback requests', async () => {
    const fetch = vi.fn(async (state: PublicMatchState) => list(state, 0));
    expect((await loadMatchList('ONGOING', 'live', fetch)).state).toBe('live');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('treats an invalid or repeated state as automatic while a missing event stops querying', async () => {
    for (const raw of ['invalid', ['live', 'completed']]) {
      const fetch = vi.fn(async (state: PublicMatchState) => list(state, state === 'upcoming' ? 1 : 0));
      expect((await loadMatchList('ONGOING', raw, fetch)).state).toBe('upcoming');
    }
    const missing = vi.fn(async () => null);
    expect((await loadMatchList('ONGOING', undefined, missing)).list).toBeNull();
    expect(missing).toHaveBeenCalledTimes(1);
  });

  it('starts at the lifecycle state for upcoming and completed events', async () => {
    const fetch = vi.fn(async (state: PublicMatchState) => list(state, 1));
    expect((await loadMatchList('UPCOMING', undefined, fetch)).state).toBe('upcoming');
    expect((await loadMatchList('COMPLETED', undefined, fetch)).state).toBe('completed');
  });
});
