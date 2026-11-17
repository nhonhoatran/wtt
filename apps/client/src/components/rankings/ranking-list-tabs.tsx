import type { PublicRankingTop } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { PillNav } from '../common/pill-nav';

export function RankingListTabs({ lists, selected, locale, t }: { lists: PublicRankingTop[]; selected: string; locale: Locale; t: Dictionary['rankings'] }) {
  const kinds = [...new Set(lists.map((item) => item.list.competitorKind))];
  return <PillNav label={t.disciplines} items={kinds.map((kind) => ({
    href: `/${locale}/rankings?kind=${kind.toLowerCase()}`,
    label: kind === 'SINGLES' ? t.singles : t.doubles,
    current: kind === selected,
  }))} />;
}
