import { describe, expect, it } from 'vitest';
import { contentAuditSnapshot } from './content-audit.js';

describe('content audit snapshots', () => {
  it('keeps contact status without copying submitted PII or message text', () => {
    expect(contentAuditSnapshot('ContactMessage', {
      id: 'contact-id', status: 'READ', name: 'Private Sender', email: 'private@example.test',
      phone: '0900000000', organization: 'Private org', message: 'Private message', ipHash: 'hash', body: 'Private body',
    })).toEqual({ id: 'contact-id', status: 'READ' });
  });

  it('omits rich content and personal labels from CMS snapshots', () => {
    const secretText = { body: '<p>Private draft</p>', bodyEn: 'Private draft', title: 'Private title', name: 'Private name', authorName: 'Private author', email: 'private@example.test' };
    expect(contentAuditSnapshot('Article', { ...secretText, id: 'article-id', status: 'DRAFT' })).toEqual({ id: 'article-id', status: 'DRAFT' });
    expect(contentAuditSnapshot('StaticPage', { ...secretText, id: 'page-id', status: 'PUBLISHED' })).toEqual({ id: 'page-id', status: 'PUBLISHED' });
    expect(contentAuditSnapshot('Sponsor', { ...secretText, id: 'sponsor-id', order: 2 })).toEqual({ id: 'sponsor-id', order: 2 });
  });

  it('records stable article event ids and serialized publication dates', () => {
    const publishAt = new Date('2026-11-20T01:00:00Z');
    expect(contentAuditSnapshot('Article', { id: 'article-id', publishAt, events: [{ eventId: 'b' }, { eventId: 'a', event: { name: 'Hidden label' } }] })).toEqual({
      id: 'article-id', publishAt: publishAt.toISOString(), eventIds: ['a', 'b'],
    });
  });

  it('does not copy arbitrary URL query parameters into audit metadata', () => {
    const url = 'https://example.test/watch?access_token=private-value';
    expect(contentAuditSnapshot('Video', { id: 'video-id', url, provider: 'facebook', embedId: '123456' })).toEqual({ id: 'video-id', provider: 'facebook', embedId: '123456' });
    expect(contentAuditSnapshot('Sponsor', { id: 'sponsor-id', url })).toEqual({ id: 'sponsor-id' });
  });
});
