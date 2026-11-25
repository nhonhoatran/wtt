/** Number of matches of a session that carry at least one scheduling conflict. */
export const countConflictedMatches = (matches: ReadonlyArray<{ conflicts?: readonly unknown[] }>): number =>
  matches.filter((match) => (match.conflicts?.length ?? 0) > 0).length;
