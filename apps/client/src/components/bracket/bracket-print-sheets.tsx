import type { PublicBracket, PublicBracketRound } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import type { NextMatch } from '../../lib/bracket-derivations';
import { BracketRoundColumn } from './bracket-round-column';
import styles from './bracket.module.css';

interface SheetsProps {
  bracket: PublicBracket;
  section: number;
  many: boolean;
  pages: PublicBracketRound[][];
  locale: Locale;
  t: Dictionary['bracket'];
  timeZone: string;
  eventSlug: string;
  nextByNo: Map<number, NextMatch>;
}

/** Paper copy of a large draw: each sheet keeps one subtree together and repeats the event context. */
export function BracketPrintSheets({ bracket, section, many, pages, ...column }: SheetsProps) {
  const { locale, t } = column;
  return (
    <div className={styles.printOnly} data-print-bracket>
      {pages.map((page, index) => (
        <section className={styles.printSheet} key={index} data-print-sheet>
          <p className={styles.printHeading}>
            {pickLocalized(locale, bracket.event.name, bracket.event.nameEn)}
            {' · '}{pickLocalized(locale, bracket.subEvent.name, bracket.subEvent.nameEn)}
            {' · '}{t.kind[bracket.draw.kind]}
            {' · '}{format(t.section, { section: many ? `${section}.${index + 1}` : index + 1 })}
            {` (${index + 1}/${pages.length})`}
          </p>
          <ol className={styles.rounds}>
            {page.map((round) => <BracketRoundColumn key={round.number} heading="p" round={round} selected {...column} />)}
          </ol>
        </section>
      ))}
    </div>
  );
}
