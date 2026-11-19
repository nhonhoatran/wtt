import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import styles from '../../../../components/content/content.module.css';
import { isLocale } from '../../../../i18n/locales';
import { pickLocalized } from '../../../../i18n/pick-localized';
import { pageMetadata } from '../../../../lib/page-metadata';
import { getStaticPage, isUrlPart } from '../../../../lib/public-data';
import { sanitizeContentHtml } from '../../../../lib/content-html';

type Props = { params: Promise<{ locale: string; slug: string }> };
async function load(params: Props['params']) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isUrlPart(slug)) notFound();
  const page = await getStaticPage(slug);
  if (!page) notFound();
  return { locale, page };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, page } = await load(params);
  return pageMetadata(locale, `/pages/${page.slug}`, { title: pickLocalized(locale, page.title, page.titleEn) });
}

export default async function StaticPage({ params }: Props) {
  const { locale, page } = await load(params);
  return <main id="content" className="container"><h1 className="page-title">{pickLocalized(locale, page.title, page.titleEn)}</h1><div className={styles.articleBody} dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(pickLocalized(locale, page.body, page.bodyEn)) }} /></main>;
}
