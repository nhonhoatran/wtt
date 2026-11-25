import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appSettingRegistry, PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';
import { EmptyState } from '../../../../components/common/empty-state';
import { FilterForm } from '../../../../components/common/filter-form';
import { PaginationLinks } from '../../../../components/common/pagination-links';
import { RankingAccordionList } from '../../../../components/rankings/ranking-accordion-list';
import { RankingListSwitcher } from '../../../../components/rankings/ranking-list-switcher';
import { RankingPageHeader } from '../../../../components/rankings/ranking-page-header';
import styles from '../../../../components/rankings/rankings.module.css';
import { format, getDictionary } from '../../../../i18n/get-dictionary';
import { isLocale } from '../../../../i18n/locales';
import { pickLocalized } from '../../../../i18n/pick-localized';
import { todayIn } from '../../../../lib/expiring-soon';
import { formatFullDate } from '../../../../lib/format-date-time';
import { getRankingList, getRankings, getSiteConfig, getStaticPage, isUrlPart } from '../../../../lib/public-data';
import { anyText, isPageParam, oneOf, toQuery } from '../../../../lib/public-query';
import { pageMetadata } from '../../../../lib/page-metadata';

interface RankingProps {
  params: Promise<{ locale: string; listCode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function loadRanking(params: RankingProps['params']) {
  const { locale, listCode } = await params;
  if (!isLocale(locale) || !isUrlPart(listCode)) notFound();
  const catalog = await getRankingList(listCode);
  if (!catalog) notFound();
  return { locale, listCode, catalog, t: getDictionary(locale) };
}

export async function generateMetadata({ params }: RankingProps): Promise<Metadata> {
  const { locale, listCode, catalog, t } = await loadRanking(params);
  const name = pickLocalized(locale, catalog.list.name, catalog.list.nameEn);
  const title = `${t.rankings.title} ${name}${catalog.asOfDate ? ` — ${format(t.rankings.updated, { date: formatFullDate(catalog.asOfDate, locale) })}` : ''}`;
  return pageMetadata(locale, `/rankings/${listCode}`, { title, description: t.rankings.metaDescription });
}

export default async function RankingPage({ params, searchParams }: RankingProps) {
  const [{ locale, listCode, catalog, t }, query, overview, config] = await Promise.all([
    loadRanking(params), searchParams, getRankings().catch(() => null), getSiteConfig().catch(() => null),
  ]);
  const expiringSoonDays = config?.display?.rankingExpiringSoonDays ?? appSettingRegistry.expiringSoonDays.defaultValue;
  const timezone = config?.display?.timezone ?? appSettingRegistry.defaultTimezone.defaultValue;
  const guideSlug = config?.display?.rankingPointsGuideSlug;
  const guide = guideSlug && isUrlPart(guideSlug) ? await getStaticPage(guideSlug).catch(() => null) : null;
  const rules = { q: anyText, club: oneOf(catalog.clubs) };
  const filterQuery = toQuery(query, rules);
  const listQuery = toQuery(query, { ...rules, page: isPageParam });
  const searching = Boolean(typeof query.q === 'string' && query.q.trim());
  const data = listQuery ? await getRankingList(listCode, listQuery, searching) : catalog;
  if (!data) notFound();
  const base = `/${locale}/rankings/${listCode}`;
  const selected = new URLSearchParams(filterQuery);
  const name = pickLocalized(locale, data.list.name, data.list.nameEn);
  return (
    <main id="content" className="container">
      <RankingPageHeader locale={locale} t={t} name={name} updated={data.asOfDate ? format(t.rankings.updated, { date: formatFullDate(data.asOfDate, locale) }) : t.rankings.pending} guideHref={guide ? `/${locale}/pages/${guide.slug}` : null} />
      {overview && <RankingListSwitcher lists={overview.items} current={data.list} locale={locale} t={t.rankings} />}
      <FilterForm action={base} label={t.rankings.filters} t={t.common} fields={[
        { kind: 'search', name: 'q', label: t.rankings.search, value: selected.get('q') ?? '', maxLength: PUBLIC_SEARCH_MAX_LENGTH },
        { kind: 'select', name: 'club', label: t.rankings.club, value: selected.get('club') ?? '', options: data.clubs.map((club) => ({ value: club, label: club })) },
      ]} />
      <h2 className="result-count">{format(t.common.resultCount, { n: data.total })}</h2>
      {data.items.length ? <RankingAccordionList items={data.items} label={name} locale={locale} t={t} today={todayIn(timezone)} expiringSoonDays={expiringSoonDays} /> : <EmptyState text={data.asOfDate ? t.rankings.filteredEmpty : t.rankings.pending} />}
      {data.items.length > 0 && <p className={styles.snapshot}>{t.rankings.snapshotNote}</p>}
      <PaginationLinks {...data} t={t.common} hrefFor={(page) => {
        const next = new URLSearchParams(filterQuery);
        if (page > 1) next.set('page', String(page));
        return next.size ? `${base}?${next}` : base;
      }} />
    </main>
  );
}
