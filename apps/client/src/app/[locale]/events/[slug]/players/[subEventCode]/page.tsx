import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PUBLIC_ENTRY_STAGES, type PublicEntryList } from '@kamito/shared';
import { EmptyState } from '../../../../../../components/common/empty-state';
import { PaginationLinks } from '../../../../../../components/common/pagination-links';
import { PillNav } from '../../../../../../components/common/pill-nav';
import { EventShell } from '../../../../../../components/events/event-shell';
import { SubEventChooser } from '../../../../../../components/events/sub-event-chooser';
import { EntryTable } from '../../../../../../components/players/entry-table';
import { format } from '../../../../../../i18n/get-dictionary';
import { pickLocalized } from '../../../../../../i18n/pick-localized';
import { loadEventPage, requireSubEvent } from '../../../../../../lib/event-page';
import { getEntries } from '../../../../../../lib/public-data';
import { isPageParam, oneOf, toQuery } from '../../../../../../lib/public-query';
import { eventPageMetadata } from '../../../../../../lib/page-metadata';

type SearchParams = Record<string, string | string[] | undefined>;
type Stage = PublicEntryList['stage'];

interface PlayersPageProps {
  params: Promise<{ locale: string; slug: string; subEventCode: string }>;
  searchParams: Promise<SearchParams>;
}

const STAGE_PARAMS = Object.fromEntries(Object.entries(PUBLIC_ENTRY_STAGES).map(([param, stage]) => [stage, param])) as Record<Stage, string>;

async function loadPlayers({ params, searchParams }: PlayersPageProps) {
  const [page, { subEventCode }, query] = await Promise.all([loadEventPage(params), params, searchParams]);
  const withEntries = page.event.subEvents.filter((s) => s.entryCount > 0);
  const subEvent = requireSubEvent(withEntries, subEventCode);
  const fetchEntries = (params: SearchParams) =>
    getEntries(page.event.slug, subEvent.code, toQuery({ ...params, stage: params.stage === 'main' ? undefined : params.stage }, { stage: oneOf(Object.keys(PUBLIC_ENTRY_STAGES)), page: isPageParam }));
  let list = await fetchEntries(query);
  // A sub-event with only qualifying entries opens on them, not on an empty main list.
  const only = list?.stages.length === 1 ? list.stages[0] : undefined;
  if (list && query.stage === undefined && only && only !== list.stage) list = await fetchEntries({ stage: STAGE_PARAMS[only] });
  if (!list) notFound();
  return { ...page, withEntries, subEvent, list };
}

export async function generateMetadata(props: PlayersPageProps): Promise<Metadata> {
  const { locale, event, subEvent, list, t } = await loadPlayers(props);
  const query = list.stage === 'MAIN' ? '' : `?stage=${STAGE_PARAMS[list.stage]}`;
  return eventPageMetadata(locale, event, `/players/${subEvent.code}${query}`, `${t.players.title} ${pickLocalized(locale, subEvent.name, subEvent.nameEn)}`);
}

export default async function PlayersPage(props: PlayersPageProps) {
  const { locale, event, withEntries, subEvent, list, t } = await loadPlayers(props);
  const base = `/${locale}/events/${event.slug}/players`;
  const subHref = `${base}/${subEvent.code}`;
  const stageHref = (stage: Stage, page = 1) => {
    const search = new URLSearchParams();
    if (stage !== 'MAIN') search.set('stage', STAGE_PARAMS[stage]);
    if (page > 1) search.set('page', String(page));
    const text = search.toString();
    return text ? `${subHref}?${text}` : subHref;
  };
  const subName = pickLocalized(locale, subEvent.name, subEvent.nameEn);

  return (
    <EventShell event={event} locale={locale} t={t} active="players">
      <SubEventChooser subEvents={withEntries} current={subEvent.code} hrefFor={(code) => `${base}/${code}`} locale={locale} t={t} />
      <h2 className="section-title">
        {t.players.title} · {subName}
        {list.stages.length > 1 && ` · ${t.players.stage[list.stage]}`}
      </h2>
      {list.stages.length > 1 && (
        <PillNav
          label={t.players.stagesLabel}
          items={list.stages.map((stage) => ({ href: stageHref(stage), label: t.players.stage[stage], current: stage === list.stage }))}
        />
      )}
      <p className="result-count">{format(t.players.count, { n: list.total })}</p>
      {list.items.length === 0 ? (
        <EmptyState text={t.players.empty} />
      ) : (
        <EntryTable items={list.items} locale={locale} caption={`${t.players.title} · ${subName} · ${t.players.stage[list.stage]}`} t={t.players} />
      )}
      <PaginationLinks page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={(page) => stageHref(list.stage, page)} t={t.common} />
    </EventShell>
  );
}
