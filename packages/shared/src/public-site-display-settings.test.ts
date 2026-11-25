import { describe, expect, it } from 'vitest';
import { appSettingRegistry, findAppSetting, resolveAppSetting } from './app-setting-registry.js';
import { publicSiteDisplaySettings as display } from './public-site-display-settings.js';

describe('site.nav.items', () => {
  const schema = display.navItems.schema;

  it('accepts the default list and optional labels', () => {
    expect(schema.safeParse(display.navItems.defaultValue).success).toBe(true);
    expect(schema.safeParse([{ key: 'news', labelVi: 'Tin', labelEn: 'News' }]).success).toBe(true);
  });

  it('rejects duplicate keys, unknown keys, empty and oversized lists', () => {
    expect(schema.safeParse([{ key: 'news' }, { key: 'news' }]).success).toBe(false);
    expect(schema.safeParse([{ key: 'shop' }]).success).toBe(false);
    expect(schema.safeParse([]).success).toBe(false);
    expect(schema.safeParse([{ key: 'news', href: 'https://x.vn' }]).success).toBe(false);
  });
});

describe('site.socialLinks', () => {
  const schema = display.socialLinks.schema;

  it('accepts https links and an empty list', () => {
    expect(schema.safeParse([]).success).toBe(true);
    expect(schema.safeParse([{ platform: 'facebook', url: 'https://facebook.com/kamito' }]).success).toBe(true);
  });

  it.each(['http://facebook.com/x', 'javascript:alert(1)', 'data:text/html,x', ''])('rejects url %s', (url) => {
    expect(schema.safeParse([{ platform: 'facebook', url }]).success).toBe(false);
  });

  it('rejects unknown platforms and more than 8 links', () => {
    expect(schema.safeParse([{ platform: 'myspace', url: 'https://myspace.com/x' }]).success).toBe(false);
    const nine = Array.from({ length: 9 }, () => ({ platform: 'zalo', url: 'https://zalo.me/x' }));
    expect(schema.safeParse(nine).success).toBe(false);
  });
});

describe('site.tagline and site.registrationUrl', () => {
  it('accepts null or a bilingual tagline up to 300 characters', () => {
    expect(display.tagline.schema.safeParse(null).success).toBe(true);
    expect(display.tagline.schema.safeParse({ vi: 'Xin chào', en: 'Hello' }).success).toBe(true);
    expect(display.tagline.schema.safeParse({ vi: 'a'.repeat(301), en: '' }).success).toBe(false);
  });

  it('accepts empty or https registration urls only', () => {
    expect(display.registrationUrl.schema.safeParse('').success).toBe(true);
    expect(display.registrationUrl.schema.safeParse('https://dangky.kamito.vn').success).toBe(true);
    expect(display.registrationUrl.schema.safeParse('http://dangky.kamito.vn').success).toBe(false);
    expect(display.registrationUrl.schema.safeParse('javascript:alert(1)').success).toBe(false);
  });
});

describe('ranking.expiringSoonDays', () => {
  const def = appSettingRegistry.expiringSoonDays;

  it('is registered in the ranking group with the 0-365 range', () => {
    expect(findAppSetting('ranking.expiringSoonDays')).toBe(def);
    expect(def.defaultValue).toBe(30);
    expect(def.schema.safeParse(0).success).toBe(true);
    expect(def.schema.safeParse(365).success).toBe(true);
    expect(def.schema.safeParse(366).success).toBe(false);
    expect(def.schema.safeParse(-1).success).toBe(false);
  });
});

describe('display settings registry', () => {
  it('registers the new keys and falls back to defaults on invalid stored values', () => {
    for (const key of ['site.nav.items', 'site.socialLinks', 'site.tagline', 'site.registrationUrl']) {
      expect(findAppSetting(key)?.group).toBe('display');
    }
    expect(resolveAppSetting(display.registrationUrl, 'http://bad')).toBe('');
  });
});
