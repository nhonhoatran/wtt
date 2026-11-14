import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { getResultsStrip } from '../../lib/public-data';
import { sideName } from '../matches/side-name';
import styles from './results-strip.module.css';

/** Server-rendered; hidden while the AppSetting is off. A failed fetch hides the strip instead of breaking every page. */
export async function ResultsStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const strip = await getResultsStrip().catch(() => null);
  if (!strip || strip.items.length === 0) return null;
  return (
    <details className={styles.strip} open>
      <summary className={styles.toggle}>{t.strip.toggle}</summary>
      <ul className={styles.items} aria-label={t.strip.label}>
        {strip.items.map((m) => (
          <li key={`${m.event.slug}-${m.matchNo}`}>
            <Link
              href={`/${locale}/events/${m.event.slug}/matches/${m.matchNo}`}
              className={styles.item}
              title={pickLocalized(locale, m.event.name, m.event.nameEn)}
            >
              {m.status === 'LIVE' && <span className={styles.live}>{t.bracket.live}</span>}
              <span className={styles.sub}>{m.subEvent.code}</span>
              <span>{sideName(locale, m.side1)}</span>
              <strong className={styles.score}>
                {m.games1 ?? 0}–{m.games2 ?? 0}
              </strong>
              <span>{sideName(locale, m.side2)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
