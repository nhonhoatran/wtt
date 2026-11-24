import { expect, test } from '@playwright/test';
import { addContents, addExistingSingles, addReplacementEntry, createEvent, importEntries } from './events-and-imports';
import { createDraw, openDraw, placeQualifiers, publishEvent, replaceUnplayed, type DrawFixture } from './draws';
import { amendResult, confirmResult, openResult, reopenResult, resultRows, type MatchDetail, type ResultRow } from './results';
import { editWinnerRule, publicRanking, publishSnapshot, snapshot } from './rankings';
import { scheduleAndPrint, withdrawGroupEntrant } from './schedule-and-withdraw';
import { closeDrawer, login } from './ui';
import { readFullUiWorld, saveEvidence, type EventFixture, type RunEvidence } from './world';

test('runs the eight-step tournament workflow through the real admin and operator UI', async ({ page, browser }, info) => {
  const world = readFullUiWorld();
  const evidence: RunEvidence = {
    runId: world.runId, project: info.project.name, events: [], imports: [], draws: [], snapshots: [], sessions: [], steps: [], latencies: [], status: 'RUNNING',
  };
  await saveEvidence(evidence);
  const options = { viewport: page.viewportSize(), locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
    isMobile: info.project.name === 'mobile', hasTouch: info.project.name === 'mobile' };
  const operatorContext = await browser.newContext(options);
  const publicContext = await browser.newContext(options);
  const operator = await operatorContext.newPage();
  const publicPage = await publicContext.newPage();
  const journal = async (step: number, name: string, detail: unknown) => {
    evidence.steps.push({ step, name, completedAt: new Date().toISOString(), detail });
    await saveEvidence(evidence);
    await page.screenshot({ path: info.outputPath(`step-${step}.png`), fullPage: true });
  };
  const winner = (match: ResultRow): 1 | 2 => match.side1!.displayName.localeCompare(match.side2!.displayName) > 0 ? 1 : 2;
  const play = async (event: EventFixture, code: 'MS' | 'WD', eligible: (match: ResultRow) => boolean): Promise<MatchDetail[]> => {
    const completed: MatchDetail[] = [];
    for (let guard = 0; guard < 100; guard++) {
      const rows = await resultRows(operator, world, event, code);
      const next = rows.find((row) => row.ready && row.status !== 'OFFICIAL' && eligible(row));
      if (!next) return completed;
      const detail = await openResult(operator, next);
      completed.push(await confirmResult(operator, publicPage, world, event, detail, evidence, winner(detail)));
    }
    throw new Error('The fixture exceeded its bounded result-entry loop');
  };
  try {
    let event!: EventFixture;
    let msMain!: DrawFixture; let wdGroup!: DrawFixture; let wdMain!: DrawFixture;
    await test.step('1. ADMIN creates the event and imports 40 singles plus 12 doubles registrations', async () => {
      await login(page, world.adminOrigin, world.users.admin);
      event = await createEvent(page, world, evidence);
      await addContents(page, world, event, evidence);
      await importEntries(page, world, event, evidence, 'MS');
      await importEntries(page, world, event, evidence, 'WD');
      await journal(1, 'Create event, MS qualifying and WD groups, resolve an import decision, commit 40 + 12 rows', { imports: evidence.imports, counts: { MS: 40, WD: 12 } });
    });
    await test.step('2. Draw, publish and replace an unplayed entrant', async () => {
      const ms = event.subEvents.find((row) => row.code === 'MS')!;
      const wd = event.subEvents.find((row) => row.code === 'WD')!;
      await createDraw(page, world, event, evidence, ms, 'QUALIFYING');
      msMain = await createDraw(page, world, event, evidence, ms, 'MAIN');
      wdGroup = await createDraw(page, world, event, evidence, wd, 'GROUP');
      wdMain = await createDraw(page, world, event, evidence, wd, 'MAIN');
      await publishEvent(page, world, event);
      await addReplacementEntry(page, world, event);
      await replaceUnplayed(page, world, event, msMain);
      await journal(2, 'Publish four draws and event; replace an unplayed direct entrant', { draws: evidence.draws });
    });
    await test.step('3. Create a session, place three matches and print real match sheets', async () => {
      await scheduleAndPrint(page, world, event, evidence, info);
      await journal(3, 'Create session, manually schedule three matches, render A4 match sheets', { sessions: evidence.sessions, pdf: 'match-sheets.pdf' });
    });
    let upstream!: MatchDetail;
    let reservedGroup!: ResultRow;
    await test.step('4. RESULTS_OPERATOR enters ready first-round results, amends a score and is denied reopen', async () => {
      await login(operator, world.adminOrigin, world.users.operator);
      await openDraw(operator, world, event, event.subEvents.find((row) => row.code === 'WD')!, 'GROUP');
      await expect(operator.getByRole('button', { name: /^Rút .+ khỏi bảng / })).toHaveCount(0);
      const rows = await resultRows(operator, world, event, 'MS');
      const first = rows.find((row) => row.drawKind === 'QUALIFYING' && row.ready)!;
      expect(first).toBeDefined();
      upstream = await confirmResult(operator, publicPage, world, event, await openResult(operator, first), evidence, winner(first));
      const official = await resultRows(operator, world, event, 'MS', true);
      upstream = await amendResult(operator, await openResult(operator, official.find((row) => row.id === upstream.id)!), publicPage, world, event, evidence);
      const denied = await operatorContext.request.post(`${world.adminOrigin}/api/v1/admin/matches/${upstream.id}/reopen`, {
        headers: { Origin: world.adminOrigin }, data: { expectedVersion: upstream.version, reason: 'Verify that an operator cannot reopen this fixture match.' },
      });
      expect(denied.status(), 'Supplemental authorization check, because the forbidden UI action is hidden').toBe(403);
      evidence.negativeOperatorReopen = { status: denied.status(), method: 'supplemental-browser-context-request' };
      await closeDrawer(operator);
      const firstRound = first.roundCode;
      const qualifiers = await play(event, 'MS', (row) => row.drawKind === 'QUALIFYING' && row.roundCode === firstRound);
      expect(qualifiers).toHaveLength(15);
      const groupRows = await resultRows(operator, world, event, 'WD');
      reservedGroup = groupRows.filter((row) => row.drawKind === 'GROUP' && row.ready).at(-1)!;
      expect(reservedGroup).toBeDefined();
      const groups = await play(event, 'WD', (row) => row.drawKind === 'GROUP' && row.id !== reservedGroup.id);
      expect(groups).toHaveLength(11);
      await journal(4, 'Operator UI results, same-winner score amendment, hidden reopen and supplemental 403', {
        firstQualifyingRound: firstRound, confirmedAfterFirst: qualifiers.length, groupConfirmed: groups.length,
        unplayedDownstreamReservedForStep5: true, reservedGroupMatchNo: reservedGroup.matchNo,
        sequencing: 'Later qualifying rounds and MAIN stay unplayed until the reopen/withdraw and placement steps.',
      });
    });
    await test.step('5. ADMIN previews and reopens an upstream match with password step-up, reconfirms and withdraws a group entrant', async () => {
      const official = await resultRows(page, world, event, 'MS', true);
      const detail = await openResult(page, official.find((row) => row.id === upstream.id)!);
      const reopened = await reopenResult(page, world, detail);
      const previousWinner = detail.winnerSide;
      if (previousWinner !== 1 && previousWinner !== 2) throw new Error('The original result must have a winner before reconfirmation');
      upstream = await confirmResult(page, publicPage, world, event, reopened, evidence, previousWinner, 'reconfirm-after-reopen');
      await withdrawGroupEntrant(page, world, event, wdGroup, reservedGroup.side1!.displayName, reservedGroup.groupCode!, reservedGroup.matchNo);
      const groupOfficial = await resultRows(operator, world, event, 'WD', true);
      const walkover = await openResult(operator, groupOfficial.find((row) => row.id === reservedGroup.id)!);
      expect(walkover.status).toBe('OFFICIAL');
      expect(walkover.resultType).toBe('WALKOVER');
      await closeDrawer(operator);
      await journal(5, 'Preview downstream impact, password step-up, reopen and reconfirm; configured group withdrawal', { reopenedMatchNo: upstream.matchNo, walkoverMatchNo: reservedGroup.matchNo, policy: 'KEEP_PLAYED_RESULTS (private sample reference)' });
    });
    let msFinal!: MatchDetail;
    await test.step('6. Complete qualifying, place qualifiers and group winners, play both main draws to their finals', async () => {
      const qualifyingFinals = await play(event, 'MS', (row) => row.drawKind === 'QUALIFYING');
      expect(qualifyingFinals).toHaveLength(8);
      expect((await resultRows(operator, world, event, 'MS')).filter((row) => row.drawKind === 'QUALIFYING')).toHaveLength(0);
      expect((await resultRows(operator, world, event, 'WD')).filter((row) => row.drawKind === 'GROUP')).toHaveLength(0);
      await placeQualifiers(page, world, event, msMain);
      await placeQualifiers(page, world, event, wdMain);
      const singles = await play(event, 'MS', (row) => row.drawKind === 'MAIN');
      const doubles = await play(event, 'WD', (row) => row.drawKind === 'MAIN');
      expect(singles).toHaveLength(15);
      expect(doubles).toHaveLength(7);
      msFinal = singles.find((row) => row.roundCode === 'F')!;
      expect(msFinal).toBeDefined();
      expect(doubles.some((row) => row.roundCode === 'F')).toBe(true);
      expect(await resultRows(operator, world, event, 'MS')).toHaveLength(0);
      expect(await resultRows(operator, world, event, 'WD')).toHaveLength(0);
      await journal(6, 'Place eight singles qualifiers and group qualifiers, finish both finals', { singlesMain: singles.length, doublesMain: doubles.length, singlesFinalMatchNo: msFinal.matchNo });
    });
    await test.step('7. Build and publish ranking snapshots and verify public ordering and breakdown', async () => {
      for (const list of [world.ranking.ms, world.ranking.wd]) {
        const built = await snapshot(page, world, list, world.oldEndDate, evidence);
        expect(built.rows[0]!.breakdown.some((row) => row.eventId === event.id && row.stageCode === 'W' && row.points === world.ranking.oldWinnerPoints)).toBe(true);
        await publishSnapshot(page, world, built.id);
        await publicRanking(publicPage, world, list, built.rows, event, world.ranking.oldWinnerPoints);
      }
      await journal(7, 'Publish singles and doubles snapshots; public rank order and frozen breakdown follow private rules', { snapshots: [...evidence.snapshots] });
    });
    await test.step('8. Change one matrix cell effective today and prove old-event points remain while a newly ending event uses the new rule', async () => {
      await editWinnerRule(page, world);
      const newer = await createEvent(page, world, evidence, true);
      await addContents(page, world, newer, evidence, true);
      const champion = msFinal.winnerSide === 1 ? msFinal.side1! : msFinal.side2!;
      const runner = msFinal.winnerSide === 1 ? msFinal.side2! : msFinal.side1!;
      await addExistingSingles(page, world, newer, [champion.displayName, runner.displayName]);
      await createDraw(page, world, newer, evidence, newer.subEvents[0]!, 'MAIN', true);
      await publishEvent(page, world, newer);
      const rows = await resultRows(operator, world, newer, 'MS');
      const detail = await openResult(operator, rows.find((row) => row.ready)!);
      const side = detail.side1!.displayName === champion.displayName ? 1 : 2;
      await confirmResult(operator, publicPage, world, newer, detail, evidence, side);
      const built = await snapshot(page, world, world.ranking.ms, world.today, evidence);
      const winnerRow = built.rows.find((row) => row.player.fullName === champion.displayName)!;
      expect(winnerRow).toBeDefined();
      expect(winnerRow.breakdown.find((row) => row.eventId === event.id && row.stageCode === 'W')?.points).toBe(world.ranking.oldWinnerPoints);
      expect(winnerRow.breakdown.find((row) => row.eventId === newer.id && row.stageCode === 'W')?.points).toBe(world.ranking.newWinnerPoints);
      await publishSnapshot(page, world, built.id);
      await publicRanking(publicPage, world, world.ranking.ms, built.rows, newer, world.ranking.newWinnerPoints);
      await journal(8, 'One UI matrix edit changes new event points without changing the previously ended event', { effectiveFrom: world.today, oldWinnerPoints: world.ranking.oldWinnerPoints, newWinnerPoints: world.ranking.newWinnerPoints, snapshotId: built.id });
    });
    evidence.status = 'PASSED';
    expect(evidence.steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  } finally {
    if (evidence.status !== 'PASSED') evidence.status = 'FAILED';
    await saveEvidence(evidence);
    await Promise.all([operatorContext.close(), publicContext.close()]);
  }
});
