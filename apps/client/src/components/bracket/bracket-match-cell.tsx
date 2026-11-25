import Link from 'next/link';
import type { PublicBracketMatch, PublicSide, PublicSideSource } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { roundLabel, sideSourceLabel } from '../../i18n/render-bracket-labels';
import { localDay, type NextMatch } from '../../lib/bracket-derivations';
import { formatClock, formatMatchTime } from '../../lib/format-date-time';
import { MATCH_STATUS_PILL, tableName } from '../../lib/match-display';
import { StatusPill } from '../common/status-pill';
import { sideClubs, sideName } from '../matches/side-name';
import { SidePlayers } from '../players/side-players';
import cell from './bracket.module.css';
import styles from './bracket-cell.module.css';

type BracketDict = Dictionary['bracket'];

interface SideRowProps {
  side: PublicSide | null;
  source: PublicSideSource | null;
  score: number | null;
  games: number[];
  isWinner: boolean;
  isBye: boolean;
  locale: Locale;
  t: BracketDict;
}

function SideRow({ side, source, score, games, isWinner, isBye, locale, t }: SideRowProps) {
  if (!side) {
    return (
      <div className={styles.side}>
        <span className={`${styles.name} ${styles.placeholder}`}>{isBye ? t.bye : sideSourceLabel(t, source)}</span>
      </div>
    );
  }
  const clubs = sideClubs(side);
  return (
    <div className={`${styles.side} ${isWinner ? styles.winner : ''}`}>
      {side.seed !== null && <span className={styles.seed}><span className="visually-hidden">{t.seed} </span>{side.seed}</span>}
      <span className={styles.who}>
        {isWinner && <span className="visually-hidden">{t.winner}: </span>}
        <span className={styles.name}>
          <SidePlayers side={side} locale={locale} />
          {side.quota && <span className={styles.mark}> ({t.quota[side.quota]})</span>}
        </span>
        {clubs && <span className={styles.club}>{clubs}</span>}
      </span>
      {games.length > 0 && (
        <span className={styles.games}>
          <span className="visually-hidden">{t.games}: </span>
          {games.map((value, i) => <span key={i} className={styles.game}>{value}</span>)}
        </span>
      )}
      <span className={styles.total}>
        {score !== null && <span className="visually-hidden">{t.gamesTotal}: </span>}
        {score ?? ''}
      </span>
    </div>
  );
}

interface CellProps {
  match: PublicBracketMatch;
  locale: Locale;
  t: BracketDict;
  timeZone: string;
  eventSlug: string;
  next: NextMatch | null;
  /** Round day; times on that day show the clock only. */
  day: string | null;
}

export function BracketMatchCell({ match, locale, t, timeZone, eventSlug, next, day }: CellProps) {
  const isBye = match.resultType === 'BYE';
  const rt = match.resultType;
  const result = rt === 'WALKOVER' || rt === 'RETIRED' || rt === 'DISQUALIFIED' ? t.result[rt] : null;
  const started = match.status !== 'SCHEDULED';
  const when = match.scheduledAt
    ? day === localDay(match.scheduledAt, timeZone) ? formatClock(match.scheduledAt, locale, timeZone) : formatMatchTime(match.scheduledAt, locale, timeZone)
    : null;
  const tableLabel = tableName(match.table, t.tableCode);
  const meta = [tableLabel, when, result].filter(Boolean).join(' · ');
  const shared = { locale, t, isBye };
  const gameScores = started ? match.games : [];
  const label = (side: PublicSide | null, source: PublicSideSource | null) => side ? sideName(locale, side) : sideSourceLabel(t, source);
  const target = next && `${roundLabel(t, next.round.code, next.round.number)}${next.round.matches.length > 1 ? ` ${next.orderInRound}` : ''}`;
  return (
    <div className={`${cell.cell} ${styles.box} ${match.status === 'LIVE' ? styles.live : ''}`} data-match-number={match.matchNo}>
      <div className={styles.head}>
        <span>{format(t.match, { matchNo: match.matchNo })}</span>
        {!isBye && <StatusPill variant={MATCH_STATUS_PILL[match.status]} label={t.status[match.status]} />}
      </div>
      <SideRow {...shared} side={match.side1} source={match.side1Source} score={started ? match.games1 : null} games={gameScores.map((g) => g.score1)} isWinner={match.winnerSide === 1} />
      <SideRow {...shared} side={match.side2} source={match.side2Source} score={started ? match.games2 : null} games={gameScores.map((g) => g.score2)} isWinner={match.winnerSide === 2} />
      {!isBye && (
        <div className={styles.foot}>
          <span>{meta}</span>
          <Link
            className={styles.detail}
            href={`/${locale}/events/${eventSlug}/matches/${match.matchNo}`}
            aria-label={format(t.detailLabel, { matchNo: match.matchNo, a: label(match.side1, match.side1Source), b: label(match.side2, match.side2Source) })}
          >
            {t.detail} <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
      {target && <p className={styles.next}>{format(t.nextMatch, { target })}</p>}
    </div>
  );
}
