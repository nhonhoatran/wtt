import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import styles from './rankings.module.css';

interface HeaderProps {
  locale: Locale;
  t: Dictionary;
  name: string;
  updated: string;
  /** CMS page explaining how points work; the link is hidden without it. */
  guideHref?: string | null;
}

export function RankingPageHeader({ locale, t, name, updated, guideHref = null }: HeaderProps) {
  return (
    <header>
      <nav aria-label={t.events.breadcrumb} className={styles.crumbs}>
        <Link href={`/${locale}`}>{t.events.breadcrumbHome}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/${locale}/rankings`}>{t.rankings.title}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{name}</span>
      </nav>
      <div className={styles.titleRow}>
        <div>
          <h1 className="page-title">{name}</h1>
          <p className={styles.intro}>{updated}</p>
        </div>
        {guideHref && <Link className={styles.guideLink} href={guideHref}>{t.rankings.pointsGuide}</Link>}
      </div>
    </header>
  );
}
