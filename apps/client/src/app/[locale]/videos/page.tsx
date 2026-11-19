import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PaginationLinks } from '../../../components/common/pagination-links';
import { VideoCard } from '../../../components/content/video-card';
import styles from '../../../components/content/content.module.css';
import { getDictionary } from '../../../i18n/get-dictionary';
import { isLocale } from '../../../i18n/locales';
import { pageMetadata } from '../../../lib/page-metadata';
import { getVideos } from '../../../lib/public-data';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[] }> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).videos;
  return pageMetadata(locale, '/videos', { title: t.title, description: t.description });
}

export default async function VideosPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = Math.max(1, Math.min(10_000, Number(first((await searchParams).page)) || 1));
  const result = await getVideos(`?${new URLSearchParams({ page: String(page) })}`);
  if (!result) notFound();
  const t = getDictionary(locale);
  return (
    <main id="content" className="container">
      <h1 className="page-title">{t.videos.title}</h1>
      {result.data.length ? <ul className={styles.grid}>{result.data.map((video) => <li key={video.slug}><VideoCard video={video} locale={locale} playLabel={t.videos.play} /></li>)}</ul> : <p>{t.videos.empty}</p>}
      <PaginationLinks page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(next) => `/${locale}/videos?page=${next}`} t={t.common} />
      <p><a className="text-link" href={`/${locale}/news`}>{t.videos.news}</a></p>
    </main>
  );
}
