import Link from 'next/link';
import type { PublicEventRankingPoints } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { rankingStageLabel } from '../../i18n/ranking-stage-label';
import { formatFullDate } from '../../lib/format-date-time';
import { ScrollRegion } from '../common/scroll-region';
import styles from '../matches/match-score-table.module.css';

export function RankingPointsByRoundTable({ data, endDate, locale, t }: { data: PublicEventRankingPoints; endDate: string; locale: Locale; t: Dictionary }) {
  if (data.items.length === 0) return null;
  return <section>
    <h2 className="section-title">{t.rankings.pointsByRound}</h2>
    <p className="result-count">{format(t.rankings.effective, { date: formatFullDate(endDate, locale) })}</p>
    {data.items.map(({ subEvent, list, rules }) => (
      <section key={subEvent.code}>
        <h3 className="section-title">{pickLocalized(locale, subEvent.name, subEvent.nameEn)} · <Link className="text-link" href={`/${locale}/rankings/${list.code}`}>{pickLocalized(locale, list.name, list.nameEn)}</Link></h3>
        <ScrollRegion label={`${t.rankings.pointsByRound} · ${pickLocalized(locale, subEvent.name, subEvent.nameEn)}`}>
          <table className={styles.table}>
            <caption className="visually-hidden">{pickLocalized(locale, subEvent.name, subEvent.nameEn)}</caption>
            <thead><tr><th scope="col" className={styles.nameCol}>{t.players.stagesLabel}</th><th scope="col" className={styles.nameCol}>{t.rankings.round}</th><th scope="col">{t.rankings.points}</th></tr></thead>
            <tbody>{rules.map((rule) => <tr key={`${rule.drawKind}:${rule.stageCode}`}>
              <td className={styles.nameCol}>{rule.drawKind === 'GROUP' ? t.groups.title : t.bracket.kind[rule.drawKind]}</td>
              <th scope="row" className={styles.nameCol}>{rankingStageLabel(t, rule.stageCode)}</th>
              <td>{rule.points.toLocaleString(locale)}</td>
            </tr>)}</tbody>
          </table>
        </ScrollRegion>
      </section>
    ))}
  </section>;
}
