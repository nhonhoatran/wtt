import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VideoEmbedFacade } from '../../../../components/content/video-embed-facade';
import styles from '../../../../components/content/content.module.css';
import { getDictionary } from '../../../../i18n/get-dictionary';
import { isLocale } from '../../../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../../../i18n/pick-localized';
import { pageMetadata } from '../../../../lib/page-metadata';
import { getVideo, isUrlPart } from '../../../../lib/public-data';
import { StructuredData } from '../../../../components/content/structured-data';
import { serverEnv } from '../../../../lib/server-env';
import { getSiteName } from '../../../../lib/site-name';

type Props = { params: Promise<{ locale: string; slug: string }> };
async function load(params: Props['params']) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isUrlPart(slug)) notFound();
  const video = await getVideo(slug);
  if (!video) notFound();
  return { locale, video };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, video } = await load(params);
  const title = pickLocalized(locale, video.title, video.titleEn);
  const image = video.thumbnailUrl ? [{ url: video.thumbnailUrl, alt: title }] : undefined;
  const metadata = pageMetadata(locale, `/videos/${video.slug}`, { title });
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, ...(image ? { images: image } : {}) },
    twitter: { ...metadata.twitter, ...(image ? { images: image.map(({ url }) => url) } : {}) },
  };
}

export default async function VideoPage({ params }: Props) {
  const { locale, video } = await load(params);
  const t = getDictionary(locale).videos;
  const title = pickLocalized(locale, video.title, video.titleEn);
  const duration = pickLocalizedOrNull(locale, video.durationText, video.durationTextEn);
  const siteName = await getSiteName(locale);
  const pageUrl = new URL(`/${locale}/videos/${video.slug}`, serverEnv.publicSiteUrl()).toString();
  const embedUrl = video.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.embedId)}`
    : `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(video.url)}&show_text=0`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    uploadDate: video.publishedAt,
    contentUrl: video.url,
    embedUrl,
    publisher: { '@type': 'Organization', name: siteName },
    ...(video.thumbnailUrl ? { thumbnailUrl: [video.thumbnailUrl] } : {}),
    ...(duration ? { description: duration } : {}),
    mainEntityOfPage: pageUrl,
  };
  return (
    <main id="content" className="container">
      <StructuredData value={structuredData} />
      <p className="eyebrow"><Link href={`/${locale}/videos`}>{t.title}</Link></p>
      <h1 className="page-title">{pickLocalized(locale, video.title, video.titleEn)}</h1>
      <VideoEmbedFacade video={video} label={t.play} />
      {duration && <p className={styles.meta}>{duration}</p>}
    </main>
  );
}
