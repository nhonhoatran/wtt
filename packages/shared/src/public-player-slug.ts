const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_PLAYER_SLUG_PATTERN = /^p-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Technical route namespace: a stable public URL never reveals a player's legal name. */
export function publicPlayerSlug(playerId: string): string {
  if (!UUID_PATTERN.test(playerId)) throw new RangeError('invalid player id');
  return `p-${playerId.toLowerCase()}`;
}

/** Returns only a UUID, so public URLs cannot influence a database field or SQL expression. */
export function publicPlayerIdFromSlug(slug: string): string | null {
  return PUBLIC_PLAYER_SLUG_PATTERN.exec(slug)?.[1]?.toLowerCase() ?? null;
}

/** Technical field bound shared by the admin DTO and public club filters. */
export const PLAYER_CLUB_MAX_LENGTH = 200;
