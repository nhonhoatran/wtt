import Link from 'next/link';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { getResultsStrip } from '../../lib/public-data';
import { SidePlayers } from '../players/side-players';
import { LiveBadge } from '../common/live-badge';
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
            <div
              className={styles.item}
              title={pickLocalized(locale, m.event.name, m.event.nameEn)}
            >
              {m.status === 'LIVE' && <LiveBadge label={t.bracket.live} variant="deep" />}
              <span className={styles.sub}>{m.subEvent.code}</span>
              <span>{m.side1 && <SidePlayers side={m.side1} locale={locale} />}</span>
              <Link href={`/${locale}/events/${m.event.slug}/matches/${m.matchNo}`} className={styles.score} aria-label={format(t.bracket.match, { matchNo: m.matchNo })}>
                <strong>
                {m.games1 ?? 0}–{m.games2 ?? 0}
                </strong>
              </Link>
              <span>{m.side2 && <SidePlayers side={m.side2} locale={locale} />}</span>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
