import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { getResultsStrip } from '../../lib/public-data';
import { ResultsStripItem } from './results-strip-item';
import styles from './results-strip.module.css';

/** Server-rendered; hidden while the AppSetting is off. A failed fetch hides the strip instead of breaking every page. */
export async function ResultsStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const strip = await getResultsStrip().catch(() => null);
  if (!strip || strip.items.length === 0) return null;
  const slugs = new Set(strip.items.map((m) => m.event.slug));
  const onlySlug = slugs.size === 1 ? strip.items[0]!.event.slug : null;
  return (
    <section className={styles.strip} aria-labelledby="results-strip-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <h2 id="results-strip-title" className={styles.title}>{t.strip.label}</h2>
          {onlySlug && <Link href={`/${locale}/events/${onlySlug}/matches`} className={styles.all}>{t.strip.all}</Link>}
        </div>
        <ul className={styles.items}>
          {strip.items.map((m) => (
            <li key={`${m.event.slug}-${m.matchNo}`} className={styles.cell}>
              <ResultsStripItem match={m} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
