import Link from 'next/link';
import type { PublicStripItem } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { roundLabel } from '../../i18n/render-bracket-labels';
import { StatusPill } from '../common/status-pill';
import { sideName } from '../matches/side-name';
import styles from './results-strip.module.css';

/** One link per card; its accessible name comes from the visible content (WCAG 2.5.3), so no aria-label. */
export function ResultsStripItem({ match: m, locale, t }: { match: PublicStripItem; locale: Locale; t: Dictionary }) {
  const stage = m.groupCode ? format(t.matches.group, { code: m.groupCode }) : roundLabel(t.bracket, m.round.code, m.round.number);
  const table = m.table ? format(t.strip.table, { name: m.table.displayName || m.table.code }) : null;
  const live = m.status === 'LIVE';
  const status = live ? t.bracket.live : t.strip.official;
  const sides = [
    { name: sideName(locale, m.side1), total: m.games1, scores: m.games.map((g) => g.score1), won: m.winnerSide === 1 },
    { name: sideName(locale, m.side2), total: m.games2, scores: m.games.map((g) => g.score2), won: m.winnerSide === 2 },
  ];
  return (
    <Link href={`/${locale}/events/${m.event.slug}/matches/${m.matchNo}`} className={styles.card}>
      <span className="visually-hidden">{format(t.bracket.match, { matchNo: m.matchNo })}. </span>
      <span className={styles.meta}>
        <span className={styles.context}>{[m.subEvent.code, stage, table].filter(Boolean).join(' · ')}</span>
        <StatusPill variant={live ? 'live' : 'official'} label={status} dot={live} />
      </span>
      {sides.map((side, i) => (
        <span key={i} className={`${styles.side} ${side.won ? styles.won : ''}`}>
          <span className={styles.name}>{side.name}</span>
          <span className={styles.scores}>
            {side.scores.map((s, n) => <span key={n}>{s}</span>)}
          </span>
          <strong className={styles.total}>{side.total ?? 0}</strong>
        </span>
      ))}
    </Link>
  );
}
