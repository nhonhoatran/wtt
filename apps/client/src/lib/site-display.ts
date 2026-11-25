import { appSettingRegistry, type PublicSiteDisplay } from '@kamito/shared';
import { getSiteConfig } from './public-data';

export type SiteChromeDisplay = Pick<PublicSiteDisplay, 'navItems' | 'socialLinks' | 'tagline' | 'registrationUrl'>;

/** Display settings for header and footer; registry defaults only while the API cannot answer. */
export async function getSiteChromeDisplay(): Promise<SiteChromeDisplay> {
  const config = await getSiteConfig().catch(() => null);
  if (config?.display) return config.display;
  return {
    navItems: appSettingRegistry.navItems.defaultValue,
    socialLinks: [],
    tagline: null,
    registrationUrl: '',
  };
}
