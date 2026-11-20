import { describe, expect, it } from 'vitest';
import { pageMetadata } from '../../src/lib/page-metadata';

describe('pageMetadata', () => {
  it('provides canonical, locale alternates, Open Graph and Twitter metadata', () => {
    const metadata = pageMetadata('en', '/events/open', {
      title: 'Open tournament',
      description: 'Tournament details',
      image: { url: '/event.jpg', width: 1200, height: 630, alt: 'Giải đấu', altEn: 'Tournament' },
    });

    expect(metadata.alternates).toEqual({
      canonical: '/en/events/open',
      languages: { vi: '/vi/events/open', en: '/en/events/open', 'x-default': '/vi/events/open' },
    });
    expect(metadata.openGraph?.title).toBe('Open tournament');
    expect(metadata.openGraph?.images).toEqual([{ url: '/event.jpg', width: 1200, height: 630, alt: 'Tournament' }]);
    expect(metadata.twitter).toEqual({ card: 'summary_large_image', title: 'Open tournament', description: 'Tournament details', images: ['/event.jpg'] });
  });
});
