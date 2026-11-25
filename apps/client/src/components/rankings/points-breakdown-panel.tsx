import Link from 'next/link';
import type { PublicRankingRow } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { rankingStageLabel } from '../../i18n/ranking-stage-label';
import { formatFullDate } from '../../lib/format-date-time';
import { isExpiringSoon } from '../../lib/expiring-soon';
import styles from './ranking-accordion.module.css';

interface PanelProps {
  row: PublicRankingRow;
  name: string;
  locale: Locale;
  t: Dictionary;
  today: string;
  expiringSoonDays: number;
}

/** Frozen points of one player: a real table so screen readers keep the column semantics. */
export function PointsBreakdownPanel({ row, name, locale, t, today, expiringSoonDays }: PanelProps) {
  const r = t.rankings;
  const title = format(r.breakdownTitle, { name });
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        {row.player.slug && <Link className={styles.profileLink} href={`/${locale}/players/${row.player.slug}`}>{r.viewProfile}<span aria-hidden="true"> →</span></Link>}
      </div>
      {row.breakdown.length === 0 ? <p className={styles.note}>{r.noBreakdown}</p> : (
        <table className={styles.breakdown}>
          <caption className="visually-hidden">{title}</caption>
          <thead><tr>
            <th scope="col">{r.event}</th>
            <th scope="col" className={styles.wideCol}>{r.tier}</th>
            <th scope="col" className={styles.wideCol}>{r.round}</th>
            <th scope="col" className={styles.pointsCol}>{r.points}</th>
            <th scope="col" className={styles.wideCol}>{r.expires}</th>
          </tr></thead>
          <tbody>{row.breakdown.map((item, i) => {
            const eventName = item.eventName ? pickLocalized(locale, item.eventName, item.eventNameEn) : r.manual;
            const stage = item.stageCode ? rankingStageLabel(t, item.stageCode) : null;
            const expires = formatFullDate(item.expiresAt, locale);
            const soon = isExpiringSoon(item.expiresAt, today, expiringSoonDays);
            return (
              <tr key={i}>
                <th scope="row">
                  {item.eventName && item.eventSlug ? <Link className="text-link" href={`/${locale}/events/${item.eventSlug}`}>{eventName}</Link> : eventName}
                  {soon && <span className={styles.soon}>{r.expiringSoon}</span>}
                  <span className={styles.meta}>{[item.eventTypeCode, stage, format(r.expiresOn, { date: expires })].filter(Boolean).join(' · ')}</span>
                </th>
                <td className={styles.wideCol}>{item.eventTypeCode ? <span className={styles.tier}>{item.eventTypeCode}</span> : '–'}</td>
                <td className={`${styles.wideCol} ${item.stageCode === 'W' ? styles.winner : ''}`}>{stage ?? '–'}</td>
                <td className={styles.pointsCol}>{item.points.toLocaleString(locale)}</td>
                <td className={`${styles.wideCol} ${styles.date}`}><time dateTime={item.expiresAt}>{expires}</time></td>
              </tr>
            );
          })}</tbody>
          <tfoot><tr>
            <th scope="row">{r.total}</th>
            <td className={styles.wideCol} />
            <td className={styles.wideCol} />
            <td className={`${styles.pointsCol} ${styles.total}`}>{row.points.toLocaleString(locale)}</td>
            <td className={styles.wideCol} />
          </tr></tfoot>
        </table>
      )}
    </div>
  );
}
