import Link from 'next/link';
import type { PublicPlayerResult } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { formatInstantDate } from '../../lib/format-date-time';
import { playerPerspective } from '../../lib/player-match-perspective';
import { StatusPill } from '../common/status-pill';
import { matchStageLabel } from '../matches/match-card';
import { SidePlayers } from './side-players';
import styles from './player-results.module.css';

/** Tablet and desktop layout of the results: one semantic table; phones keep the match cards. */
export function PlayerResultsTable({ items, slug, locale, t }: { items: PublicPlayerResult[]; slug: string; locale: Locale; t: Dictionary }) {
  const h = t.players.profile.resultsTable;
  return (
    <div className={styles.tableView}>
      <table className={styles.table}>
        <caption className="visually-hidden">{h.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{h.date}</th>
            <th scope="col">{h.stage}</th>
            <th scope="col">{h.opponent}</th>
            <th scope="col">{h.score}</th>
            <th scope="col">{h.result}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const p = playerPerspective(m, slug);
            const note = m.resultType === 'WALKOVER' || m.resultType === 'RETIRED' || m.resultType === 'DISQUALIFIED' ? t.bracket.result[m.resultType] : null;
            return (
              <tr key={`${m.event.slug}:${m.matchNo}`}>
                <th scope="row" className={styles.date}>{m.officialAt ? formatInstantDate(m.officialAt, locale, m.event.timezone) : <span aria-hidden="true">–</span>}</th>
                <td>
                  <Link className={styles.eventLink} href={`/${locale}/events/${m.event.slug}`}>{pickLocalized(locale, m.event.name, m.event.nameEn)}</Link>
                  <span className={styles.sub}>{pickLocalized(locale, m.subEvent.name, m.subEvent.nameEn)} · {matchStageLabel(m, t)}</span>
                </td>
                <td className={styles.opponent}>
                  {p.opponent ? <SidePlayers side={p.opponent} locale={locale} /> : <span aria-hidden="true">–</span>}
                  {p.partner && <span className={styles.sub}>{h.partner} <SidePlayers side={p.partner} locale={locale} /></span>}
                </td>
                <td>
                  <Link className={styles.scoreLink} href={`/${locale}/events/${m.event.slug}/matches/${m.matchNo}`}>
                    {p.ownGames === null || p.opponentGames === null ? '–' : `${p.ownGames}–${p.opponentGames}`}
                  </Link>
                  {p.games.length > 0 && <span className={styles.sub}>({p.games.map((g) => `${g.own}-${g.opponent}`).join(', ')})</span>}
                  {note && <span className={styles.sub}>{note}</span>}
                </td>
                <td>{p.outcome && <StatusPill variant={p.outcome === 'win' ? 'official' : 'completed'} label={p.outcome === 'win' ? t.players.profile.win : t.players.profile.loss} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
