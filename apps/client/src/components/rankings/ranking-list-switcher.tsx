import type { PublicRankingListInfo, PublicRankingTop } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { PillNav } from '../common/pill-nav';
import styles from './rankings.module.css';

/** Few lists: one tab per list. Many lists (age groups): tabs per singles/doubles, then the lists of that kind as links. */
export function RankingListSwitcher({ lists, current, locale, t, maxTabs = 5 }: { lists: PublicRankingTop[]; current: PublicRankingListInfo; locale: Locale; t: Dictionary['rankings']; maxTabs?: number }) {
  const href = (code: string) => `/${locale}/rankings/${encodeURIComponent(code)}`;
  const name = (info: PublicRankingListInfo) => pickLocalized(locale, info.name, info.nameEn);
  if (!lists.some((l) => l.list.code === current.code) || lists.length < 2) return null;
  if (lists.length <= maxTabs) {
    return <PillNav variant="tabs" label={t.listsNav} items={lists.map(({ list }) => ({ href: href(list.code), label: name(list), current: list.code === current.code }))} />;
  }
  const kinds = [...new Set(lists.map((l) => l.list.competitorKind))];
  const sameKind = lists.filter((l) => l.list.competitorKind === current.competitorKind);
  return (
    <div className={styles.lists}>
      {kinds.length > 1 && (
        <PillNav variant="tabs" label={t.kindsNav} items={kinds.map((kind) => ({
          href: href(lists.find((l) => l.list.competitorKind === kind)!.list.code),
          label: kind === 'SINGLES' ? t.singles : t.doubles,
          current: kind === current.competitorKind,
          group: true,
        }))} />
      )}
      <PillNav label={t.listsNav} items={sameKind.map(({ list }) => ({ href: href(list.code), label: name(list), current: list.code === current.code }))} />
    </div>
  );
}
