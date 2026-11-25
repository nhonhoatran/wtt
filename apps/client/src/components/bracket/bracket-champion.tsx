import type { PublicSide } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { sideClubs } from '../matches/side-name';
import { SidePlayers } from '../players/side-players';
import styles from './bracket.module.css';
import champion from './bracket-champion.module.css';

interface ChampionProps {
  /** Winner of the final; null while the final is open. */
  side: PublicSide | null;
  locale: Locale;
  t: Dictionary['bracket'];
  heading: 'h3' | 'h4';
  selected: boolean;
}

/** Last column of a main draw: names the champion, or says it is not decided yet. */
export function BracketChampion({ side, locale, t, heading: Heading, selected }: ChampionProps) {
  return (
    <li className={styles.round} data-selected={selected ? '' : undefined} data-champion>
      <Heading className={styles.roundTitle}>{t.championTitle}</Heading>
      <div className={champion.body}>
        <div className={champion.card}>
          <span className={champion.label}>{t.championLabel}</span>
          {side ? (
            <>
              <span className={champion.name}><SidePlayers side={side} locale={locale} /></span>
              {sideClubs(side) && <span className={champion.club}>{sideClubs(side)}</span>}
            </>
          ) : <span className={champion.tbd}>{t.championTbd}</span>}
        </div>
      </div>
    </li>
  );
}
