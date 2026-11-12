import type { Prisma, PlayerCodeFormat } from '@kamito/db';
import type { AgeCalculation } from '@kamito/shared';
import type { SubEventInfo } from './entry-row-mapper.js';
import type { KnownPlayer } from './player-matcher.js';

export interface CommitSettings {
  jobId: string;
  actorId: string;
  overrideReason: string | null;
  ageMethod: AgeCalculation;
  codeFormat: PlayerCodeFormat;
  countryCode: string;
  eventStartDate: Date;
  subEventsById: Map<string, SubEventInfo>;
}

/** Mutable per-batch state: merged into the job-wide state only after the batch transaction commits. */
export interface BatchState {
  createdByKey: Map<string, string>;
  touchedEntries: Set<string>;
  /** Players seen so far in this batch, by id. */
  known: Map<string, KnownPlayer>;
  audits: Prisma.AuditLogCreateManyInput[];
}

export interface CreatedEntities {
  playerIds: string[];
  createdPlayerIds: string[];
  newPlayerKeys: Record<string, string>;
  entryId: string;
  action: 'CREATE_ENTRY' | 'UPDATE_ENTRY';
}

export type RowOutcome = { ok: true; entities: CreatedEntities } | { ok: false; messages: string[] };
