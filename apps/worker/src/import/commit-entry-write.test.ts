import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@kamito/db';
import { writeEntry } from './commit-entry-write.js';
import type { BatchState, CommitSettings } from './commit-types.js';
import type { RowData, RowPlayer } from './import-row-types.js';

vi.mock('@kamito/db', () => ({
  allocatePlayerIdentity: vi.fn(async () => ({ code: 'TEST001', slug: 'test-player', fullName: 'Imported Player', normalizedName: 'imported player' })),
  findOrCreateCompetitor: vi.fn(async () => ({ id: 'competitor-1' })),
}));

const slot: RowPlayer = {
  slot: 1, code: null, fullName: 'Imported Player', gender: 'MALE', birthYear: 2000, club: null,
  action: 'CREATE_PLAYER', playerId: null, newPlayerKey: 'new-player',
};
const data: RowData = { subEventCode: 'MS', subEventId: 'sub-event', stage: 'MAIN', quotaType: 'DIRECT', seed: null, notes: null, players: [slot] };
const settings: CommitSettings = {
  jobId: 'job-1', actorId: 'admin-1', overrideReason: null, ageMethod: 'BIRTH_YEAR',
  codeFormat: { prefix: 'TEST', digits: 3 }, countryCode: 'VIE', eventStartDate: new Date('2026-11-27'), subEventsById: new Map(),
};
const state = (): BatchState => ({ createdByKey: new Map(), touchedEntries: new Set(), known: new Map(), audits: [] });
const transaction = () => ({
  player: { create: vi.fn(async () => ({ id: 'new-player-1' })), update: vi.fn() },
  entry: { create: vi.fn(async () => ({ id: 'entry-1' })), update: vi.fn() },
});

describe('import player profile defaults', () => {
  it('creates a missing player privately with noindex even before the database default is migrated', async () => {
    const tx = transaction();
    const batch = state();
    const result = await writeEntry(tx as unknown as Prisma.TransactionClient, {
      subEventId: 'sub-event', resolved: [{ newKey: 'new-player', slot }], data, existing: null, overridden: false,
    }, settings, batch);
    expect(tx.player.create).toHaveBeenCalledOnce();
    expect(tx.player.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isPublicProfile: false, noindex: true }) }));
    expect(result).toMatchObject({ ok: true, entities: { createdPlayerIds: ['new-player-1'], playerIds: ['new-player-1'] } });
    expect(batch.createdByKey.get('new-player')).toBe('new-player-1');
  });

  it('links an existing player or reuses a newly created player without changing profile flags', async () => {
    const tx = transaction();
    const batch = state();
    batch.createdByKey.set('same-player', 'already-created');
    const result = await writeEntry(tx as unknown as Prisma.TransactionClient, {
      subEventId: 'sub-event', resolved: [{ playerId: 'already-public' }, { newKey: 'same-player', slot }], data, existing: null, overridden: false,
    }, settings, batch);
    expect(tx.player.create).not.toHaveBeenCalled();
    expect(tx.player.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, entities: { createdPlayerIds: [], playerIds: ['already-public', 'already-created'] } });
  });
});
