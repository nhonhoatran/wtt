import type { PublicBracket } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { BracketRoundColumn } from './bracket-round-column';
import styles from './bracket.module.css';

interface BoardProps {
  bracket: PublicBracket;
  locale: Locale;
  t: Dictionary['bracket'];
}

/** Server-rendered bracket: one CSS grid column per round, readable without JavaScript. */
export function BracketBoard({ bracket, locale, t }: BoardProps) {
  if (!bracket.sections.length) return <p>{t.empty}</p>;
  const many = bracket.sections.length > 1;
  return (
    <>
      <p className={styles.hint}>{t.scrollHint}</p>
      {bracket.sections.map(({ section, rounds }) => {
        const title = many ? format(t.section, { section }) : t.title;
        return (
          <section key={section} className={styles.section}>
            {many && <h2 className={styles.sectionTitle}>{title}</h2>}
            <div className={styles.scroller} tabIndex={0} role="region" aria-label={title}>
              <ol className={styles.rounds}>
                {rounds.map((round) => (
                  <BracketRoundColumn key={round.number} round={round} locale={locale} t={t} timeZone={bracket.event.timezone} />
                ))}
              </ol>
            </div>
          </section>
        );
      })}
    </>
  );
}
