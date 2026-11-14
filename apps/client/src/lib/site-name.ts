import { appSettingRegistry } from '@kamito/shared';
import type { Locale } from '../i18n/locales';
import { getSiteConfig } from './public-data';

/** AppSetting `site.name`; the registry default only while the API cannot answer. */
export async function getSiteName(locale: Locale): Promise<string> {
  const config = await getSiteConfig().catch(() => null);
  return (config?.siteName ?? appSettingRegistry.siteName.defaultValue)[locale];
}
