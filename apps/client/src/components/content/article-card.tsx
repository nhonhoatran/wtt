import Link from 'next/link';
import type { PublicArticleCard } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import styles from './content.module.css';

export function ArticleCard({ article, locale }: { article: PublicArticleCard; locale: Locale }) {
  return (
    <article className={styles.card}>
      <Link href={`/${locale}/news/${article.slug}`} className={styles.cardLink}>
        {article.cover ? <img className={styles.media} src={article.cover.url} width={article.cover.width} height={article.cover.height} alt={pickLocalized(locale, article.cover.alt ?? '', article.cover.altEn)} loading="lazy" /> : <div className={styles.mediaPlaceholder} aria-hidden="true">{locale === 'vi' ? 'Tin tức' : 'News'}</div>}
        <div className={styles.cardBody}>
          <div className={styles.meta}>
            {pickLocalizedOrNull(locale, article.category, article.categoryEn) && <span>{pickLocalizedOrNull(locale, article.category, article.categoryEn)}</span>}
            <time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' }).format(new Date(article.publishedAt))}</time>
          </div>
          <h3 className={styles.title}>{pickLocalized(locale, article.title, article.titleEn)}</h3>
          {pickLocalized(locale, article.summary ?? '', article.summaryEn) && <p className={styles.summary}>{pickLocalized(locale, article.summary ?? '', article.summaryEn)}</p>}
        </div>
      </Link>
    </article>
  );
}
