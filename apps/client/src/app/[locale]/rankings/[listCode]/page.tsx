import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';
import { EmptyState } from '../../../../components/common/empty-state';
import { FilterForm } from '../../../../components/common/filter-form';
import { PaginationLinks } from '../../../../components/common/pagination-links';
import { RankingTable } from '../../../../components/rankings/ranking-table';
import styles from '../../../../components/rankings/rankings.module.css';
import { format, getDictionary } from '../../../../i18n/get-dictionary';
import { isLocale } from '../../../../i18n/locales';
import { pickLocalized } from '../../../../i18n/pick-localized';
import { formatFullDate } from '../../../../lib/format-date-time';
import { getRankingList, isUrlPart } from '../../../../lib/public-data';
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
  const [{ locale, listCode, catalog, t }, query] = await Promise.all([loadRanking(params), searchParams]);
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
      <p className="eyebrow"><Link href={`/${locale}/rankings`}>{t.rankings.title}</Link></p>
      <h1 className="page-title">{name}</h1>
      <p className={styles.intro}>{data.asOfDate ? format(t.rankings.updated, { date: formatFullDate(data.asOfDate, locale) }) : t.rankings.pending}</p>
      <FilterForm action={base} label={t.rankings.filters} t={t.common} fields={[
        { kind: 'search', name: 'q', label: t.rankings.search, value: selected.get('q') ?? '', maxLength: PUBLIC_SEARCH_MAX_LENGTH },
        { kind: 'select', name: 'club', label: t.rankings.club, value: selected.get('club') ?? '', options: data.clubs.map((club) => ({ value: club, label: club })) },
      ]} />
      <h2 className="result-count">{format(t.common.resultCount, { n: data.total })}</h2>
      {data.items.length ? <RankingTable items={data.items} caption={name} locale={locale} t={t} /> : <EmptyState text={data.asOfDate ? t.rankings.filteredEmpty : t.rankings.pending} />}
      {data.items.length > 0 && <p className={styles.note}>{t.rankings.snapshotNote}</p>}
      <PaginationLinks {...data} t={t.common} hrefFor={(page) => {
        const next = new URLSearchParams(filterQuery);
        if (page > 1) next.set('page', String(page));
        return next.size ? `${base}?${next}` : base;
      }} />
    </main>
  );
}
