import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleCard } from '../../../components/content/article-card';
import styles from '../../../components/content/content.module.css';
import { PaginationLinks } from '../../../components/common/pagination-links';
import { FilterForm } from '../../../components/common/filter-form';
import { getDictionary } from '../../../i18n/get-dictionary';
import { isLocale } from '../../../i18n/locales';
import { pickLocalized } from '../../../i18n/pick-localized';
import { pageMetadata } from '../../../lib/page-metadata';
import { getArticles } from '../../../lib/public-data';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[]; category?: string | string[] }> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).news;
  return pageMetadata(locale, '/news', { title: t.title, description: t.description });
}

export default async function NewsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = await searchParams;
  const page = Math.max(1, Math.min(10_000, Number(first(raw.page)) || 1));
  const category = (first(raw.category) ?? '').slice(0, 80);
  const query = new URLSearchParams({ page: String(page), ...(category ? { category } : {}) }).toString();
  const result = await getArticles(`?${query}`, Boolean(category));
  if (!result) notFound();
  const t = getDictionary(locale);
  const news = t.news;
  const categoryLabel = (key: string) => pickLocalized(locale, key,
    Object.hasOwn(result.categoryLabelsEn ?? {}, key) && typeof result.categoryLabelsEn[key] === 'string'
      ? result.categoryLabelsEn[key] : null);
  const hrefFor = (nextPage: number) => `/${locale}/news?${new URLSearchParams({ page: String(nextPage), ...(category ? { category } : {}) })}`;

  return (
    <main id="content" className="container">
      <h1 className="page-title">{news.title}</h1>
      <FilterForm label={news.filterLabel} action={`/${locale}/news`} fields={[
        { kind: 'select', name: 'category', label: news.category, value: category, allLabel: news.allCategories, options: result.categories.map((item) => ({ value: item, label: categoryLabel(item) })) },
      ]} t={t.common} />
      {result.data.length ? (
        <ul className={styles.grid}>
          {result.data.map((article) => <li key={article.slug}><ArticleCard article={article} locale={locale} /></li>)}
        </ul>
      ) : <p>{news.empty}</p>}
      <PaginationLinks page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={hrefFor} t={t.common} />
      <p><Link className="text-link" href={`/${locale}/videos`}>{news.videos}</Link></p>
    </main>
  );
}
