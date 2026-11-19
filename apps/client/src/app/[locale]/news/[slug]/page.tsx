import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '../../../../components/content/content.module.css';
import { isLocale } from '../../../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../../../i18n/pick-localized';
import { pageMetadata } from '../../../../lib/page-metadata';
import { getArticle, isUrlPart } from '../../../../lib/public-data';
import { sanitizeContentHtml } from '../../../../lib/content-html';
import { StructuredData } from '../../../../components/content/structured-data';
import { serverEnv } from '../../../../lib/server-env';
import { getSiteName } from '../../../../lib/site-name';

type Props = { params: Promise<{ locale: string; slug: string }> };

async function load(params: Props['params']) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isUrlPart(slug)) notFound();
  const article = await getArticle(slug);
  if (!article) notFound();
  return { locale, article };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, article } = await load(params);
  return pageMetadata(locale, `/news/${article.slug}`, {
    title: pickLocalized(locale, article.title, article.titleEn),
    description: pickLocalizedOrNull(locale, article.summary, article.summaryEn),
    image: article.cover,
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale, article } = await load(params);
  const title = pickLocalized(locale, article.title, article.titleEn);
  const body = pickLocalized(locale, article.body, article.bodyEn);
  const siteName = await getSiteName(locale);
  const pageUrl = new URL(`/${locale}/news/${article.slug}`, serverEnv.publicSiteUrl()).toString();
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    datePublished: article.publishedAt,
    mainEntityOfPage: pageUrl,
    publisher: { '@type': 'Organization', name: siteName },
    ...(article.authorName ? { author: { '@type': 'Person', name: article.authorName } } : {}),
    ...(pickLocalizedOrNull(locale, article.summary, article.summaryEn) ? { description: pickLocalizedOrNull(locale, article.summary, article.summaryEn) } : {}),
    ...(article.cover ? { image: [new URL(article.cover.url, serverEnv.publicSiteUrl()).toString()] } : {}),
  };
  return (
    <main id="content" className="container">
      <StructuredData value={structuredData} />
      <p className="eyebrow"><Link href={`/${locale}/news`}>{locale === 'vi' ? 'Tin tức' : 'News'}</Link></p>
      <article>
        <h1 className="page-title">{title}</h1>
        <div className={styles.meta}>
          {article.category && <span>{article.category}</span>}
          {article.authorName && <span>{article.authorName}</span>}
          <time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' }).format(new Date(article.publishedAt))}</time>
        </div>
        {article.cover && <img className={styles.media} src={article.cover.url} width={article.cover.width} height={article.cover.height} alt={pickLocalized(locale, article.cover.alt ?? '', article.cover.altEn)} />}
        {article.summary && <p className={styles.summary}>{pickLocalized(locale, article.summary, article.summaryEn)}</p>}
        <div className={styles.articleBody} dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(body) }} />
      </article>
    </main>
  );
}
