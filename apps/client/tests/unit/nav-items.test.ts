import { describe, expect, it } from 'vitest';
import { getDictionary } from '../../src/i18n/get-dictionary';
import { navCurrent, resolveNavItems } from '../../src/lib/nav-items';

describe('resolveNavItems', () => {
  const t = getDictionary('vi').nav;
  it('keeps the configured order and uses dictionary labels', () => {
    const items = resolveNavItems([{ key: 'rankings' }, { key: 'events' }], 'vi', t);
    expect(items.map((i) => i.href)).toEqual(['/vi/rankings', '/vi/events']);
    expect(items.map((i) => i.label)).toEqual([t.rankings, t.events]);
  });
  it('prefers the label override of the current locale, ignoring blanks', () => {
    const items = [{ key: 'news' as const, labelVi: 'Tin', labelEn: ' ' }];
    expect(resolveNavItems(items, 'vi', t)[0]!.label).toBe('Tin');
    expect(resolveNavItems(items, 'en', getDictionary('en').nav)[0]!.label).toBe(getDictionary('en').nav.news);
  });
  it('maps calendar to the events calendar route', () => {
    expect(resolveNavItems([{ key: 'calendar' }], 'en', t)[0]!.href).toBe('/en/events/calendar');
  });
});

describe('navCurrent', () => {
  it('marks the exact page and the section location', () => {
    expect(navCurrent('events', '/vi/events', 'vi')).toBe('page');
    expect(navCurrent('events', '/vi/events/some-slug/draws', 'vi')).toBe('location');
    expect(navCurrent('rankings', '/vi/rankings/ms', 'vi')).toBe('location');
  });
  it('does not mark events as current on the calendar', () => {
    expect(navCurrent('events', '/vi/events/calendar', 'vi')).toBeUndefined();
    expect(navCurrent('calendar', '/vi/events/calendar', 'vi')).toBe('page');
  });
  it('treats news and videos as a location, contact as a page only', () => {
    expect(navCurrent('news', '/vi/news', 'vi')).toBe('location');
    expect(navCurrent('videos', '/vi/videos/x', 'vi')).toBe('location');
    expect(navCurrent('contact', '/vi/contact', 'vi')).toBe('page');
    expect(navCurrent('contact', '/vi/contact/x', 'vi')).toBeUndefined();
  });
  it('ignores other locales and a missing pathname', () => {
    expect(navCurrent('events', '/en/events', 'vi')).toBeUndefined();
    expect(navCurrent('events', null, 'vi')).toBeUndefined();
  });
});
