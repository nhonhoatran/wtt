import { publicCacheTags as t } from './public-cache-tags.js';

export interface EntryChangeTagContext {
  eventSlug: string;
  /** Every sub-event code whose draw or groups may show the changed entries. */
  subEventCodes: string[];
  playerSlugs: string[];
  /** True when players were created, so the public players list changes too. */
  includePlayersList?: boolean;
}

/** Shared by the API and the import worker so both invalidate the same pages after an entry write. */
export const entryChangeTags = (c: EntryChangeTagContext): string[] => [
  t.event(c.eventSlug),
  ...c.subEventCodes.flatMap((code) => [t.draw(c.eventSlug, code), t.groups(c.eventSlug, code)]),
  ...(c.includePlayersList ? [t.players()] : []),
  ...c.playerSlugs.map(t.player),
];
