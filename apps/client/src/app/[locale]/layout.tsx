import '@kamito/ui-tokens/tokens.css';
import './global.css';
import { Archivo } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteFooter } from '../../components/layout/site-footer';
import { SiteHeader } from '../../components/layout/site-header';
import { appSettingRegistry } from '@kamito/shared';
import { getDictionary } from '../../i18n/get-dictionary';
import { isLocale, LOCALES } from '../../i18n/locales';

const archivo = Archivo({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  // Stored AppSetting value replaces the default once the public settings endpoint exists.
  const siteName = appSettingRegistry.siteName.defaultValue[locale];
  return (
    <html lang={locale} className={archivo.className}>
      <body>
        <SiteHeader locale={locale} siteName={siteName} skipLabel={t.site.skipToContent} />
        {children}
        <SiteFooter text={siteName} />
      </body>
    </html>
  );
}
