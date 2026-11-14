import type { PublicSide } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { ScrollRegion } from '../common/scroll-region';
import tableStyles from '../matches/match-score-table.module.css';
import { sideClubs, sideName } from '../matches/side-name';

export function EntryTable({ items, locale, caption, t }: { items: PublicSide[]; locale: Locale; caption: string; t: Dictionary['players'] }) {
  return (
    <ScrollRegion label={caption}>
      <table className={tableStyles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.seed}</th>
            <th scope="col" className={tableStyles.nameCol}>{t.name}</th>
            <th scope="col" className={tableStyles.nameCol}>{t.club}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((side, i) => (
            <tr key={i}>
              <td>{side.seed ?? ''}</td>
              <th scope="row" className={tableStyles.nameCol}>{sideName(locale, side)}</th>
              <td className={tableStyles.nameCol}>{sideClubs(side)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
