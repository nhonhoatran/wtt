import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '../../../components/common/empty-state';
import { PillNav } from '../../../components/common/pill-nav';
import { RankingTopCard } from '../../../components/rankings/ranking-top-card';
import styles from '../../../components/rankings/rankings.module.css';
import { getDictionary } from '../../../i18n/get-dictionary';
import { isLocale } from '../../../i18n/locales';
import { pickLocalized } from '../../../i18n/pick-localized';
import { getRankings } from '../../../lib/public-data';
import { pageMetadata } from '../../../lib/page-metadata';

interface RankingsProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RankingsProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).rankings;
  return pageMetadata(locale, '/rankings', { title: t.title, description: t.metaDescription });
}

export default async function RankingsPage({ params, searchParams }: RankingsProps) {
  const [{ locale }, query, data] = await Promise.all([params, searchParams, getRankings()]);
  if (!isLocale(locale) || !data) notFound();
  const t = getDictionary(locale);
  const kinds = [...new Set(data.items.map((row) => row.list.competitorKind))];
  const requestedKind = typeof query.kind === 'string' ? query.kind.toUpperCase() : '';
  const selected = kinds.find((kind) => kind === requestedKind) ?? kinds[0] ?? 'SINGLES';
  const lists = data.items.filter((row) => row.list.competitorKind === selected);
  const groups = new Map<string, typeof lists>();
  for (const row of lists) {
    const code = `${row.list.genderRule}:${row.list.category?.code ?? ''}`;
    const items = groups.get(code) ?? [];
    items.push(row);
    groups.set(code, items);
  }
  return (
    <main id="content" className="container">
      <h1 className="page-title heading-caps">{t.rankings.title}</h1>
      <p className={styles.intro}>{t.rankings.metaDescription}</p>
      <PillNav variant="tabs" label={t.rankings.disciplines} items={kinds.map((kind) => ({
        href: `/${locale}/rankings?kind=${kind.toLowerCase()}`,
        label: kind === 'SINGLES' ? t.rankings.singles : t.rankings.doubles,
        current: kind === selected,
      }))} />
      {lists.length === 0 ? <EmptyState text={t.rankings.empty} /> : [...groups.entries()].map(([code, items]) => (
        <section key={code}>
          <h2 className={styles.groupTitle}>
            {t.rankings.genders[items[0]!.list.genderRule]}
            {items[0]?.list.category && ` · ${pickLocalized(locale, items[0].list.category.name, items[0].list.category.nameEn)}`}
          </h2>
          <div className={styles.grid}>{items.map((ranking) => <RankingTopCard key={ranking.list.code} ranking={ranking} locale={locale} t={t} />)}</div>
        </section>
      ))}
    </main>
  );
}
