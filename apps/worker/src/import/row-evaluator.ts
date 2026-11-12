import { checkEntryEligibility, type AgeCalculation, type EligibilityIssue, type EligibilityPlayer, type EntryImportRawRow } from '@kamito/shared';
import { mapEntryRow, type ParsedSlot, type SubEventInfo } from './entry-row-mapper.js';
import type { EvaluatedRow, RowPlayer } from './import-row-types.js';
import { matchPlayer, type KnownPlayer, type PlayerIndex } from './player-matcher.js';

export interface EvaluationContext {
  subEvents: Map<string, SubEventInfo>;
  index: PlayerIndex;
  ageMethod: AgeCalculation;
  eventStartDate: Date;
  currentYear: number;
  /** `<subEventId>|<sorted player ids>` -> entry id, CONFIRMED entries only. */
  existingEntries: Map<string, { id: string }>;
  /** `<subEventId>|<playerId>` of players already in a CONFIRMED entry. */
  enteredPlayers: Set<string>;
  /** `<subEventId>|<stage>|<seed>` -> entry id holding that seed. */
  existingSeeds: Map<string, string>;
}

export const competitorKey = (subEventId: string, playerIds: string[]) => `${subEventId}|${[...playerIds].sort().join(',')}`;

function toEligibility(slot: RowPlayer, known: KnownPlayer | undefined): EligibilityPlayer {
  if (known) return { id: known.id, fullName: known.fullName, gender: known.gender, birthDate: known.birthDate, birthYear: known.birthYear };
  return { id: `new:${slot.newPlayerKey}`, fullName: slot.fullName, gender: slot.gender!, birthYear: slot.birthYear };
}

/** Evaluates sheet rows in order; remembers earlier rows so later duplicates are flagged. */
export class RowEvaluator {
  private readonly seenEntries = new Map<string, number>();
  private readonly seenSeeds = new Map<string, number>();
  /** `<subEventId>|<playerId>` -> first row that puts the player in this sub-event. */
  private readonly seenPlayers = new Map<string, number>();

  constructor(private readonly context: EvaluationContext) {}

  evaluate(rowNo: number, raw: EntryImportRawRow): EvaluatedRow {
    const { context } = this;
    const parsed = mapEntryRow(raw, context.subEvents, context.currentYear);
    const messages = [...parsed.errors];
    const candidates: Record<string, string[]> = {};
    const players: RowPlayer[] = [];
    const known = new Map<string, KnownPlayer>();

    for (const slot of parsed.slots) {
      const result = matchPlayer(slot, context.index);
      const base: RowPlayer = { slot: slot.slot, code: slot.code, fullName: slot.fullName, gender: slot.gender, birthYear: slot.birthYear, club: slot.club, action: 'CREATE_PLAYER', playerId: null, newPlayerKey: null };
      if (result.action === 'ERROR') {
        messages.push(`VĐV ${slot.slot}: ${result.message}`);
        players.push(base);
      } else if (result.action === 'LINK_PLAYER') {
        known.set(result.player.id, result.player);
        players.push({ ...base, action: 'LINK_PLAYER', playerId: result.player.id, fullName: slot.fullName || result.player.fullName });
      } else if (result.action === 'NEEDS_CONFIRM') {
        candidates[String(slot.slot)] = result.candidates.map((candidate) => candidate.id);
        players.push({ ...base, action: 'NEEDS_CONFIRM', newPlayerKey: result.newPlayerKey });
      } else {
        players.push({ ...base, newPlayerKey: result.newPlayerKey });
      }
    }

    let plannedAction: EvaluatedRow['plannedAction'] = 'CREATE_ENTRY';
    let overridable = false;
    const resolved = messages.length === 0 && parsed.subEvent && players.every((player) => player.action !== 'NEEDS_CONFIRM');
    if (resolved && parsed.subEvent) {
      const check = this.checkEntry(rowNo, parsed.subEvent, players, parsed.slots, parsed.header, known);
      messages.push(...check.messages);
      plannedAction = check.plannedAction;
      overridable = check.overridable;
    }

    const needsConfirm = players.some((player) => player.action === 'NEEDS_CONFIRM');
    return {
      rowNo,
      status: messages.length ? 'ERROR' : needsConfirm ? 'NEEDS_CONFIRM' : 'VALID',
      plannedAction,
      data: { ...parsed.header, subEventId: parsed.subEvent?.id ?? null, players, ...(messages.length && overridable ? { overridable: true } : {}) },
      messages,
      candidates,
    };
  }

  private checkEntry(
    rowNo: number,
    subEvent: SubEventInfo,
    players: RowPlayer[],
    slots: ParsedSlot[],
    header: { stage: string; seed: number | null },
    known: Map<string, KnownPlayer>,
  ) {
    const { context } = this;
    const messages: string[] = [];
    const eligible = players.map((player) => toEligibility(player, player.playerId ? known.get(player.playerId) : undefined));
    const issues: EligibilityIssue[] = checkEntryEligibility(
      eligible,
      { competitorKind: subEvent.competitorKind, genderRule: subEvent.genderRule, category: subEvent.category, eventStartDate: context.eventStartDate },
      context.ageMethod,
    );
    messages.push(...issues.map((issue) => issue.message));
    const overridable = issues.length > 0 && issues.every((issue) => issue.overridable);

    const ids = eligible.map((player) => player.id);
    const key = competitorKey(subEvent.id, ids);
    const earlier = this.seenEntries.get(key);
    if (earlier) messages.push(`Trùng với dòng ${earlier} (cùng nội dung, cùng VĐV)`);
    else this.seenEntries.set(key, rowNo);

    const playerLabel = (player: RowPlayer) => slots.find((slot) => slot.slot === player.slot)?.fullName || player.fullName || player.code;
    if (!earlier) {
      for (const player of players) {
        const firstRow = player.playerId ? this.seenPlayers.get(`${subEvent.id}|${player.playerId}`) : undefined;
        if (firstRow) messages.push(`${playerLabel(player)} đã có ở dòng ${firstRow} trong nội dung ${subEvent.code} (cặp/đơn khác)`);
      }
    }
    const existing = context.existingEntries.get(key);
    if (!existing) {
      for (const player of players) {
        if (player.playerId && context.enteredPlayers.has(`${subEvent.id}|${player.playerId}`)) {
          messages.push(`${playerLabel(player)} đã đăng ký nội dung ${subEvent.code} (cặp/đơn khác)`);
        }
      }
    }
    if (header.seed !== null) {
      const seedKey = `${subEvent.id}|${header.stage}|${header.seed}`;
      const holder = context.existingSeeds.get(seedKey);
      const earlierSeed = this.seenSeeds.get(seedKey);
      if (earlierSeed) messages.push(`Hạt giống ${header.seed} trùng với dòng ${earlierSeed}`);
      else if (holder && holder !== existing?.id) messages.push(`Hạt giống ${header.seed} đã có người trong nội dung ${subEvent.code}`);
      else this.seenSeeds.set(seedKey, rowNo);
    }
    if (!messages.length) {
      for (const player of players) if (player.playerId) this.seenPlayers.set(`${subEvent.id}|${player.playerId}`, rowNo);
    }
    const plannedAction: EvaluatedRow['plannedAction'] = existing ? 'UPDATE_ENTRY' : 'CREATE_ENTRY';
    return { messages, plannedAction, overridable: overridable && messages.length === issues.length };
  }
}
