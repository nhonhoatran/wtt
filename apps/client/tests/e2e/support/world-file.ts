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
}

export function readWorld(): E2eWorldFile {
  const file = process.env.E2E_WORLD_FILE;
  if (!file) throw new Error('E2E_WORLD_FILE is not set');
  return JSON.parse(readFileSync(file, 'utf8')) as E2eWorldFile;
}
