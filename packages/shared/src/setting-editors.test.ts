import { describe, expect, it } from 'vitest';
import { appSettingRegistry, findAppSetting } from './app-setting-registry.js';
import { dashboardSettings } from './dashboard-settings.js';
import { publicSiteDisplaySettings as display } from './public-site-display-settings.js';

describe('structured editors for display settings', () => {
  it('nav-items offers exactly the keys the schema accepts', () => {
    const editor = display.navItems.editor;
    expect(editor.kind).toBe('nav-items');
    if (editor.kind !== 'nav-items') return;
    expect(editor.options.map((option) => option.value).sort()).toEqual(['calendar', 'contact', 'events', 'news', 'players', 'rankings', 'videos']);
    for (const option of editor.options) {
      expect(option.label).not.toBe('');
      expect(display.navItems.schema.safeParse([{ key: option.value }]).success).toBe(true);
    }
    expect(display.navItems.schema.safeParse(Array.from({ length: editor.maxItems + 1 }, (_, i) => ({ key: editor.options[i % 7]!.value }))).success).toBe(false);
  });

  it('social-links offers exactly the platforms the schema accepts', () => {
    const editor = display.socialLinks.editor;
    expect(editor.kind).toBe('social-links');
    if (editor.kind !== 'social-links') return;
    for (const platform of editor.platforms) {
      expect(display.socialLinks.schema.safeParse([{ platform: platform.value, url: 'https://example.vn/x' }]).success).toBe(true);
    }
    expect(editor.platforms).toHaveLength(5);
  });

  it('site.name and site.tagline use the bilingual editor; only the tagline may be empty', () => {
    expect(appSettingRegistry.siteName.editor).toMatchObject({ kind: 'bilingual-text', nullable: false });
    expect(display.tagline.editor).toMatchObject({ kind: 'bilingual-text', nullable: true, maxLength: 300 });
    expect(appSettingRegistry.siteName.schema.safeParse({ vi: 'Tên', en: '' }).success).toBe(false);
    expect(display.tagline.schema.safeParse(null).success).toBe(true);
  });
});

describe('dashboard settings', () => {
  it('are registered under the dashboard group with guard rails', () => {
    for (const def of [dashboardSettings.liveEventLimit, dashboardSettings.recentActivityLimit]) {
      expect(findAppSetting(def.key)).toBe(def);
      expect(def.group).toBe('dashboard');
      expect(def.schema.safeParse(def.defaultValue).success).toBe(true);
    }
    expect(dashboardSettings.liveEventLimit.schema.safeParse(0).success).toBe(false);
    expect(dashboardSettings.liveEventLimit.schema.safeParse(21).success).toBe(false);
    expect(dashboardSettings.recentActivityLimit.schema.safeParse(0).success).toBe(true);
    expect(dashboardSettings.recentActivityLimit.schema.safeParse(21).success).toBe(false);
  });
});
