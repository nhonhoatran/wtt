import { allocatePlayerIdentity, findOrCreateCompetitor, type Prisma } from '@kamito/db';
import type { BatchState, CommitSettings, CreatedEntities, RowOutcome } from './commit-types.js';
import type { RowData, RowPlayer } from './import-row-types.js';
import type { KnownPlayer } from './player-matcher.js';

type Tx = Prisma.TransactionClient;

export type Resolved = { playerId: string; known?: KnownPlayer } | { newKey: string; slot: RowPlayer };

export interface ExistingEntry {
  id: string;
  status: 'CONFIRMED' | 'WITHDRAWN';
  stage: RowData['stage'];
  quotaType: RowData['quotaType'];
  seed: number | null;
  notes: string | null;
  eligibilityOverrideReason: string | null;
}

type EntryFields = Pick<ExistingEntry, 'stage' | 'quotaType' | 'seed' | 'notes' | 'eligibilityOverrideReason' | 'status'>;

async function createMissingPlayers(tx: Tx, resolved: Resolved[], settings: CommitSettings, state: BatchState) {
  const created: string[] = [];
  const newPlayerKeys: Record<string, string> = {};
  const playerIds: string[] = [];
  for (const item of resolved) {
    if ('playerId' in item) {
      playerIds.push(item.playerId);
      continue;
    }
    const existing = state.createdByKey.get(item.newKey);
    if (existing) {
      playerIds.push(existing);
      continue;
    }
    const identity = await allocatePlayerIdentity(tx, { fullName: item.slot.fullName }, settings.codeFormat);
    const player = await tx.player.create({
      data: { ...identity, gender: item.slot.gender!, birthYear: item.slot.birthYear, club: item.slot.club, countryCode: settings.countryCode },
      select: { id: true },
    });
    state.createdByKey.set(item.newKey, player.id);
    newPlayerKeys[item.newKey] = player.id;
    created.push(player.id);
    playerIds.push(player.id);
  }
  return { playerIds, createdPlayerIds: created, newPlayerKeys };
}

/** Fields a file may change on an existing entry: blank cells keep the stored value. */
function updatePatch(existing: ExistingEntry, data: RowData, overrideReason: string | null): Partial<EntryFields> {
  const wanted: Partial<EntryFields> = {
    stage: data.stageGiven ? data.stage : undefined,
    quotaType: data.quotaTypeGiven ? data.quotaType : undefined,
    seed: data.seed ?? undefined,
    notes: data.notes ?? undefined,
    status: 'CONFIRMED',
    eligibilityOverrideReason: overrideReason ?? undefined,
  };
  const patch: Partial<EntryFields> = {};
  for (const key of Object.keys(wanted) as Array<keyof EntryFields>) {
    if (wanted[key] !== undefined && wanted[key] !== existing[key]) Object.assign(patch, { [key]: wanted[key] });
  }
  return patch;
}

const auditRow = (settings: CommitSettings, action: string, entryId: string, before: object | null, after: object): Prisma.AuditLogCreateManyInput => ({
  actorType: 'USER',
  actorId: settings.actorId,
  action,
  entity: 'Entry',
  entityId: entryId,
  before: before ?? undefined,
  after,
  reason: `import ${settings.jobId}`,
});

/** Writes the entry (and any new players) after every rejection check passed; audits each change. */
export async function writeEntry(
  tx: Tx,
  input: { subEventId: string; resolved: Resolved[]; data: RowData; existing: ExistingEntry | null; overridden: boolean },
  settings: CommitSettings,
  state: BatchState,
): Promise<RowOutcome> {
  const { subEventId, resolved, data, existing, overridden } = input;
  const { playerIds, createdPlayerIds, newPlayerKeys } = await createMissingPlayers(tx, resolved, settings, state);
  const overrideReason = overridden ? settings.overrideReason : null;
  let entryId: string;
  if (existing) {
    entryId = existing.id;
    const patch = updatePatch(existing, data, overrideReason);
    if (Object.keys(patch).length) {
      await tx.entry.update({ where: { id: entryId }, data: patch });
      const before = Object.fromEntries(Object.keys(patch).map((key) => [key, existing[key as keyof EntryFields]]));
      state.audits.push(auditRow(settings, 'entry.update', entryId, before, patch));
    }
  } else {
    const competitor = await findOrCreateCompetitor(tx, playerIds);
    const fields = { stage: data.stage, quotaType: data.quotaType, seed: data.seed, notes: data.notes, status: 'CONFIRMED' as const, eligibilityOverrideReason: overrideReason };
    const created = await tx.entry.create({ data: { subEventId, competitorId: competitor.id, ...fields }, select: { id: true } });
    entryId = created.id;
    state.audits.push(auditRow(settings, 'entry.create', entryId, null, { subEventId, competitorId: competitor.id, ...fields }));
  }
  state.touchedEntries.add(entryId);
  const entities: CreatedEntities = { playerIds, createdPlayerIds, newPlayerKeys, entryId, action: existing ? 'UPDATE_ENTRY' : 'CREATE_ENTRY' };
  return { ok: true, entities };
}
