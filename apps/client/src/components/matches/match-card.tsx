import Link from 'next/link';
import type { PublicMatchCard } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { roundLabel, sideSourceLabel } from '../../i18n/render-bracket-labels';
import { formatMatchTime } from '../../lib/format-date-time';
import { LiveBadge } from '../common/live-badge';
import { sideClubs, sideName } from './side-name';
import styles from './match-card.module.css';

interface MatchCardProps {
  match: PublicMatchCard;
  eventSlug: string;
  locale: Locale;
  timeZone: string;
  t: Dictionary;
  /** Hidden inside a page that already names the sub-event (group tables). */
  showSubEvent?: boolean;
}

/** Where a match sits: "Bảng A" for group play, else the round name. */
export function matchStageLabel(m: PublicMatchCard, t: Dictionary): string {
  return m.groupCode ? format(t.matches.group, { code: m.groupCode }) : roundLabel(t.bracket, m.round.code, m.round.number);
}

export function MatchCard({ match: m, eventSlug, locale, timeZone, t, showSubEvent = true }: MatchCardProps) {
  const result = m.resultType === 'WALKOVER' || m.resultType === 'RETIRED' || m.resultType === 'DISQUALIFIED' ? t.bracket.result[m.resultType] : null;
  const when = m.scheduledAt ? formatMatchTime(m.scheduledAt, locale, timeZone) : null;
  const sides = [
    { side: m.side1, source: m.side1Source, games: m.games1, won: m.winnerSide === 1 },
    { side: m.side2, source: m.side2Source, games: m.games2, won: m.winnerSide === 2 },
  ];
  return (
    <article className={styles.card}>
      <Link href={`/${locale}/events/${eventSlug}/matches/${m.matchNo}`} className={styles.link}>
        <div className={styles.head}>
          <span>
            {format(t.bracket.match, { matchNo: m.matchNo })}
            {showSubEvent && ` · ${pickLocalized(locale, m.subEvent.name, m.subEvent.nameEn)}`} · {matchStageLabel(m, t)}
          </span>
          {m.status === 'LIVE' ? <LiveBadge label={t.bracket.live} /> : <span>{m.status === 'SCHEDULED' ? when : result}</span>}
        </div>
        {sides.map(({ side, source, games, won }, i) => (
          <div key={i} className={`${styles.side} ${won ? styles.winner : ''}`}>
            {side?.seed != null && <span className={styles.mark}>[{side.seed}]</span>}
            <span className={side ? styles.name : `${styles.name} ${styles.placeholder}`}>
              {side ? sideName(locale, side) : sideSourceLabel(t.bracket, source)}
              {side && sideClubs(side) && <span className={styles.club}> · {sideClubs(side)}</span>}
            </span>
            <span className={styles.games}>{m.status === 'SCHEDULED' ? '' : (games ?? '')}</span>
          </div>
        ))}
        {(m.games.length > 0 || m.voided) && (
          <div className={styles.foot}>
            {m.games.map((g) => `${g.score1}-${g.score2}`).join('  ')}
            {m.voided && <span className={styles.voided}>{t.matches.voided}</span>}
          </div>
        )}
      </Link>
    </article>
  );
}
