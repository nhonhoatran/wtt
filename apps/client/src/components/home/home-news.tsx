import Link from 'next/link';
import type { PublicArticleCard } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import { SectionHeading } from '../common/section-heading';
import styles from './home-news.module.css';

const dateOf = (iso: string, locale: Locale) => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' }).format(new Date(iso));

function Meta({ article, locale }: { article: PublicArticleCard; locale: Locale }) {
  const category = pickLocalizedOrNull(locale, article.category, article.categoryEn);
  return (
    <p className={styles.meta}>
      {category && <span className={styles.category}>{category}</span>}
      <time dateTime={article.publishedAt}>{dateOf(article.publishedAt, locale)}</time>
    </p>
  );
}

/** One large lead story and the rest as rows; items arrive already cut to the display limit. */
export function HomeNews({ articles, locale, t }: { articles: PublicArticleCard[]; locale: Locale; t: Dictionary }) {
  const [lead, ...rest] = articles;
  if (!lead) return null;
  const summary = pickLocalizedOrNull(locale, lead.summary, lead.summaryEn);
  return (
    <section className="container" aria-labelledby="home-news">
      <SectionHeading id="home-news" title={t.home.news} link={{ href: `/${locale}/news`, label: t.home.allNews }} />
      <div className={styles.layout}>
        <article className={styles.lead}>
          {lead.cover && <img className={styles.cover} src={lead.cover.url} width={lead.cover.width} height={lead.cover.height} alt={pickLocalized(locale, lead.cover.alt ?? '', lead.cover.altEn)} loading="lazy" />}
          <div className={styles.leadBody}>
            <Meta article={lead} locale={locale} />
            <h3 className={styles.leadTitle}><Link href={`/${locale}/news/${lead.slug}`} className={styles.titleLink}>{pickLocalized(locale, lead.title, lead.titleEn)}</Link></h3>
            {summary && <p className={styles.summary}>{summary}</p>}
            {lead.authorName && <p className={styles.author}>{lead.authorName}</p>}
          </div>
        </article>
        {rest.length > 0 && (
          <ul className={styles.rows}>
            {rest.map((a) => (
              <li key={a.slug} className={styles.row}>
                <Meta article={a} locale={locale} />
                <h3 className={styles.rowTitle}><Link href={`/${locale}/news/${a.slug}`} className={styles.titleLink}>{pickLocalized(locale, a.title, a.titleEn)}</Link></h3>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
