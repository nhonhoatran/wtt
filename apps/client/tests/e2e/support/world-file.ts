import { readFileSync } from 'node:fs';

/** Mirror of E2eWorldFile in apps/api/test/playwright/public-world.seed.ts (only the fields the specs read). */
export interface E2eWorldFile {
  world: { slug: string; tag: string };
  eventName: string;
  eventNameEn: string | null;
  shownName: string;
  hiddenLegalName: string;
  playedMatchNo: number;
  groupMatchNo: number;
  longEvent: { slug: string; firstDate: string; lastDate: string; lateDate: string; matchNo: number };
  ranking: {
    code: string; name: string; nameEn: string; doublesCode: string; doublesName: string;
    eventSlug: string; eventName: string; playerSlug: string; legacyPlayerSlug: string; playerName: string; hiddenName: string; club: string;
    privateSlug: string; privateName: string; mergedSlug: string; emptySlug: string;
    currentPoints: number; playedMatchNo: number; byeMatchNo: number;
  };
}

export function readWorld(): E2eWorldFile {
  const file = process.env.E2E_WORLD_FILE;
  if (!file) throw new Error('E2E_WORLD_FILE is not set');
  return JSON.parse(readFileSync(file, 'utf8')) as E2eWorldFile;
}
