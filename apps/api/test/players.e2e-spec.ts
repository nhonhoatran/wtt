import { LocalObjectStorage } from '@kamito/shared/object-storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { playerSettings } from '@kamito/shared';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API, cleanupFixtures, createEventFixtures, createPlayer, type Fixtures } from './support/entries-fixtures.js';
import {
  deleteMedia,
  loadWorkerProcessors,
  mediaQueue,
  noisyJpeg,
  useTempUploadDir,
  type WorkerMediaModules,
} from './support/media-test-kit.js';

const MEDIA = '/api/v1/admin/media';

describe('admin players (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let fixtures: Fixtures;
  let prefix: string;
  let digits: number;
  let upload: Awaited<ReturnType<typeof useTempUploadDir>>;
  let worker: WorkerMediaModules;
  let workerDeps: unknown;
  const queue = mediaQueue();
  const mediaIds: string[] = [];

  beforeAll(async () => {
    upload = await useTempUploadDir();
    kit = await AuthTestKit.start();
    worker = await loadWorkerProcessors();
    workerDeps = {
      prisma: kit.prisma,
      storage: new LocalObjectStorage(upload.dir),
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      variantWidths: [320, 640, 1280],
      maxBytes: async () => 5 * 1024 * 1024,
    };
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fixtures = await createEventFixtures(kit, adminCookie, ['MS']);
    const settings = kit.app.get(AppSettingsService);
    prefix = await settings.get(playerSettings.codePrefix);
    digits = await settings.get(playerSettings.codeDigits);
  });

  afterAll(async () => {
    await cleanupFixtures(kit, fixtures);
    await deleteMedia(kit.prisma, mediaIds);
    for (const id of mediaIds) await (await queue.getJob(`media-${id}`))?.remove().catch(() => undefined);
    await queue.close();
    await kit.close();
    await upload.cleanup();
  });

  it('creates with a code from the settings prefix, sequential digits and derived name fields', async () => {
    const name = `Nguyễn Đức ${fixtures.tag}`;
    const first = await createPlayer(kit, adminCookie, fixtures, { fullName: `  ${name}  `, gender: 'MALE', birthYear: 1999 });
    const second = await createPlayer(kit, adminCookie, fixtures, { fullName: 'Lê Văn Khác ' + fixtures.tag, gender: 'MALE' });

    // codeDigits is a minimum width (padStart); a long-lived dev DB sequence can exceed it.
    expect(first.code).toMatch(new RegExp(`^${prefix}\\d{${digits},}$`));
    const number = (code: string) => Number(code.slice(prefix.length));
    expect(number(second.code)).toBeGreaterThan(number(first.code));
    expect(first.fullName).toBe(name);

    const detail = (await kit.get(`${API}/players/${first.id}`, adminCookie).expect(200)).body.data;
    expect(detail).toMatchObject({
      fullNameEn: `Nguyen Duc ${fixtures.tag}`,
      countryCode: await kit.app.get(AppSettingsService).get(playerSettings.defaultCountryCode),
      birthYear: 1999,
      birthDate: null,
      isActive: true,
      isPublicProfile: false,
      noindex: true,
      mergedInto: null,
      entryCount: 0,
      pairCount: 0,
    });
    const row = await kit.prisma.player.findUniqueOrThrow({ where: { id: first.id } });
    expect(row.normalizedName).toBe(`nguyen duc ${fixtures.tag.toLowerCase()}`);
    const audit = await kit.prisma.auditLog.findFirst({ where: { entityId: first.id, action: 'player.create' } });
    expect(audit).not.toBeNull();
  });

  it('keeps explicit public-profile opt-in and leaves it unchanged when PATCH omits the flag', async () => {
    const created = await kit.write('post', `${API}/players`, adminCookie, {
      fullName: `Đồng Ý Hồ Sơ ${fixtures.tag}`, gender: 'MALE', isPublicProfile: true,
    }).expect(201);
    const player = created.body.data;
    fixtures.playerIds.push(player.id);
    expect(player).toMatchObject({ isPublicProfile: true, noindex: true });
    const updated = await kit.write('patch', `${API}/players/${player.id}`, adminCookie, { club: `CLB ${fixtures.tag}` }).expect(200);
    expect(updated.body.data).toMatchObject({ isPublicProfile: true, noindex: true, club: `CLB ${fixtures.tag}` });
    expect(await kit.prisma.player.findUniqueOrThrow({ where: { id: player.id } })).toMatchObject({ isPublicProfile: true, noindex: true });
  });

  it('suffixes the slug with -2 for the same name', async () => {
    const name = `Trần Cùng Tên ${fixtures.tag}`;
    const a = await createPlayer(kit, adminCookie, fixtures, { fullName: name, gender: 'FEMALE' });
    const b = await createPlayer(kit, adminCookie, fixtures, { fullName: name, gender: 'FEMALE' });
    expect(b.slug).toBe(`${a.slug}-2`);
  });

  it('finds an accented name from a query typed without diacritics, and by code', async () => {
    const player = await createPlayer(kit, adminCookie, fixtures, { fullName: `Đỗ Thị Hương ${fixtures.tag}`, gender: 'FEMALE', club: `CLB ${fixtures.tag}` });
    const byName = await kit.get(`${API}/players?q=${encodeURIComponent(`do thi huong ${fixtures.tag}`)}`, adminCookie).expect(200);
    expect(byName.body.data.map((row: { id: string }) => row.id)).toEqual([player.id]);
    expect(byName.body).toMatchObject({ total: 1, page: 1 });

    const byCode = await kit.get(`${API}/players?q=${player.code.toLowerCase()}`, adminCookie).expect(200);
    expect(byCode.body.data.map((row: { id: string }) => row.id)).toContain(player.id);

    const byClub = await kit.get(`${API}/players?filter[club]=${encodeURIComponent(`clb ${fixtures.tag}`)}&filter[gender]=FEMALE&sort=fullName:asc`, adminCookie).expect(200);
    expect(byClub.body.data).toHaveLength(1);
    await kit.get(`${API}/players?filter[gender]=OTHER`, adminCookie).expect(400);
    await kit.get(`${API}/players?sort=phone:asc`, adminCookie).expect(400);
  });

  it('validates input with per-field messages', async () => {
    const res = await kit.write('post', `${API}/players`, adminCookie, { fullName: '', gender: 'X', birthDate: '2001-02-30' }).expect(422);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['fullName', 'gender', 'birthDate']));
    const mismatch = await kit.write('post', `${API}/players`, adminCookie, { fullName: 'Lệch Năm', gender: 'MALE', birthDate: '2001-02-03', birthYear: 2002 }).expect(422);
    expect(mismatch.body.error.fields).toHaveProperty('birthYear');
    await kit.write('post', `${API}/players`, adminCookie, { fullName: 'Ảnh Lạ', gender: 'MALE', photoMediaId: '00000000-0000-4000-8000-000000000000' }).expect(422);
  });

  it('derives birthYear from birthDate and keeps them consistent on update', async () => {
    const player = await createPlayer(kit, adminCookie, fixtures, { fullName: `Sinh Nhật ${fixtures.tag}`, gender: 'MALE', birthDate: '2008-09-10', birthYear: undefined });
    const detail = (await kit.get(`${API}/players/${player.id}`, adminCookie).expect(200)).body.data;
    expect(detail).toMatchObject({ birthDate: '2008-09-10', birthYear: 2008 });
    const bad = await kit.write('patch', `${API}/players/${player.id}`, adminCookie, { birthYear: 2007 }).expect(422);
    expect(bad.body.error.fields).toHaveProperty('birthYear');
    const moved = await kit.write('patch', `${API}/players/${player.id}`, adminCookie, { birthDate: '2009-01-01' }).expect(200);
    expect(moved.body.data).toMatchObject({ birthDate: '2009-01-01', birthYear: 2009 });
  });

  it('renaming refreshes competitor display names and writes a masked audit diff', async () => {
    const solo = await createPlayer(kit, adminCookie, fixtures, { fullName: `Tên Cũ ${fixtures.tag}`, gender: 'MALE' });
    const partner = await createPlayer(kit, adminCookie, fixtures, { fullName: `Bạn Đôi ${fixtures.tag}`, gender: 'MALE' });
    const single = await kit.write('post', `${API}/sub-events/${fixtures.subEvents.MS}/entries`, adminCookie, { playerIds: [solo.id] }).expect(201);
    expect(single.body.data.competitor.displayName).toBe(`Tên Cũ ${fixtures.tag}`);
    const pair = await kit.prisma.pair.create({
      data: { playerAId: solo.id < partner.id ? solo.id : partner.id, playerBId: solo.id < partner.id ? partner.id : solo.id },
    });
    await kit.prisma.competitor.create({ data: { type: 'PAIR', pairId: pair.id, displayName: 'stale' } });

    const renamed = await kit.write('patch', `${API}/players/${solo.id}`, adminCookie, { fullName: ` Tên  Mới ${fixtures.tag} `, phone: '0901234567' }).expect(200);
    expect(renamed.body.data).toMatchObject({ fullName: `Tên Mới ${fixtures.tag}`, fullNameEn: `Ten Moi ${fixtures.tag}` });

    const soloCompetitor = await kit.prisma.competitor.findUniqueOrThrow({ where: { playerId: solo.id } });
    expect(soloCompetitor.displayName).toBe(`Tên Mới ${fixtures.tag}`);
    const pairCompetitor = await kit.prisma.competitor.findUniqueOrThrow({ where: { pairId: pair.id } });
    expect(pairCompetitor.displayName).toContain(`Tên Mới ${fixtures.tag}`);
    expect(pairCompetitor.displayName).toContain(`Bạn Đôi ${fixtures.tag}`);

    const found = await kit.get(`${API}/players?q=${encodeURIComponent(`ten moi ${fixtures.tag}`)}`, adminCookie).expect(200);
    expect(found.body.data.map((row: { id: string }) => row.id)).toEqual([solo.id]);
    expect(found.body.data[0].entryCount).toBe(1);

    const audit = await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: solo.id, action: 'player.update' } });
    expect(audit.before).toMatchObject({ fullName: `Tên Cũ ${fixtures.tag}` });
    expect(JSON.stringify(audit.after)).not.toContain('0901234567');
  });

  it('refuses to edit a merged profile', async () => {
    const target = await createPlayer(kit, adminCookie, fixtures, { fullName: `Giữ Lại ${fixtures.tag}`, gender: 'MALE' });
    const source = await createPlayer(kit, adminCookie, fixtures, { fullName: `Đã Gộp ${fixtures.tag}`, gender: 'MALE' });
    await kit.prisma.player.update({ where: { id: source.id }, data: { mergedIntoId: target.id, mergedAt: new Date(), isActive: false } });
    const res = await kit.write('patch', `${API}/players/${source.id}`, adminCookie, { club: 'x' }).expect(409);
    expect(res.body.error.code).toBe('PLAYER_MERGED');
    const detail = (await kit.get(`${API}/players/${source.id}`, adminCookie).expect(200)).body.data;
    expect(detail.mergedInto).toMatchObject({ id: target.id, code: target.code });

    const hidden = await kit.get(`${API}/players?q=${encodeURIComponent(`da gop ${fixtures.tag}`)}`, adminCookie).expect(200);
    expect(hidden.body.data).toEqual([]);
    const shown = await kit.get(`${API}/players?filter[merged]=true&q=${encodeURIComponent(`da gop ${fixtures.tag}`)}`, adminCookie).expect(200);
    expect(shown.body.data.map((row: { id: string }) => row.id)).toEqual([source.id]);
  });

  it('lookup returns active, unmerged players with an exact code match first', async () => {
    const man = await createPlayer(kit, adminCookie, fixtures, { fullName: `Tra Cứu Nam ${fixtures.tag}`, gender: 'MALE' });
    const woman = await createPlayer(kit, adminCookie, fixtures, { fullName: `Tra Cứu Nữ ${fixtures.tag}`, gender: 'FEMALE' });
    const idle = await createPlayer(kit, adminCookie, fixtures, { fullName: `Tra Cứu Nghỉ ${fixtures.tag}`, gender: 'MALE' });
    await kit.write('patch', `${API}/players/${idle.id}`, adminCookie, { isActive: false }).expect(200);

    const all = await kit.get(`${API}/players/lookup?q=${fixtures.tag}&limit=20`, operatorCookie).expect(200);
    const allIds = all.body.data.map((row: { id: string }) => row.id);
    expect(allIds).toEqual(expect.arrayContaining([man.id, woman.id]));
    expect(allIds).not.toContain(idle.id);
    expect(all.body.data[0]).toHaveProperty('birthYear');

    const males = await kit.get(`${API}/players/lookup?q=${fixtures.tag}&gender=MALE&limit=20`, adminCookie).expect(200);
    const maleIds = males.body.data.map((row: { id: string }) => row.id);
    expect(maleIds).toContain(man.id);
    expect(maleIds).not.toContain(woman.id);
    expect(maleIds).not.toContain(idle.id);

    const byCode = await kit.get(`${API}/players/lookup?q=${woman.code}&limit=3`, adminCookie).expect(200);
    expect(byCode.body.data[0].id).toBe(woman.id);
    await kit.get(`${API}/players/lookup?limit=21`, adminCookie).expect(422);
  });

  it('sets photoMediaId only from a finished player-photo upload', async () => {
    const jpeg = await noisyJpeg(1400, 1000);
    const intent = await kit.write('post', `${MEDIA}/intents`, adminCookie, { purpose: 'player-photo', contentType: 'image/jpeg', size: jpeg.length }).expect(201);
    const { mediaId } = intent.body.data;
    mediaIds.push(mediaId);
    const photoBody = (name: string) => ({ fullName: `${name} ${fixtures.tag}`, gender: 'FEMALE', photoMediaId: mediaId });

    const early = await kit.write('post', `${API}/players`, adminCookie, photoBody('Ảnh Đang Tải')).expect(422);
    expect(early.body.error.fields).toHaveProperty('photoMediaId');

    await kit.http.put(`${MEDIA}/${mediaId}/content`).set('Origin', kit.origin).set('Cookie', adminCookie).set('Content-Type', 'image/jpeg').send(jpeg).expect(200);
    await kit.write('post', `${MEDIA}/${mediaId}/complete`, adminCookie).expect(200);
    expect(await worker.processImage(workerDeps, mediaId)).toBe('ready');

    const created = await kit.write('post', `${API}/players`, adminCookie, photoBody('Ảnh Đã Xong')).expect(201);
    fixtures.playerIds.push(created.body.data.id);
    expect(created.body.data.photoMediaId).toBe(mediaId);
    const detail = (await kit.get(`${API}/players/${created.body.data.id}`, adminCookie).expect(200)).body.data;
    expect(detail.photoMediaId).toBe(mediaId);
    const asset = await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId }, select: { purpose: true, status: true } });
    expect(asset).toEqual({ purpose: 'player-photo', status: 'READY' });
  });

  it('hides phone, email and birthDate from RESULTS_OPERATOR but keeps them for ADMIN', async () => {
    const created = await kit
      .write('post', `${API}/players`, adminCookie, {
        fullName: `Riêng Tư ${fixtures.tag}`,
        gender: 'MALE',
        birthDate: '2004-03-05',
        phone: '0901234567',
        email: `rieng${fixtures.tag}@example.com`,
      })
      .expect(201);
    const id = created.body.data.id as string;
    fixtures.playerIds.push(id);

    const asAdmin = (await kit.get(`${API}/players/${id}`, adminCookie).expect(200)).body.data;
    expect(asAdmin).toMatchObject({ phone: '0901234567', birthDate: '2004-03-05' });

    const asOperator = (await kit.get(`${API}/players/${id}`, operatorCookie).expect(200)).body.data;
    for (const key of ['phone', 'email', 'birthDate']) expect(asOperator).not.toHaveProperty(key);
    expect(asOperator.birthYear).toBe(2004);

    const list = await kit.get(`${API}/players?q=${encodeURIComponent(`rieng tu ${fixtures.tag}`)}`, operatorCookie).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).not.toHaveProperty('birthDate');
    expect(list.body.data[0].birthYear).toBe(2004);
  });

  it('lets RESULTS_OPERATOR read but not write', async () => {
    await kit.get(`${API}/players`, operatorCookie).expect(200);
    await kit.write('post', `${API}/players`, operatorCookie, { fullName: 'Không Được', gender: 'MALE' }).expect(403);
    await kit.get(`${API}/pairs`, operatorCookie).expect(200);
    await kit.get(`${API}/players/merge/preview?targetId=a&sourceId=b`, operatorCookie).expect(403);
  });
});
