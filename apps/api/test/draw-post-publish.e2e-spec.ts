import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { settleDeferredWalkover } from '../src/modules/draws/knockout-walkover.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule, finishGroupMatches, slotWinner } from './support/group-test-helpers.js';

describe('draw post-publish operations and group-fed knockout (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  const ruleIds: string[] = [];

  const sub = (code: string) => fx.subEvents[code]!;
  const post = (path: string, body: object = {}, cookie = adminCookie) => kit.write('post', `${API}${path}`, cookie, body);
  const generate = (code: string, body: object) => post(`/sub-events/${sub(code)}/draws`, body);
  const audits = (entityId: string, action: string) => kit.prisma.auditLog.findMany({ where: { entityId, action } });
  const draw = (id: string) => kit.prisma.draw.findUniqueOrThrow({ where: { id } });
  const matchesOf = (drawId: string) =>
    kit.prisma.match.findMany({ where: { drawId }, include: { round: true }, orderBy: [{ round: { number: 'asc' } }, { orderInRound: 'asc' }] });
  const entryStatus = async (id: string) => kit.prisma.entry.findUniqueOrThrow({ where: { id }, select: { status: true, seed: true } });
  const roundOneReal = async (drawId: string) =>
    (await matchesOf(drawId)).filter((m) => m.round.number === 1 && m.resultType === null);

  /** Everything an operation could touch, to prove a dry run wrote nothing. */
  const snapshot = async (drawId: string) =>
    JSON.stringify({
      draw: await draw(drawId),
      matches: (await matchesOf(drawId)).map(({ updatedAt: _u, ...m }) => m),
      positions: await kit.prisma.bracketPosition.findMany({ where: { drawId }, orderBy: [{ section: 'asc' }, { position: 'asc' }] }),
      entries: await kit.prisma.entry.findMany({ where: { subEvent: { draws: { some: { id: drawId } } } }, orderBy: { id: 'asc' } }),
      standings: await kit.prisma.groupStanding.findMany({ where: { group: { drawId } }, orderBy: [{ groupId: 'asc' }, { entryId: 'asc' }] }),
      audits: await kit.prisma.auditLog.count({ where: { entityId: drawId } }),
    });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'WS', 'MD', 'XD']);
    players = new DrawFixtureKit(kit, adminCookie, fx);
  }, 120_000);

  afterAll(async () => {
    if (kit) {
      const draws = await kit.prisma.draw.findMany({ where: { subEventId: { in: Object.values(fx?.subEvents ?? {}) } }, select: { id: true, groups: { select: { id: true } } } });
      const entityIds = draws.flatMap((d) => [d.id, ...d.groups.map((g) => g.id)]);
      await kit.prisma.draw.deleteMany({ where: { id: { in: draws.map((d) => d.id) } } });
      await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
      await kit.prisma.eventMatchCounter.deleteMany({ where: { eventId: fx?.eventId } });
      await cleanupFixtures(kit, fx);
      await kit.prisma.groupScoringRule.deleteMany({ where: { id: { in: ruleIds } } });
      await kit.close();
    }
  }, 60_000);

  describe('knockout: unpublish and replace-entry', () => {
    let msEntries: string[];
    let spare: string[];
    let drawId: string;
    let version: number;

    beforeAll(async () => {
      msEntries = await players.addEntries(sub('MS'), 0, 6, { seeds: 2 });
      const created = await generate('MS', { kind: 'MAIN', seedCount: 2 }).expect(201);
      drawId = created.body.data.id;
      expect(created.body.data.byeCount).toBe(2);
      version = (await post(`/draws/${drawId}/publish`, { expectedVersion: 0 }).expect(200)).body.data.version;
      spare = await players.addEntries(sub('MS'), 6, 3);
    });

    it('requires a reason unless dryRun, and validates it when given', async () => {
      const bad = await post(`/draws/${drawId}/unpublish`, { expectedVersion: version }).expect(422);
      expect(bad.body.error.fields).toHaveProperty('reason');
      await post(`/draws/${drawId}/unpublish`, { expectedVersion: version, reason: 'ab' }).expect(422);
      await post(`/draws/${drawId}/unpublish`, { expectedVersion: version, reason: 'x'.repeat(501), dryRun: true }).expect(422);
      await post(`/draws/${drawId}/unpublish`, { expectedVersion: version, reason: '  ab  ', dryRun: true }).expect(422);
      const preview = await post(`/draws/${drawId}/unpublish`, { expectedVersion: version, dryRun: true }).expect(200);
      expect(preview.body.data).toEqual({ allowed: true, impacts: [{ type: 'UNPUBLISH' }] });
    });

    it('is ADMIN-only and rejects stale versions even for dry runs', async () => {
      const body = { expectedVersion: version, reason: 'operator try', dryRun: true };
      await post(`/draws/${drawId}/unpublish`, body, operatorCookie).expect(403);
      await post(`/draws/${drawId}/replace-entry`, { ...body, positionId: drawId, newEntryId: drawId }, operatorCookie).expect(403);
      await post(`/draws/${drawId}/withdraw-entry`, { ...body, entryId: drawId }, operatorCookie).expect(403);
      const stale = await post(`/draws/${drawId}/unpublish`, { ...body, expectedVersion: version + 5 }).expect(409);
      expect(stale.body.error).toMatchObject({ code: 'DRAW_VERSION_CONFLICT', currentVersion: version });
    });

    it('stays unlocked with only BYE results; a LIVE real match blocks unpublish and swap, not replace at an unplayed position', async () => {
      expect((await kit.get(`${API}/draws/${drawId}/bracket`, adminCookie)).body.data.locked).toBe(false);
      const [live, other] = await roundOneReal(drawId);
      await kit.prisma.match.update({ where: { id: live!.id }, data: { status: 'LIVE' } });

      const before = await snapshot(drawId);
      const blocked = await post(`/draws/${drawId}/unpublish`, { expectedVersion: version, reason: 'redo draw' }).expect(409);
      expect(blocked.body.error.code).toBe('DRAW_STRUCTURE_LOCKED');
      const dry = await post(`/draws/${drawId}/unpublish`, { expectedVersion: version, dryRun: true }).expect(200);
      expect(dry.body.data).toEqual({ allowed: false, blockedCode: 'DRAW_STRUCTURE_LOCKED', impacts: [] });
      const positions = await kit.prisma.bracketPosition.findMany({ where: { drawId }, orderBy: { position: 'asc' } });
      expect((await post(`/draws/${drawId}/swap`, { positionA: positions[0]!.id, positionB: positions[2]!.id, expectedVersion: version }).expect(409)).body.error.code).toBe('DRAW_NOT_DRAFT');
      expect(await snapshot(drawId)).toBe(before);

      const playedPosition = positions.find((p) => p.entryId === live!.side1EntryId)!;
      const played = await post(`/draws/${drawId}/replace-entry`, { positionId: playedPosition.id, newEntryId: spare[0], reason: 'late swap', expectedVersion: version }).expect(409);
      expect(played.body.error.code).toBe('POSITION_ALREADY_PLAYED');

      const target = positions.find((p) => p.entryId === other!.side1EntryId)!;
      const body = { positionId: target.id, newEntryId: spare[0], reason: 'player injured', expectedVersion: version };
      const snap = await snapshot(drawId);
      const preview = await post(`/draws/${drawId}/replace-entry`, { ...body, dryRun: true, reason: undefined }).expect(200);
      expect(preview.body.data).toMatchObject({ allowed: true, impacts: [{ type: 'REPLACE_SIDE', matchNo: other!.matchNo, removed: { id: other!.side1EntryId }, added: { id: spare[0] } }] });
      expect(await snapshot(drawId)).toBe(snap);

      const done = await post(`/draws/${drawId}/replace-entry`, body).expect(200);
      expect(done.body.data.draw.version).toBe(version + 1);
      version += 1;
      expect(done.body.data.impacts).toHaveLength(1);
      expect((await kit.prisma.bracketPosition.findUniqueOrThrow({ where: { id: target.id } })).entryId).toBe(spare[0]);
      expect((await kit.prisma.match.findUniqueOrThrow({ where: { id: other!.id } })).side1EntryId).toBe(spare[0]);
      const [row] = await audits(drawId, 'draw.replaceEntry');
      expect(row!.reason).toBe('player injured');
      expect(row!.after).toMatchObject({ newEntryId: spare[0], impacts: [{ type: 'REPLACE_SIDE' }] });
    });

    it('rejects ineligible replacements and non-replaceable positions', async () => {
      const positions = await kit.prisma.bracketPosition.findMany({ where: { drawId }, orderBy: { position: 'asc' } });
      const bye = positions.find((p) => p.source === 'BYE')!;
      const free = positions.find((p) => p.source === 'ENTRY' && p.entryId && !spare.includes(p.entryId))!;
      const send = (positionId: string, newEntryId: string) => post(`/draws/${drawId}/replace-entry`, { positionId, newEntryId, reason: 'check', expectedVersion: version });
      expect((await send(bye.id, spare[1]!).expect(422)).body.error.code).toBe('POSITION_NOT_REPLACEABLE');
      expect((await send(free.id, msEntries[0]!).expect(422)).body.error.code).toBe('ENTRY_NOT_ELIGIBLE');
      await kit.prisma.entry.update({ where: { id: spare[2]! }, data: { status: 'WITHDRAWN' } });
      expect((await send(free.id, spare[2]!).expect(422)).body.error.code).toBe('ENTRY_NOT_ELIGIBLE');
      expect((await send(drawId, spare[1]!).expect(422)).body.error.code).toBe('POSITION_NOT_FOUND');
    });

    it('replaces at a BYE-advanced position in both the BYE match and the next match', async () => {
      const seeded = msEntries[0]!;
      const positions = await kit.prisma.bracketPosition.findMany({ where: { drawId } });
      const position = positions.find((p) => p.entryId === seeded)!;
      const res = await post(`/draws/${drawId}/replace-entry`, { positionId: position.id, newEntryId: spare[1], reason: 'seed replaced', expectedVersion: version }).expect(200);
      version += 1;
      expect(res.body.data.impacts.map((i: { roundCode: string }) => i.roundCode)).toHaveLength(2);
      const after = await matchesOf(drawId);
      expect(after.filter((m) => m.side1EntryId === seeded || m.side2EntryId === seeded)).toHaveLength(0);
      expect(after.filter((m) => m.side1EntryId === spare[1] || m.side2EntryId === spare[1]).map((m) => m.round.number).sort()).toEqual([1, 2]);
    });

    it('unpublishes once the match is released, with audit; a second unpublish and replace on a draft are refused', async () => {
      await kit.prisma.match.updateMany({ where: { drawId, status: 'LIVE' }, data: { status: 'SCHEDULED' } });
      const res = await post(`/draws/${drawId}/unpublish`, { expectedVersion: version, reason: 'redo the draw' }).expect(200);
      expect(res.body.data.draw).toMatchObject({ status: 'DRAFT', publishedAt: null, version: version + 1 });
      expect(res.body.data.impacts).toEqual([{ type: 'UNPUBLISH' }]);
      version += 1;
      const [row] = await audits(drawId, 'draw.unpublish');
      expect(row).toMatchObject({ reason: 'redo the draw' });
      expect((await post(`/draws/${drawId}/unpublish`, { expectedVersion: version, reason: 'again' }).expect(409)).body.error.code).toBe('DRAW_NOT_PUBLISHED');
      const positions = await kit.prisma.bracketPosition.findMany({ where: { drawId } });
      expect((await post(`/draws/${drawId}/replace-entry`, { positionId: positions[0]!.id, newEntryId: spare[0], reason: 'draft', expectedVersion: version }).expect(409)).body.error.code).toBe('DRAW_NOT_PUBLISHED');
    });
  });

  describe('knockout: withdraw-entry', () => {
    let entries: string[];
    let drawId: string;
    let version: number;
    const inMatch = (matches: Awaited<ReturnType<typeof matchesOf>>, entryId: string, round: number) =>
      matches.find((m) => m.round.number === round && (m.side1EntryId === entryId || m.side2EntryId === entryId))!;

    beforeAll(async () => {
      entries = await players.addEntries(sub('WS'), 0, 6, { seeds: 2 });
      drawId = (await generate('WS', { kind: 'MAIN', seedCount: 2 }).expect(201)).body.data.id;
      version = (await post(`/draws/${drawId}/publish`, { expectedVersion: 0 }).expect(200)).body.data.version;
    });

    it('marks a deferred WALKOVER when the opponent is unknown, then completes it and cascades when the opponent arrives', async () => {
      const seed1 = entries[0]!;
      const snap = await snapshot(drawId);
      const preview = await post(`/draws/${drawId}/withdraw-entry`, { entryId: seed1, expectedVersion: version, dryRun: true }).expect(200);
      expect(preview.body.data.allowed).toBe(true);
      expect(preview.body.data.impacts).toMatchObject([{ type: 'WALKOVER', roundCode: 'SF', removed: { id: seed1 } }]);
      expect(preview.body.data.impacts[0].beneficiary).toBeUndefined();
      expect(await snapshot(drawId)).toBe(snap);

      const real = await post(`/draws/${drawId}/withdraw-entry`, { entryId: seed1, reason: 'injury', expectedVersion: version }).expect(200);
      version = real.body.data.draw.version;
      expect(await entryStatus(seed1)).toEqual({ status: 'WITHDRAWN', seed: null });
      let all = await matchesOf(drawId);
      const pending = inMatch(all, seed1, 2);
      const emptySide = pending.side1EntryId === seed1 ? 2 : 1;
      expect(pending).toMatchObject({ status: 'SCHEDULED', resultType: 'WALKOVER', winnerSide: emptySide });
      expect((await audits(drawId, 'draw.withdrawEntry'))[0]!.reason).toBe('injury');
      expect((await post(`/draws/${drawId}/withdraw-entry`, { entryId: seed1, reason: 'again', expectedVersion: version }).expect(409)).body.error.code).toBe('ENTRY_ALREADY_WITHDRAWN');

      const feeder = all.find((m) => m.nextMatchId === pending.id && m.resultType === null)!;
      const leaver = feeder.side1EntryId!;
      const opponent = feeder.side2EntryId!;
      const direct = await post(`/draws/${drawId}/withdraw-entry`, { entryId: leaver, reason: 'no show', expectedVersion: version }).expect(200);
      version = direct.body.data.draw.version;
      expect(direct.body.data.impacts).toMatchObject([{ type: 'WALKOVER', beneficiary: { id: opponent }, removed: { id: leaver } }]);
      all = await matchesOf(drawId);
      expect(all.find((m) => m.id === feeder.id)).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: 2 });
      expect(all.find((m) => m.id === pending.id)).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: emptySide });
      const final = all.find((m) => m.id === pending.nextMatchId)!;
      expect(pending.nextMatchSide === 1 ? final.side1EntryId : final.side2EntryId).toBe(opponent);
    });

    it('lets phase 07 complete a pending walkover by calling settleDeferredWalkover after advancing the opponent', async () => {
      const seed2 = entries[1]!;
      await post(`/draws/${drawId}/withdraw-entry`, { entryId: seed2, reason: 'visa', expectedVersion: version }).expect(200);
      let all = await matchesOf(drawId);
      const pending = inMatch(all, seed2, 2);
      const emptySide = pending.side1EntryId === seed2 ? 2 : 1;
      const feeder = all.find((m) => m.nextMatchId === pending.id && m.resultType === null)!;
      const winner = feeder.side1EntryId!;
      await kit.prisma.match.update({ where: { id: feeder.id }, data: { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1 } });
      await kit.prisma.match.update({ where: { id: pending.id }, data: { [emptySide === 1 ? 'side1EntryId' : 'side2EntryId']: winner } });
      await kit.prisma.$transaction((tx) => settleDeferredWalkover(tx, pending.id));
      all = await matchesOf(drawId);
      expect(all.find((m) => m.id === pending.id)).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER' });
      const final = all.find((m) => m.id === pending.nextMatchId)!;
      expect(pending.nextMatchSide === 1 ? final.side1EntryId : final.side2EntryId).toBe(winner);
    });
  });

  describe('group withdrawal policies', () => {
    let rule: { id: string };
    let entries: string[];
    let drawId: string;
    let groupId: string;
    let version: number;
    const groupMatches = () => kit.prisma.match.findMany({ where: { groupId }, orderBy: { matchNo: 'asc' } });
    const withdraw = (entryId: string, extra: object = {}) => post(`/draws/${drawId}/withdraw-entry`, { entryId, expectedVersion: version, reason: 'withdrawn', ...extra });

    beforeAll(async () => {
      rule = await createScoringRule(kit, fx.tag, null);
      ruleIds.push(rule.id);
      await kit.prisma.subEvent.update({ where: { id: sub('MD') }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: rule.id } });
      entries = await players.addEntries(sub('MD'), 0, 4);
      drawId = (await generate('MD', { kind: 'GROUP' }).expect(201)).body.data.id;
      version = (await post(`/draws/${drawId}/publish`, { expectedVersion: 0 }).expect(200)).body.data.version;
      groupId = (await kit.prisma.group.findFirstOrThrow({ where: { drawId } })).id;
    });

    it('blocks with WITHDRAWAL_POLICY_MISSING while the rule has no policy', async () => {
      const dry = await withdraw(entries[3]!, { dryRun: true }).expect(200);
      expect(dry.body.data).toEqual({ allowed: false, blockedCode: 'WITHDRAWAL_POLICY_MISSING', impacts: [] });
      expect((await withdraw(entries[3]!).expect(409)).body.error.code).toBe('WITHDRAWAL_POLICY_MISSING');
      expect(await entryStatus(entries[3]!)).toMatchObject({ status: 'CONFIRMED' });
    });

    it('KEEP_PLAYED_RESULTS: keeps played results, remaining matches become walkovers lost by the leaver, table recomputed', async () => {
      await kit.prisma.groupScoringRule.update({ where: { id: rule.id }, data: { withdrawalPolicy: 'KEEP_PLAYED_RESULTS' } });
      const leaver = entries[3]!;
      const own = (await groupMatches()).filter((m) => m.side1EntryId === leaver || m.side2EntryId === leaver);
      const played = own[0]!;
      await kit.prisma.match.update({ where: { id: played.id }, data: { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: played.side1EntryId === leaver ? 1 : 2 } });

      const snap = await snapshot(drawId);
      const preview = await withdraw(leaver, { dryRun: true, reason: undefined }).expect(200);
      expect(preview.body.data.allowed).toBe(true);
      const types = preview.body.data.impacts.map((i: { type: string }) => i.type);
      expect(types.filter((t: string) => t === 'WALKOVER')).toHaveLength(2);
      expect(types).toContain('STANDINGS_RECOMPUTE');
      expect(await snapshot(drawId)).toBe(snap);

      const groupVersion = (await kit.prisma.group.findUniqueOrThrow({ where: { id: groupId } })).version;
      const res = await withdraw(leaver).expect(200);
      version = res.body.data.draw.version;
      const after = await groupMatches();
      expect(after.find((m) => m.id === played.id)).toMatchObject({ resultType: 'NORMAL', isVoided: false });
      for (const m of own.slice(1)) {
        const row = after.find((x) => x.id === m.id)!;
        expect(row).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: m.side1EntryId === leaver ? 2 : 1 });
      }
      expect((await kit.prisma.group.findUniqueOrThrow({ where: { id: groupId } })).version).toBe(groupVersion + 1);
      const standing = await kit.prisma.groupStanding.findUniqueOrThrow({ where: { groupId_entryId: { groupId, entryId: leaver } } });
      expect(standing).toMatchObject({ played: 3, won: 1, lost: 2 });
      expect(await entryStatus(leaver)).toEqual({ status: 'WITHDRAWN', seed: null });
    });

    it('VOID_ALL_RESULTS: every group match of the leaver is voided and drops out of the table', async () => {
      await kit.prisma.groupScoringRule.update({ where: { id: rule.id }, data: { withdrawalPolicy: 'VOID_ALL_RESULTS' } });
      const leaver = entries[2]!;
      const res = await withdraw(leaver).expect(200);
      version = res.body.data.draw.version;
      expect(res.body.data.impacts.filter((i: { type: string }) => i.type === 'VOID_MATCH')).toHaveLength(3);
      const own = (await groupMatches()).filter((m) => m.side1EntryId === leaver || m.side2EntryId === leaver);
      expect(own).toHaveLength(3);
      expect(own.every((m) => m.isVoided)).toBe(true);
      const standing = await kit.prisma.groupStanding.findUniqueOrThrow({ where: { groupId_entryId: { groupId, entryId: leaver } } });
      expect(standing.played).toBe(0);
      const view = await kit.get(`${API}/draws/${drawId}/groups`, adminCookie).expect(200);
      expect(view.body.data.groups[0].standings).toHaveLength(4);
    });
  });

  describe('group to knockout', () => {
    let entries: string[];
    let groupDrawId: string;
    let mainId: string;
    let groups: { id: string; code: string; version: number; members: { entryId: string }[] }[];
    const groupView = async () => (await kit.get(`${API}/draws/${groupDrawId}/groups`, adminCookie)).body.data.groups as typeof groups;

    beforeAll(async () => {
      const rule = await createScoringRule(kit, `${fx.tag}x`, 'KEEP_PLAYED_RESULTS');
      ruleIds.push(rule.id);
      await kit.prisma.subEvent.update({ where: { id: sub('XD') }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: rule.id } });
      entries = await players.addEntries(sub('XD'), 0, 12);
    });

    it('generates the group-fed MAIN only after the GROUP draw is published, runner-ups opposite their group winner', async () => {
      expect((await generate('XD', { kind: 'MAIN' }).expect(422)).body.error.code).toBe('KIND_NOT_ALLOWED');
      const created = await generate('XD', { kind: 'GROUP', groupCount: 4, advancePerGroup: 2 }).expect(201);
      groupDrawId = created.body.data.id;
      expect((await generate('XD', { kind: 'MAIN' }).expect(409)).body.error.code).toBe('GROUP_DRAW_NOT_PUBLISHED');
      await post(`/draws/${groupDrawId}/publish`, { expectedVersion: 0 }).expect(200);

      const main = await generate('XD', { kind: 'MAIN' }).expect(201);
      mainId = main.body.data.id;
      expect(main.body.data).toMatchObject({ size: 8, byeCount: 0, matchCount: 7 });
      const positions = await kit.prisma.bracketPosition.findMany({ where: { drawId: mainId } });
      expect(positions.every((p) => p.source === 'GROUP_PLACE')).toBe(true);
      const at = (group: string, place: number) =>
        positions.find((p) => (p.sourceRef as { group: string; place: number }).group === group && (p.sourceRef as { place: number }).place === place)!.position;
      for (const code of ['A', 'B', 'C', 'D']) expect(at(code, 1) <= 4).not.toBe(at(code, 2) <= 4);
      groups = await groupView();
    });

    it('refuses to unpublish the GROUP draw while a MAIN exists', async () => {
      const dry = await post(`/draws/${groupDrawId}/unpublish`, { expectedVersion: 1, dryRun: true }).expect(200);
      expect(dry.body.data).toMatchObject({ allowed: false, blockedCode: 'DEPENDENT_DRAW_EXISTS' });
    });

    it('blocks placing while groups are unfinished or a tie is pending, then places 1st and 2nd', async () => {
      const place = () => post(`/draws/${mainId}/place-group-qualifiers`, { expectedVersion: 0 });
      const unfinished = await place().expect(409);
      expect(unfinished.body.error).toMatchObject({ code: 'GROUPS_NOT_FINISHED', pendingGroups: ['A', 'B', 'C', 'D'] });

      for (const g of groups.filter((x) => x.code !== 'C')) await finishGroupMatches(kit, g.id, await slotWinner(kit, g.id));
      expect((await place().expect(409)).body.error).toMatchObject({ code: 'GROUPS_NOT_FINISHED', pendingGroups: ['C'] });

      const c = groups.find((g) => g.code === 'C')!;
      const [m1, m2, m3] = c.members.map((m) => m.entryId);
      const cyclic = new Map([[`${m1}|${m2}`, m1], [`${m2}|${m3}`, m2], [`${m1}|${m3}`, m3]]);
      await finishGroupMatches(kit, c.id, (a, b) => cyclic.get(`${a}|${b}`) ?? cyclic.get(`${b}|${a}`)!);
      const tie = await place().expect(409);
      expect(tie.body.error).toMatchObject({ code: 'MANUAL_TIEBREAK_PENDING', groups: ['C'] });

      const base = { reason: 'drawing of lots result', expectedVersion: 0 };
      const patch = (body: object, cookie = adminCookie) => kit.write('patch', `${API}/groups/${c.id}/manual-ranks`, cookie, body);
      const before = await kit.prisma.groupStanding.findMany({ where: { groupId: c.id } });
      expect((await patch({ ...base, ranks: { [m1!]: 1, [m2!]: 2 } }).expect(422)).body.error.code).toBe('INVALID_MANUAL_RANKS');
      expect((await patch({ ...base, ranks: { [m1!]: 1, [m2!]: 1, [m3!]: 2 } }).expect(422)).body.error.code).toBe('INVALID_MANUAL_RANKS');
      expect((await kit.prisma.group.findUniqueOrThrow({ where: { id: c.id } })).version).toBe(0);
      expect(await kit.prisma.groupStanding.findMany({ where: { groupId: c.id } })).toEqual(expect.arrayContaining(before));
      await patch({ ...base, reason: 'x', ranks: {} }).expect(422);
      await patch({ ...base, ranks: { [m1!]: 1, [m2!]: 2, [m3!]: 3 } }, operatorCookie).expect(403);
      const stale = await patch({ ...base, expectedVersion: 7, ranks: { [m1!]: 1, [m2!]: 2, [m3!]: 3 } }).expect(409);
      expect(stale.body.error).toMatchObject({ code: 'GROUP_VERSION_CONFLICT', currentVersion: 0 });

      const ok = await patch({ ...base, ranks: { [m1!]: 1, [m2!]: 2, [m3!]: 3 } }).expect(200);
      expect(ok.body.data.version).toBe(1);
      expect(ok.body.data.standings.map((s: { entryId: string; manualRank: number }) => [s.entryId, s.manualRank])).toEqual([[m1, 1], [m2, 2], [m3, 3]]);
      const [row] = await audits(c.id, 'group.manualRanks');
      expect(row!.reason).toBe('drawing of lots result');

      const placed = await place().expect(200);
      expect(placed.body.data.version).toBe(1);
      const positions = await kit.prisma.bracketPosition.findMany({ where: { drawId: mainId } });
      expect(positions.every((p) => p.source === 'ENTRY' && p.entryId)).toBe(true);
      const winners = new Set(positions.map((p) => p.entryId));
      expect(winners.has(m1!) && winners.has(m2!) && !winners.has(m3!)).toBe(true);
      const r1 = await kit.prisma.match.findMany({ where: { drawId: mainId, round: { number: 1 } } });
      expect(r1.every((m) => m.side1EntryId && m.side2EntryId && !m.side1Source && !m.side2Source)).toBe(true);
      expect((await audits(mainId, 'draw.placeGroupQualifiers'))).toHaveLength(1);
      expect((await post(`/draws/${mainId}/place-group-qualifiers`, { expectedVersion: 1 }).expect(409)).body.error.code).toBe('NO_GROUP_PLACE_SLOTS');
      const late = await post(`/draws/${groupDrawId}/withdraw-entry`, { entryId: m3, reason: 'late', expectedVersion: 1, dryRun: true }).expect(200);
      expect(late.body.data).toMatchObject({ allowed: false, blockedCode: 'GROUPS_ALREADY_PLACED' });
      expect(entries).toHaveLength(12);
    });
  });

  it('suggest-seeds answers unavailable until the ranking phase', async () => {
    const res = await post(`/sub-events/${sub('MS')}/entries/suggest-seeds`).expect(200);
    expect(res.body.data).toEqual({ available: false, suggestions: [] });
    await post(`/sub-events/${sub('MS')}/entries/suggest-seeds`, {}, operatorCookie).expect(403);
  });
});
