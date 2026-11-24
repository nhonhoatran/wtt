import type { PublicBracket } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { EmptyState } from '../common/empty-state';
import { ScrollRegion } from '../common/scroll-region';
import { BracketRoundColumn } from './bracket-round-column';
import { printBracketPages } from './print-bracket-pages';
import styles from './bracket.module.css';

interface BoardProps {
  bracket: PublicBracket;
  locale: Locale;
  t: Dictionary['bracket'];
}

/** Server-rendered bracket: one CSS grid column per round, readable without JavaScript. */
export function BracketBoard({ bracket, locale, t }: BoardProps) {
  if (!bracket.sections.length) return <EmptyState text={t.empty} />;
  const many = bracket.sections.length > 1;
  return (
    <>
      <p className={styles.hint}>{t.scrollHint}</p>
      {bracket.sections.map(({ section, rounds }) => {
        const title = many ? format(t.section, { section }) : t.title;
        const pages = printBracketPages(rounds);
        const split = pages.length > 1;
        return (
          <section key={section} className={styles.section}>
            <div data-screen-bracket className={split ? styles.screenOnly : undefined}>
              {many && <h3 className="section-title">{title}</h3>}
              <ScrollRegion label={title}>
                <ol className={styles.rounds}>
                  {rounds.map((round) => (
                    <BracketRoundColumn key={round.number} heading={many ? 'h4' : 'h3'} round={round} locale={locale} t={t} timeZone={bracket.event.timezone} />
                  ))}
                </ol>
              </ScrollRegion>
            </div>
            {split && <div className={styles.printOnly} data-print-bracket>
              {pages.map((page, index) => <section className={styles.printSheet} key={index} data-print-sheet>
                <p className={styles.printHeading}>
                  {pickLocalized(locale, bracket.event.name, bracket.event.nameEn)}
                  {' · '}{pickLocalized(locale, bracket.subEvent.name, bracket.subEvent.nameEn)}
                  {' · '}{t.kind[bracket.draw.kind]}
                  {' · '}{format(t.section, { section: many ? `${section}.${index + 1}` : index + 1 })}
                  {` (${index + 1}/${pages.length})`}
                </p>
                <ol className={styles.rounds}>
                  {page.map((round) => <BracketRoundColumn key={round.number} heading="p" round={round} locale={locale} t={t} timeZone={bracket.event.timezone} />)}
                </ol>
              </section>)}
            </div>}
          </section>
        );
      })}
    </>
  );
}
