import type { PublicMatchDetail } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { roundLabel } from '../../i18n/render-bracket-labels';
import type { FollowUp } from '../../lib/bracket-derivations';
import { matchSummarySentence } from './match-summary-sentence';
import { sideName } from './side-name';
import styles from './match-summary.module.css';

/** One sentence for a finished, counted match; nothing while it is open or its result was voided. */
export function MatchSummary({ match: m, locale, t, followUp }: { match: PublicMatchDetail; locale: Locale; t: Dictionary; followUp: FollowUp | null }) {
  const winner = m.winnerSide === 1 ? m.side1 : m.winnerSide === 2 ? m.side2 : null;
  if (m.status !== 'OFFICIAL' || m.voided || !winner) return null;
  const [wonGames, lostGames] = m.winnerSide === 1 ? [m.games1 ?? 0, m.games2 ?? 0] : [m.games2 ?? 0, m.games1 ?? 0];
  const rt = m.resultType;
  const sentence = matchSummarySentence({
    t: t.match,
    winner: sideName(locale, winner),
    wonGames,
    lostGames,
    result: rt === 'WALKOVER' || rt === 'RETIRED' || rt === 'DISQUALIFIED' ? t.bracket.result[rt] : null,
    next: followUp && { round: roundLabel(t.bracket, followUp.next.round.code, followUp.next.round.number), opponent: followUp.opponent ? sideName(locale, followUp.opponent) : null },
  });
  return (
    <p className={styles.summary}>
      <strong>{t.match.summaryLabel}:</strong> {sentence}
    </p>
  );
}
