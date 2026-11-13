import { locksDrawStructure } from '@kamito/shared';
import { sideSourceLabel } from './draw-labels';
import type { BracketData, BracketPosition, DrawMatch, DrawRound, EntryBrief, SideSource } from './draw-types';

export interface BracketCell {
  key: string;
  label: string;
  seed: number | null;
  /** BYE and waiting slots ("Thắng #5", "Suất vòng loại 1") are shown but never picked. */
  isEntry: boolean;
  isBye: boolean;
  entry: EntryBrief | null;
  /** Only first-round cells map to a bracket position, so only they can be swapped / replaced. */
  positionId: string | null;
  played: boolean;
}

export interface MatchNode {
  match: DrawMatch;
  cells: [BracketCell, BracketCell];
}

export interface RoundColumn {
  round: DrawRound;
  matches: MatchNode[];
}

export interface SectionLayout {
  section: string;
  columns: RoundColumn[];
}

function makeCell(match: DrawMatch, side: 1 | 2, position: BracketPosition | undefined): BracketCell {
  const entry = position?.entry ?? (side === 1 ? match.side1 : match.side2);
  const source: SideSource | null = side === 1 ? match.side1Source : match.side2Source;
  const isBye = position?.source === 'BYE';
  return {
    key: `${match.id}-${side}`,
    label: entry ? entry.displayName : isBye ? 'BYE' : sideSourceLabel(source),
    seed: entry?.seed ?? null,
    isEntry: Boolean(entry),
    isBye,
    entry,
    positionId: position?.id ?? null,
    played: locksDrawStructure(match),
  };
}

/** Group rounds by section and number; first-round matches take positions two at a time in order. */
export function buildBracketLayout(data: BracketData): SectionLayout[] {
  const sections = [...new Set(data.rounds.map((round) => round.section))];
  return sections.map((section) => {
    const rounds = data.rounds.filter((round) => round.section === section).sort((a, b) => a.number - b.number);
    const positions = data.positions.filter((position) => position.section === section).sort((a, b) => a.position - b.position);
    const firstNumber = rounds[0]?.number;
    const columns = rounds.map((round) => {
      const matches = data.matches.filter((match) => match.roundId === round.id).sort((a, b) => a.orderInRound - b.orderInRound);
      const first = round.number === firstNumber;
      return {
        round,
        matches: matches.map((match, index): MatchNode => ({
          match,
          cells: [makeCell(match, 1, first ? positions[index * 2] : undefined), makeCell(match, 2, first ? positions[index * 2 + 1] : undefined)],
        })),
      };
    });
    return { section, columns };
  });
}
