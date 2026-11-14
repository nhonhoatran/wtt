import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import {
  cleanupPublicWorld, ENTRY_ITEM_KEYS, MATCH_CARD_KEYS, privateProfile, publicGet, type PublicWorld, setupPublicWorld, sortedPaths,
} from './support/public-api-kit.js';

const STANDING_KEYS = ['rank', 'side', 'played', 'won', 'lost', 'matchPoints', 'gamesFor', 'gamesAgainst', 'qualified'];
const EVENT_KEYS = ['event', 'event.slug', 'event.name', 'event.nameEn', 'event.timezone'];
const SUB_EVENT_KEYS = ['subEvent', 'subEvent.code', 'subEvent.name', 'subEvent.nameEn'];

describe('public groups and entries API (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let world: PublicWorld;
  let slug: string;
  let secret: string;

  const get = (path: string) => publicGet(kit, secret, `events/${slug}/${path}`);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    world = await setupPublicWorld(kit, cookie);
    slug = world.slug;
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await cleanupPublicWorld(kit, world);
    await kit.close();
  }, 60_000);

  it('serves the group stage with standings and its matches', async () => {
    const { data } = (await get('groups/MD').expect(200)).body;
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].standings).toHaveLength(3);
    expect(data.groups[0].matches).toHaveLength(3);
  });

  it('snapshots the groups field whitelist', async () => {
    const { data } = (await get('groups/MD').expect(200)).body;
    const standing = ['groups[].standings', 'groups[].standings[].side', ...ENTRY_ITEM_KEYS.map((k) => `groups[].standings[].side.${k}`), ...STANDING_KEYS.filter((k) => k !== 'side').map((k) => `groups[].standings[].${k}`)];
    const expected = [
      ...EVENT_KEYS, ...SUB_EVENT_KEYS,
      'groups', 'groups[].code', ...standing,
      // Group fixture matches have no games yet, so no games[] element keys can appear.
      ...MATCH_CARD_KEYS.filter((k) => !k.startsWith('games[]')).map((k) => `groups[].matches[].${k}`),
      'groups[].matches',
    ];
    expect(sortedPaths(data)).toEqual([...new Set(expected)].sort());
  });

  it('flags the voided group match and leaves the rest unvoided', async () => {
    const { matches } = (await get('groups/MD').expect(200)).body.data.groups[0];
    expect(matches.filter((m: { voided: boolean }) => m.voided)).toHaveLength(1);
    expect(matches.filter((m: { voided: boolean }) => !m.voided)).toHaveLength(2);
  });

  it('answers null for a sub-event without a published group draw, a draft draw, or unknown codes', async () => {
    expect((await get('groups/WS').expect(200)).body).toEqual({ data: null });
    expect((await get('groups/WD').expect(200)).body).toEqual({ data: null });
    expect((await get('groups/XX').expect(200)).body).toEqual({ data: null });
    expect((await publicGet(kit, secret, `events/no-such-${world.tag}/groups/MD`).expect(200)).body).toEqual({ data: null });
  });

  it('lists confirmed MAIN entries only: withdrawn player absent, seeds first', async () => {
    const { data } = (await get('entries/MS').expect(200)).body;
    expect(data.total).toBe(5);
    expect(data.stages).toEqual(['MAIN']);
    expect(data.items[0].seed).toBe(1);
    const text = JSON.stringify(data.items);
    expect(text).toContain(`Draw 1 ${world.tag}`);
    expect(text).not.toContain(`Draw 6 ${world.tag}`);
  });

  it('defaults unknown stage values to MAIN and returns nothing for an empty stage', async () => {
    const main = (await get('entries/MS?stage=main').expect(200)).body.data;
    expect((await get('entries/MS?stage=toString').expect(200)).body.data.total).toBe(main.total);
    expect((await get('entries/MS?stage=qualifying').expect(200)).body.data.items).toEqual([]);
  });

  it('snapshots the entry item whitelist', async () => {
    const { data } = (await get('entries/MS').expect(200)).body;
    expect(sortedPaths(data.items)).toEqual(ENTRY_ITEM_KEYS.map((k) => `[].${k}`).sort());
  });

  it('shows the display name, never the hidden legal name or contact data, in entries and groups', async () => {
    const { displayName, legalName, legalNameEn, phone, email } = privateProfile(world.tag);
    const ws = (await get('entries/WS').expect(200)).body.data;
    expect(JSON.stringify(ws.items)).toContain(displayName);
    const texts = [JSON.stringify(ws), JSON.stringify((await get('entries/MS').expect(200)).body), JSON.stringify((await get('groups/MD').expect(200)).body)];
    for (const text of texts) {
      for (const hidden of [legalName, legalNameEn, phone, email]) expect(text).not.toContain(hidden);
    }
  });

  it('answers null for an unknown sub-event code on entries', async () => {
    expect((await get('entries/XX').expect(200)).body).toEqual({ data: null });
  });
});
