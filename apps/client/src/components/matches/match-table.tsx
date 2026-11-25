import Link from 'next/link';
import type { PublicMatchCard, PublicSide } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { sideSourceLabel } from '../../i18n/render-bracket-labels';
import { formatMatchTime } from '../../lib/format-date-time';
import { MATCH_STATUS_PILL, tableName } from '../../lib/match-display';
import { StatusPill } from '../common/status-pill';
import { SidePlayers } from '../players/side-players';
import { matchStageLabel } from './match-card';
import { sideClubs, sideName } from './side-name';
import styles from './match-table.module.css';

interface MatchTableProps {
  matches: PublicMatchCard[];
  eventSlug: string;
  locale: Locale;
  timeZone: string;
  t: Dictionary;
}

function SideLine({ side, source, won, locale, t }: { side: PublicSide | null; source: PublicMatchCard['side1Source']; won: boolean; locale: Locale; t: Dictionary }) {
  if (!side) return <p className={`${styles.side} ${styles.placeholder}`}>{sideSourceLabel(t.bracket, source)}</p>;
  const clubs = sideClubs(side);
  return (
    <p className={`${styles.side} ${won ? styles.winner : ''}`}>
      {side.seed != null && <span className={styles.seed}><span className="visually-hidden">{t.bracket.seed} </span>{side.seed}</span>}
      <span>
        {won && <span className="visually-hidden">{t.bracket.winner}: </span>}
        <SidePlayers side={side} locale={locale} />
        {clubs && <span className={styles.club}> {clubs}</span>}
      </span>
    </p>
  );
}

/** Desktop layout of the match list: one semantic table, same data as the cards. */
export function MatchTable({ matches, eventSlug, locale, timeZone, t }: MatchTableProps) {
  const h = t.matches.table;
  return (
    <div className={styles.view}>
    <table className={styles.table}>
      <caption className="visually-hidden">{h.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{h.time}</th>
          <th scope="col">{h.stage}</th>
          <th scope="col">{h.players}</th>
          <th scope="col" className={styles.scoreCol}>{h.score}</th>
          <th scope="col">{h.status}</th>
          <th scope="col"><span className="visually-hidden">{h.detail}</span></th>
        </tr>
      </thead>
      <tbody>
        {matches.map((m) => {
          const rt = m.resultType;
          const result = rt === 'WALKOVER' || rt === 'RETIRED' || rt === 'DISQUALIFIED' ? t.bracket.result[rt] : null;
          const table = tableName(m.table, t.schedule.tableCode);
          const started = m.status !== 'SCHEDULED';
          return (
            <tr key={m.matchNo}>
              <th scope="row" className={styles.timeCell}>
                <span className={styles.time}>{m.scheduledAt ? formatMatchTime(m.scheduledAt, locale, timeZone) : t.schedule.timePending}</span>
                {table && <span className={styles.tableTag}>{table}</span>}
              </th>
              <td>
                <span className={styles.subEvent}>{pickLocalized(locale, m.subEvent.name, m.subEvent.nameEn)}</span>
                <span className={styles.round}>{matchStageLabel(m, t)}</span>
              </td>
              <td>
                <SideLine side={m.side1} source={m.side1Source} won={m.winnerSide === 1} locale={locale} t={t} />
                <SideLine side={m.side2} source={m.side2Source} won={m.winnerSide === 2} locale={locale} t={t} />
              </td>
              <td className={styles.scoreCol}>
                <span className={styles.score}>{started ? `${m.games1 ?? 0} – ${m.games2 ?? 0}` : <span aria-hidden="true">–</span>}</span>
                {started && m.games.length > 0 && <span className={styles.games}>{m.games.map((g) => `${g.score1}-${g.score2}`).join(', ')}</span>}
              </td>
              <td>
                <StatusPill variant={MATCH_STATUS_PILL[m.status]} label={t.bracket.status[m.status]} />
                {result && <span className={styles.note}>{result}</span>}
                {m.voided && <span className={styles.note}>{t.matches.voided}</span>}
              </td>
              <td>
                <Link
                  className={styles.link}
                  href={`/${locale}/events/${eventSlug}/matches/${m.matchNo}`}
                  aria-label={format(t.bracket.detailLabel, { matchNo: m.matchNo, a: sideName(locale, m.side1) || sideSourceLabel(t.bracket, m.side1Source), b: sideName(locale, m.side2) || sideSourceLabel(t.bracket, m.side2Source) })}
                >
                  {t.bracket.detail} <span aria-hidden="true">→</span>
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
