import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventShell } from '../../../../../components/events/event-shell';
import { FilterForm } from '../../../../../components/common/filter-form';
import { SessionTableSchedule } from '../../../../../components/schedule/session-table-schedule';
import { RankingPointsByRoundTable } from '../../../../../components/events/ranking-points-by-round-table';
import styles from '../../../../../components/events/event-info.module.css';
import { pickLocalizedOrNull } from '../../../../../i18n/pick-localized';
import { formatDay } from '../../../../../lib/format-date-time';
import { tableName } from '../../../../../lib/match-display';
import { loadEventPage } from '../../../../../lib/event-page';
import { getEventInfo, getSchedule, getEventRankingPoints } from '../../../../../lib/public-data';
import { oneOf, toQuery } from '../../../../../lib/public-query';
import { eventPageMetadata } from '../../../../../lib/page-metadata';

interface InfoPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: InfoPageProps): Promise<Metadata> {
  const { locale, event, t } = await loadEventPage(params);
  return eventPageMetadata(locale, event, '/info', t.info.title);
}

export default async function EventInfoPage({ params, searchParams }: InfoPageProps) {
  const { locale, event, t } = await loadEventPage(params);
  if (!event.tabs.info) notFound();
  const [info, allSchedule, rankingPoints, query] = await Promise.all([getEventInfo(event.slug), getSchedule(event.slug), getEventRankingPoints(event.slug), searchParams]);
  // Either language beats a 404: the tab shows whenever one of them is set.
  const html = info && (pickLocalizedOrNull(locale, info.infoBody, info.infoBodyEn) ?? info.infoBodyEn);
  const hasSchedule = Boolean(allSchedule?.filters.sessions.length);
  if (!html && !hasSchedule && !rankingPoints?.items.length) notFound();
  const rules = {
    session: oneOf(allSchedule?.filters.sessions.map((session) => session.code) ?? []),
    table: oneOf(allSchedule?.filters.tables.map((table) => table.code) ?? []),
  };
  const scheduleQuery = toQuery(query, rules);
  const selected = new URLSearchParams(scheduleQuery);
  const schedule = scheduleQuery ? await getSchedule(event.slug, scheduleQuery) : allSchedule;
  return (
    <EventShell event={event} locale={locale} t={t} active="info">
      <h2 className="visually-hidden">{t.info.title}</h2>
      {hasSchedule && allSchedule && (
        <FilterForm
          label={t.schedule.filters}
          action={`/${locale}/events/${event.slug}/info`}
          t={t.common}
          fields={[
            { kind: 'select', name: 'session', label: t.schedule.session, value: selected.get('session') ?? '', options: allSchedule.filters.sessions.map((session) => ({ value: session.code, label: `${formatDay(session.date, locale)} · ${pickLocalizedOrNull(locale, session.name, session.nameEn) ?? session.code}` })) },
            { kind: 'select', name: 'table', label: t.schedule.table, value: selected.get('table') ?? '', options: allSchedule.filters.tables.map((table) => ({ value: table.code, label: tableName(table, t.schedule.tableCode)! })) },
          ]}
        />
      )}
      {hasSchedule && schedule && <SessionTableSchedule schedule={schedule} locale={locale} t={t} />}
      {rankingPoints && <RankingPointsByRoundTable data={rankingPoints} endDate={event.endDate} locale={locale} t={t} />}
      {/* Safe: the API re-sanitizes infoBody with the rich-text allowlist on the way out. */}
      {html && <div className={`${styles.body} ${hasSchedule ? styles.screenOnly : ''}`} dangerouslySetInnerHTML={{ __html: html }} />}
    </EventShell>
  );
}
