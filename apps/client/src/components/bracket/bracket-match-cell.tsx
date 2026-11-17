import type { PublicBracketMatch, PublicSide, PublicSideSource } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { sideSourceLabel } from '../../i18n/render-bracket-labels';
import { formatMatchTime } from '../../lib/format-date-time';
import { LiveBadge } from '../common/live-badge';
import { SidePlayers } from '../players/side-players';
import styles from './bracket.module.css';

type BracketDict = Dictionary['bracket'];

interface SideRowProps {
  side: PublicSide | null;
  source: PublicSideSource | null;
  score: number | null;
  isWinner: boolean;
  isBye: boolean;
  locale: Locale;
  t: BracketDict;
}

function SideRow({ side, source, score, isWinner, isBye, locale, t }: SideRowProps) {
  if (!side) {
    return (
      <div className={styles.side}>
        <span className={`${styles.name} ${styles.placeholder}`}>{isBye ? t.bye : sideSourceLabel(t, source)}</span>
      </div>
    );
  }
  const clubs = [...new Set(side.players.map((p) => p.club).filter(Boolean))].join(' / ');
  return (
    <div className={`${styles.side} ${isWinner ? styles.winner : ''}`} title={clubs || undefined}>
      {side.seed !== null && <span className={styles.mark}>[{side.seed}]</span>}
      <span className={styles.name}><SidePlayers side={side} locale={locale} /></span>
      {side.quota && <span className={styles.mark}>({t.quota[side.quota]})</span>}
      <span className={styles.score}>{score ?? ''}</span>
    </div>
  );
}

export function BracketMatchCell({ match, locale, t, timeZone }: { match: PublicBracketMatch; locale: Locale; t: BracketDict; timeZone: string }) {
  const isBye = match.resultType === 'BYE';
  const rt = match.resultType;
  const result = rt === 'WALKOVER' || rt === 'RETIRED' || rt === 'DISQUALIFIED' ? t.result[rt] : null;
  const when = match.status === 'SCHEDULED' && match.scheduledAt ? formatMatchTime(match.scheduledAt, locale, timeZone) : null;
  const shared = { locale, t, isBye };
  return (
    <div className={styles.cell}>
      <div className={styles.cellHead}>
        <span>{format(t.match, { matchNo: match.matchNo })}</span>
        {match.status === 'LIVE' ? <LiveBadge label={t.live} /> : <span>{result ?? when ?? ''}</span>}
      </div>
      <SideRow {...shared} side={match.side1} source={match.side1Source} score={match.games1} isWinner={match.winnerSide === 1} />
      <SideRow {...shared} side={match.side2} source={match.side2Source} score={match.games2} isWinner={match.winnerSide === 2} />
    </div>
  );
}
