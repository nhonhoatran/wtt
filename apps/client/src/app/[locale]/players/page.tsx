import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';
import { EmptyState } from '../../../components/common/empty-state';
import { FilterForm } from '../../../components/common/filter-form';
import { PaginationLinks } from '../../../components/common/pagination-links';
import { PlayerTable } from '../../../components/players/player-table';
import { format, getDictionary } from '../../../i18n/get-dictionary';
import { isLocale } from '../../../i18n/locales';
import { getPlayerList } from '../../../lib/public-data';
import { pageMetadata } from '../../../lib/page-metadata';
import { anyText, isPageParam, oneOf, toQuery } from '../../../lib/public-query';

interface PlayersProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PlayersProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).players;
  return pageMetadata(locale, '/players', { title: t.title, description: t.metaDescription });
}

export default async function PlayersPage({ params, searchParams }: PlayersProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const catalog = await getPlayerList();
  if (!catalog) notFound();
  const rules = { q: anyText, gender: oneOf(['MALE', 'FEMALE']), club: oneOf(catalog.clubs), sort: oneOf(['name', 'rank']) };
  const filterQuery = toQuery(query, rules);
  const listQuery = toQuery(query, { ...rules, page: isPageParam });
  const searching = Boolean(typeof query.q === 'string' && query.q.trim());
  const data = listQuery ? await getPlayerList(listQuery, searching) : catalog;
  if (!data) notFound();
  const base = `/${locale}/players`;
  const selected = new URLSearchParams(filterQuery);
  return (
    <main id="content" className="container">
      <h1 className="page-title">{t.players.title}</h1>
      <FilterForm action={base} label={t.players.filters} t={t.common} fields={[
        { kind: 'search', name: 'q', label: t.players.search, value: selected.get('q') ?? '', maxLength: PUBLIC_SEARCH_MAX_LENGTH },
        { kind: 'select', name: 'gender', label: t.players.gender, value: selected.get('gender') ?? '', options: ['MALE', 'FEMALE'].map((gender) => ({ value: gender, label: t.players.genders[gender as 'MALE' | 'FEMALE'] })) },
        { kind: 'select', name: 'club', label: t.players.club, value: selected.get('club') ?? '', options: data.clubs.map((club) => ({ value: club, label: club })) },
        { kind: 'select', name: 'sort', label: t.players.sort, value: selected.get('sort') ?? 'name', allLabel: null, options: [{ value: 'name', label: t.players.sortName }, { value: 'rank', label: t.players.sortRank }] },
      ]} />
      <h2 className="result-count">{format(t.players.count, { n: data.total })}</h2>
      {data.items.length ? <PlayerTable items={data.items} locale={locale} t={t.players} /> : <EmptyState text={t.players.filteredEmpty} />}
      <PaginationLinks {...data} t={t.common} hrefFor={(page) => {
        const next = new URLSearchParams(filterQuery);
        if (page > 1) next.set('page', String(page));
        return next.size ? `${base}?${next}` : base;
      }} />
    </main>
  );
}
