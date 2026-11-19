import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactForm } from '../../../components/content/contact-form';
import { getDictionary } from '../../../i18n/get-dictionary';
import { isLocale } from '../../../i18n/locales';
import { pageMetadata } from '../../../lib/page-metadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).contact;
  return pageMetadata(locale, '/contact', { title: t.title, description: t.description });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).contact;
  return <main id="content" className="container"><h1 className="page-title">{t.title}</h1><p>{t.description}</p><ContactForm locale={locale} copy={t} /></main>;
}
