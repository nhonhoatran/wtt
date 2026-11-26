import type { PublicBracket } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { championSide, finalMatch, nextMatchByNo, parseRoundParam, pickRound, roundParamKey } from '../../lib/bracket-derivations';
import { EmptyState } from '../common/empty-state';
import { ScrollRegion } from '../common/scroll-region';
import { BracketChampion } from './bracket-champion';
import { BracketLegend } from './bracket-legend';
import { BracketNextRoundCard } from './bracket-next-round-card';
import { BracketPrintSheets } from './bracket-print-sheets';
import { BracketRoundChips } from './bracket-round-chips';
import { BracketRoundColumn } from './bracket-round-column';
import { printBracketPages } from './print-bracket-pages';
import styles from './bracket.module.css';
import nav from './bracket-nav.module.css';

interface BoardProps {
  bracket: PublicBracket;
  locale: Locale;
  t: Dictionary['bracket'];
  /** Page query; each section reads its own round key (see roundParamKey), and narrow screens show only that round. */
  query?: Record<string, string | string[] | undefined>;
  /** Builds the link of a round chip from the section's query key and the round; without it no chips are drawn. */
  roundHref?: (key: string, round: number) => string;
  /** Link to the group stage of this sub-event, when it has one. */
  groupsHref?: string | null;
}

/** Server-rendered bracket: one CSS grid column per round, readable without JavaScript. */
export function BracketBoard({ bracket, locale, t, query = {}, roundHref, groupsHref = null }: BoardProps) {
  if (!bracket.sections.length) return <EmptyState text={t.empty} />;
  const many = bracket.sections.length > 1;
  const { timezone } = bracket.event;
  return (
    <>
      <BracketLegend t={t} groupsHref={groupsHref} />
      <p className={nav.hint}>{t.scrollHint}</p>
      {bracket.sections.map(({ section, rounds }) => {
        const title = many ? format(t.section, { section }) : t.title;
        const pages = printBracketPages(rounds);
        const split = pages.length > 1;
        const roundKey = roundParamKey(section, many);
        const selected = pickRound(parseRoundParam(query[roundKey]), rounds);
        const nextByNo = nextMatchByNo(rounds);
        const final = many || bracket.draw.kind !== 'MAIN' ? null : finalMatch(rounds);
        const shared = { locale, t, timeZone: timezone, eventSlug: bracket.event.slug, nextByNo };
        return (
          <section key={section} className={styles.section}>
            <div data-screen-bracket className={split ? styles.screenOnly : undefined}>
              {many && <h3 className="section-title">{title}</h3>}
              {roundHref && <BracketRoundChips rounds={rounds} selected={selected} hrefFor={(round) => roundHref(roundKey, round)} locale={locale} t={t} timeZone={timezone} label={title} />}
              <ScrollRegion label={title}>
                <ol className={styles.rounds}>
                  {rounds.map((round) => (
                    <BracketRoundColumn key={round.number} heading={many ? 'h4' : 'h3'} round={round} selected={round.number === selected} {...shared} />
                  ))}
                  {final && <BracketChampion side={championSide(final)} locale={locale} t={t} heading={many ? 'h4' : 'h3'} selected={rounds.at(-1)?.number === selected} />}
                </ol>
              </ScrollRegion>
              {roundHref && <BracketNextRoundCard rounds={rounds} selected={selected} hrefFor={(round) => roundHref(roundKey, round)} locale={locale} t={t} timeZone={timezone} />}
            </div>
            {split && <BracketPrintSheets bracket={bracket} section={section} many={many} pages={pages} {...shared} />}
          </section>
        );
      })}
    </>
  );
}
