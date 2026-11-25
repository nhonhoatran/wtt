import type { PublicTable } from '@kamito/shared';
import { format } from '../i18n/get-dictionary';

/** StatusPill variant per match status. */
export const MATCH_STATUS_PILL = { SCHEDULED: 'scheduled', LIVE: 'live', OFFICIAL: 'official' } as const;

/** Display name of a table, falling back to the localized "Table {code}" template. */
export function tableName(table: PublicTable | null | undefined, template: string): string | null {
  return table ? (table.displayName ?? format(template, { code: table.code })) : null;
}
