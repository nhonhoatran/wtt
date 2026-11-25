/** A table's own display name as-is; only a bare code gets the "Bàn" prefix. Null when the table has neither. */
export function tableDisplayName(table: { code?: string | null; displayName?: string | null }): string | null {
  const name = table.displayName?.trim();
  if (name) return name;
  const code = table.code?.trim();
  return code ? `Bàn ${code}` : null;
}

/** The API sends the bare code as `tableName` when a table has no display name; that case gets the "Bàn" prefix too. */
export function matchTableLabel(match: { tableCode?: string | null; tableName?: string | null }): string | null {
  const named = match.tableName && match.tableName !== match.tableCode ? match.tableName : null;
  return tableDisplayName({ code: match.tableCode ?? match.tableName, displayName: named });
}
