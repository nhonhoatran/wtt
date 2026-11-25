import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroupCard } from '../../../admin/src/pages/event-hub/group-card';
import type { EntryBrief, GroupRecord } from '../../../admin/src/pages/event-hub/draw-types';

const entry = (id: string, status = 'CONFIRMED'): EntryBrief => ({
  id, status, seed: null, stage: 'MAIN', type: 'PAIR', displayName: `Pair ${id}`, players: [],
});
const group: GroupRecord = {
  id: 'group-fixture', code: 'A', order: 0, version: 1, matches: [],
  members: ['one', 'two', 'withdrawn'].map((id, slot) => ({ entryId: id, slot, entry: entry(id, id === 'withdrawn' ? 'WITHDRAWN' : 'CONFIRMED') })),
  standings: ['one', 'two', 'withdrawn'].map((entryId, index) => ({
    entryId, rank: index + 1, qualified: index < 2, played: 0, won: 0, lost: 0, matchPoints: 0,
    gamesFor: 0, gamesAgainst: 0, needsManualTiebreak: false, manualRank: null,
  })),
};

function render(canWithdraw: boolean, fixture = group): string {
  return renderToStaticMarkup(createElement(GroupCard, {
    group: fixture, canUpdate: true, canWithdraw, draft: false, flaggedIds: new Set<string>(),
    call: async <T>(operation: () => Promise<T>) => operation(),
    report: () => undefined, onChanged: async () => undefined, onTiebreak: () => undefined, onWithdraw: () => undefined,
  }));
}

describe('published group withdrawal controls', () => {
  it('renders one named native button for every active group entrant', () => {
    const html = render(true);
    expect(html).toContain('aria-label="Rút Pair one khỏi bảng A"');
    expect(html).toContain('aria-label="Rút Pair two khỏi bảng A"');
    expect(html.match(/aria-label="Rút /g)).toHaveLength(2);
  });

  it('does not offer withdrawal for an entrant that has already withdrawn', () => {
    expect(render(true)).not.toContain('aria-label="Rút Pair withdrawn khỏi bảng A"');
  });

  it('renders no withdrawal controls when the parent denies the capability', () => {
    const html = render(false);
    expect(html).not.toContain('Rút khỏi bảng');
    expect(html).not.toContain('aria-label="Rút ');
  });

  it('does not invent an action for a stale standing without a group member', () => {
    const fixture = { ...group, members: group.members.filter((member) => member.entryId !== 'one') };
    expect(render(true, fixture)).not.toContain('aria-label="Rút Pair one khỏi bảng A"');
  });
});
