import Link from 'next/link';
import type { PublicVideo } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import { VideoEmbedFacade } from './video-embed-facade';
import styles from './content.module.css';

export function VideoCard({ video, locale, playLabel }: { video: PublicVideo; locale: Locale; playLabel: string }) {
  return (
    <article className={styles.card}>
      <VideoEmbedFacade video={video} label={playLabel} />
      <div className={styles.cardBody}>
        <h3 className={styles.title}><Link href={`/${locale}/videos/${video.slug}`} className={styles.titleLink}>{pickLocalized(locale, video.title, video.titleEn)}</Link></h3>
        {pickLocalizedOrNull(locale, video.durationText, video.durationTextEn) && <p className={styles.meta}>{pickLocalizedOrNull(locale, video.durationText, video.durationTextEn)}</p>}
      </div>
    </article>
  );
}
