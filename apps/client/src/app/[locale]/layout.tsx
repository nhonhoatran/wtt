import '@kamito/ui-tokens/tokens.css';
import './global.css';
import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { SiteFooter } from '../../components/layout/site-footer';
import { SiteHeader } from '../../components/layout/site-header';
import { getDictionary } from '../../i18n/get-dictionary';
import { isLocale } from '../../i18n/locales';
import { serverEnv } from '../../lib/server-env';
import { getSiteChromeDisplay } from '../../lib/site-display';
import { getSiteName } from '../../lib/site-name';

const archivo = Archivo({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const name = await getSiteName(locale);
  return { metadataBase: new URL(serverEnv.publicSiteUrl()), title: { default: name, template: `%s · ${name}` }, applicationName: name };
}

// Rendered per request: the header reads the results strip from the API, which the Docker build cannot reach.
// Data still comes from the tagged fetch cache. Unknown locales are rejected below.

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Every HTML document needs its own CSP nonce; tagged API data remains cached separately.
  await connection();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const [siteName, display] = await Promise.all([getSiteName(locale), getSiteChromeDisplay()]);
  return (
    <html lang={locale} className={archivo.className}>
      <body>
        <SiteHeader locale={locale} siteName={siteName} t={t} display={display} />
        {children}
        <SiteFooter siteName={siteName} locale={locale} t={t} display={display} />
      </body>
    </html>
  );
}
