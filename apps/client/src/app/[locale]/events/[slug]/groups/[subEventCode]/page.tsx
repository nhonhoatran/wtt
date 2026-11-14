import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '../../../../../../components/common/empty-state';
import { EventShell } from '../../../../../../components/events/event-shell';
import { SubEventChooser } from '../../../../../../components/events/sub-event-chooser';
import { GroupStandings } from '../../../../../../components/groups/group-standings';
import { MatchCard } from '../../../../../../components/matches/match-card';
import cardStyles from '../../../../../../components/matches/match-card.module.css';
import { format } from '../../../../../../i18n/get-dictionary';
import { pickLocalized } from '../../../../../../i18n/pick-localized';
import { loadEventPage, requireSubEvent } from '../../../../../../lib/event-page';
import { getGroups } from '../../../../../../lib/public-data';
import { eventPageMetadata } from '../../../../../../lib/page-metadata';

interface GroupsPageProps {
  params: Promise<{ locale: string; slug: string; subEventCode: string }>;
}

async function loadGroups(params: GroupsPageProps['params']) {
  const [page, { subEventCode }] = await Promise.all([loadEventPage(params), params]);
  const withGroups = page.event.subEvents.filter((s) => s.hasGroups);
  const subEvent = requireSubEvent(withGroups, subEventCode);
  const data = await getGroups(page.event.slug, subEvent.code);
  if (!data) notFound();
  return { ...page, withGroups, subEvent, groups: data.groups };
}

export async function generateMetadata({ params }: GroupsPageProps): Promise<Metadata> {
  const { locale, event, subEvent, t } = await loadGroups(params);
  return eventPageMetadata(locale, event, `/groups/${subEvent.code}`, `${t.groups.title} ${pickLocalized(locale, subEvent.name, subEvent.nameEn)}`);
}

export default async function GroupsPage({ params }: GroupsPageProps) {
  const { locale, event, withGroups, subEvent, groups, t } = await loadGroups(params);
  const base = `/${locale}/events/${event.slug}/groups`;
  return (
    <EventShell event={event} locale={locale} t={t} active="groups">
      <SubEventChooser subEvents={withGroups} current={subEvent.code} hrefFor={(code) => `${base}/${code}`} locale={locale} t={t} />
      <h2 className="section-title">
        {t.groups.title} · {pickLocalized(locale, subEvent.name, subEvent.nameEn)}
      </h2>
      {groups.length === 0 && <EmptyState text={t.groups.empty} />}
      {groups.map((group) => (
        <section key={group.code} aria-labelledby={`group-${group.code}`}>
          <h3 id={`group-${group.code}`} className="section-title">
            {format(t.groups.group, { code: group.code })}
          </h3>
          <GroupStandings group={group} locale={locale} t={t.groups} />
          {group.matches.length > 0 && (
            <>
              <h4 className="visually-hidden">{t.groups.matches}</h4>
              <ul className={cardStyles.list}>
                {group.matches.map((m) => (
                  <li key={m.matchNo}>
                    <MatchCard match={m} eventSlug={event.slug} locale={locale} timeZone={event.timezone} t={t} showSubEvent={false} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
    </EventShell>
  );
}
