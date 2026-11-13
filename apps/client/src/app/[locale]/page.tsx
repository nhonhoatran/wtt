import { appSettingRegistry } from '@kamito/shared';
import { DEFAULT_LOCALE, isLocale } from '../../i18n/locales';

// Placeholder shell: the stored AppSetting value is fetched from the API in phase 08.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const siteName = appSettingRegistry.siteName.defaultValue;
  return (
    <main id="content" className="container">
      <h1>{siteName[isLocale(locale) ? locale : DEFAULT_LOCALE]}</h1>
    </main>
  );
}
