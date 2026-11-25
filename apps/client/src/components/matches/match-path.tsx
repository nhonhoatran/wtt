import Link from 'next/link';
import type { PublicBracketRound, PublicMatchDetail } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { roundLabel, sideSourceLabel } from '../../i18n/render-bracket-labels';
import { pathToMatch, type PathStep } from '../../lib/bracket-derivations';
import { sideName } from './side-name';
import styles from './match-path.module.css';

interface MatchPathProps {
  rounds: PublicBracketRound[];
  match: PublicMatchDetail;
  locale: Locale;
  t: Dictionary;
}

function StepRow({ step, match, locale, t }: { step: PathStep; match: PublicMatchDetail; locale: Locale; t: Dictionary }) {
  if (step.kind === 'source') {
    const stage = step.source.type === 'GROUP_PLACE' ? t.match.path.groupStage : t.match.path.qualifying;
    return (
      <li className={styles.step}>
        <span className={styles.stage}>{stage}</span>
        <span className={styles.text}>{sideSourceLabel(t.bracket, step.source)}</span>
      </li>
    );
  }
  const { match: played, opponent, wonGames, lostGames } = step;
  const rt = played.resultType;
  const result = rt === 'WALKOVER' || rt === 'RETIRED' || rt === 'DISQUALIFIED' ? t.bracket.result[rt] : null;
  const label = result
    ? format(t.match.path.beatResult, { opponent: sideName(locale, opponent), result })
    : format(t.match.path.beat, { opponent: sideName(locale, opponent), a: wonGames, b: lostGames });
  return (
    <li className={styles.step}>
      <span className={styles.stage}>{roundLabel(t.bracket, step.round.code, step.round.number)}</span>
      <Link className={styles.text} href={`/${locale}/events/${match.event.slug}/matches/${played.matchNo}`}>{label}</Link>
    </li>
  );
}

/** How each side got here, drawn from the bracket; renders nothing when no earlier match is known. */
export function MatchPath({ rounds, match, locale, t }: MatchPathProps) {
  const paths = pathToMatch(rounds, match.matchNo);
  const sides = [match.side1, match.side2];
  const shown = paths.flatMap((steps, i) => (steps.length > 0 && sides[i] ? [{ steps, side: sides[i]! }] : []));
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="match-path">
      <h2 id="match-path" className="section-title">{t.match.path.title}</h2>
      <div className={styles.grid}>
        {shown.map(({ steps, side }, i) => (
          <div key={i} className={styles.card}>
            <h3 className={styles.who}>{sideName(locale, side)}</h3>
            <ol className={styles.steps}>
              {steps.map((step, j) => <StepRow key={j} step={step} match={match} locale={locale} t={t} />)}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
