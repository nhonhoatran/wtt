import type { PublicMatchDetail, PublicSide } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { sideSourceLabel } from '../../i18n/render-bracket-labels';
import { InitialsAvatar } from '../common/initials-avatar';
import { SidePlayers } from '../players/side-players';
import { sideClubs } from './side-name';
import styles from './match-scoreboard.module.css';

interface SideBlockProps {
  match: PublicMatchDetail;
  index: 0 | 1;
  locale: Locale;
  t: Dictionary;
}

function SideBlock({ match: m, index, locale, t }: SideBlockProps) {
  const side: PublicSide | null = index === 0 ? m.side1 : m.side2;
  const source = index === 0 ? m.side1Source : m.side2Source;
  const games = index === 0 ? m.games1 : m.games2;
  const won = m.winnerSide === index + 1;
  const clubs = side ? sideClubs(side) : '';
  const score = m.status === 'SCHEDULED' ? '–' : (games ?? 0);
  return (
    <div className={`${styles.side} ${index === 1 ? styles.right : ''} ${won ? styles.winner : ''}`}>
      <span className={styles.avatars}>
        {side?.players.slice(0, 2).map((p, i) => <InitialsAvatar key={i} name={pickLocalized(locale, p.name, p.nameEn)} size={56} className={styles.avatar} />)}
      </span>
      <div className={styles.who}>
        {side?.seed != null && <span className={styles.seed}>{t.bracket.seed} {side.seed}</span>}
        <p className={styles.name}>
          {won && <span className="visually-hidden">{t.bracket.winner}: </span>}
          {side ? <SidePlayers side={side} locale={locale} /> : sideSourceLabel(t.bracket, source)}
        </p>
        {clubs && <p className={styles.club}>{clubs}</p>}
      </div>
      <p className={styles.sideScore}>
        <span className="visually-hidden">{t.bracket.gamesTotal}: </span>
        {score}
      </p>
    </div>
  );
}

export function MatchScoreboard({ match: m, locale, t }: { match: PublicMatchDetail; locale: Locale; t: Dictionary }) {
  const started = m.status !== 'SCHEDULED';
  return (
    <section className={styles.board} aria-label={t.match.status[m.status]}>
      <SideBlock match={m} index={0} locale={locale} t={t} />
      <div className={styles.center}>
        <p className={styles.centerScore}>
          <span className="visually-hidden">{t.bracket.gamesTotal}: </span>
          {started ? `${m.games1 ?? 0} – ${m.games2 ?? 0}` : '–'}
        </p>
        <p className={styles.caption}>{t.match.scoreCaption}</p>
      </div>
      <SideBlock match={m} index={1} locale={locale} t={t} />
      {m.voided && <p className={styles.voided}>{t.match.voidedNote}</p>}
      {m.resultType && m.resultType !== 'NORMAL' && (
        <p className={styles.result}>{format(t.match.resultNote, { result: t.bracket.result[m.resultType] })}</p>
      )}
    </section>
  );
}
