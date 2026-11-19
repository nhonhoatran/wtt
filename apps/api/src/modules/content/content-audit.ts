export type ContentAuditEntity = 'Article' | 'Video' | 'Sponsor' | 'StaticPage' | 'ContactMessage';

/** Audit only publication metadata: rich HTML, personal names and inbox PII never enter snapshots. */
const FIELDS: Record<ContentAuditEntity, readonly string[]> = {
  Article: ['id', 'slug', 'status', 'category', 'isFeatured', 'coverMediaId', 'publishAt', 'publishedAt'],
  Video: ['id', 'slug', 'status', 'provider', 'embedId', 'eventId', 'isFeatured', 'publishedAt'],
  Sponsor: ['id', 'eventId', 'order', 'isActive', 'logoMediaId', 'logoDarkMediaId'],
  StaticPage: ['id', 'slug', 'status', 'footerGroup', 'footerOrder'],
  ContactMessage: ['id', 'status'],
};

export function contentAuditSnapshot(entity: ContentAuditEntity, row: unknown): unknown {
  if (row === undefined || row === null) return row;
  const source = row as Record<string, unknown>;
  const snapshot: Record<string, unknown> = {};
  for (const key of FIELDS[entity]) {
    const value = source[key];
    if (value !== undefined) snapshot[key] = value instanceof Date ? value.toISOString() : value;
  }
  if (entity === 'Article' && Array.isArray(source.events)) {
    snapshot.eventIds = source.events.flatMap((value: unknown) => {
      if (!value || typeof value !== 'object' || !('eventId' in value) || typeof value.eventId !== 'string') return [];
      return [value.eventId];
    }).sort();
  }
  return snapshot;
}
