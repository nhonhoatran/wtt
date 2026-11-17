import Link from 'next/link';
import type { PublicPointsBreakdown } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { rankingStageLabel } from '../../i18n/ranking-stage-label';
import { formatFullDate } from '../../lib/format-date-time';
import styles from './rankings.module.css';

/** Native disclosure keeps the frozen breakdown available without JavaScript. */
export function PointsBreakdownDetails({ items, locale, t }: { items: PublicPointsBreakdown[]; locale: Locale; t: Dictionary }) {
  return (
    <details className={styles.details}>
      <summary>{t.rankings.breakdown}</summary>
      {items.length === 0 ? <p className={styles.note}>{t.rankings.noBreakdown}</p> : (
        <table className={styles.breakdownTable}>
          <caption className="visually-hidden">{t.rankings.breakdown}</caption>
          <thead><tr>
            <th scope="col">{t.rankings.event}</th>
            <th scope="col">{t.rankings.tier}</th>
            <th scope="col">{t.rankings.round}</th>
            <th scope="col">{t.rankings.points}</th>
            <th scope="col">{t.rankings.expires}</th>
          </tr></thead>
          <tbody>{items.map((item, i) => (
            <tr key={i}>
              <th scope="row">{item.eventName ? (
                item.eventSlug ? <Link className="text-link" href={`/${locale}/events/${item.eventSlug}`}>{pickLocalized(locale, item.eventName, item.eventNameEn)}</Link> : pickLocalized(locale, item.eventName, item.eventNameEn)
              ) : t.rankings.manual}</th>
              <td>{item.eventTypeCode ?? '–'}</td>
              <td>{item.stageCode ? rankingStageLabel(t, item.stageCode) : '–'}</td>
              <td>{item.points.toLocaleString(locale)}</td>
              <td><time dateTime={item.expiresAt}>{formatFullDate(item.expiresAt, locale)}</time></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </details>
  );
}
