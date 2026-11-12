import '@kamito/ui-tokens/tokens.css';
import './global.css';
import { Archivo } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
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
  return (
    <html lang={locale} className={archivo.className}>
      <body>{children}</body>
    </html>
  );
}
