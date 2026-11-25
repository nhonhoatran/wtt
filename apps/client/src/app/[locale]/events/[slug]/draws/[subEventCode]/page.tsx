import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PUBLIC_DRAW_KINDS, type PublicDrawKind } from '@kamito/shared';
import { BracketBoard } from '../../../../../../components/bracket/bracket-board';
import { PillNav } from '../../../../../../components/common/pill-nav';
import { EventShell } from '../../../../../../components/events/event-shell';
import { SubEventChooser } from '../../../../../../components/events/sub-event-chooser';
import { parseRoundParam } from '../../../../../../lib/bracket-derivations';
import { pickLocalized } from '../../../../../../i18n/pick-localized';
import { loadEventPage, requireSubEvent } from '../../../../../../lib/event-page';
import { getBracket } from '../../../../../../lib/public-data';
import { eventPageMetadata } from '../../../../../../lib/page-metadata';

interface DrawPageProps {
  params: Promise<{ locale: string; slug: string; subEventCode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const KIND_PARAMS: Record<PublicDrawKind, string> = { MAIN: 'main', QUALIFYING: 'qualifying' };

async function loadDraw({ params, searchParams }: DrawPageProps) {
  const [page, { subEventCode }, { draw }] = await Promise.all([loadEventPage(params), params, searchParams]);
  const subEvent = requireSubEvent(page.event.subEvents.filter((s) => s.drawKinds.length > 0), subEventCode);
  // Without ?draw, the main draw, or the qualifying draw while only that one is published.
  const kind = draw === undefined ? KIND_PARAMS[subEvent.drawKinds[0] ?? 'MAIN'] : draw;
  if (typeof kind !== 'string' || !Object.hasOwn(PUBLIC_DRAW_KINDS, kind)) notFound();
  const bracket = await getBracket(page.event.slug, subEvent.code, kind);
  if (!bracket) notFound();
  return { ...page, subEvent, bracket };
}

export async function generateMetadata(props: DrawPageProps): Promise<Metadata> {
  const { locale, event, subEvent, bracket, t } = await loadDraw(props);
  const query = bracket.draw.kind === 'QUALIFYING' ? '?draw=qualifying' : '';
  return eventPageMetadata(locale, event, `/draws/${subEvent.code}${query}`, `${t.bracket.title} ${pickLocalized(locale, subEvent.name, subEvent.nameEn)}`);
}

export default async function DrawPage(props: DrawPageProps) {
  const { locale, event, subEvent, bracket, t } = await loadDraw(props);
  const query = await props.searchParams;
  const base = `/${locale}/events/${event.slug}/draws`;
  const subHref = `${base}/${subEvent.code}`;
  const kindQuery = bracket.draw.kind === bracket.availableKinds[0] ? null : KIND_PARAMS[bracket.draw.kind];
  const roundHref = (key: string, round: number) => {
    const next = new URLSearchParams();
    if (kindQuery) next.set('draw', kindQuery);
    for (const [name, value] of Object.entries(query)) if (/^round\d*$/.test(name) && name !== key && parseRoundParam(value)) next.set(name, value as string);
    next.set(key, String(round));
    return `${subHref}?${next}`;
  };
  return (
    <EventShell event={event} locale={locale} t={t} active="draws">
      <SubEventChooser
        subEvents={event.subEvents.filter((s) => s.drawKinds.length > 0)}
        current={subEvent.code}
        hrefFor={(code) => `${base}/${code}`}
        locale={locale}
        t={t}
      />
      <h2 className="section-title" data-bracket-title>
        {t.bracket.title} · {pickLocalized(locale, subEvent.name, subEvent.nameEn)}
        {bracket.availableKinds.length > 1 && ` · ${t.bracket.kind[bracket.draw.kind]}`}
      </h2>
      {bracket.availableKinds.length > 1 && (
        <PillNav
          label={t.bracket.title}
          items={bracket.availableKinds.map((kind) => ({
            href: kind === bracket.availableKinds[0] ? subHref : `${subHref}?draw=${KIND_PARAMS[kind]}`,
            label: t.bracket.kind[kind],
            current: kind === bracket.draw.kind,
          }))}
        />
      )}
      <BracketBoard
        bracket={bracket}
        locale={locale}
        t={t.bracket}
        query={query}
        roundHref={roundHref}
        groupsHref={subEvent.hasGroups ? `/${locale}/events/${event.slug}/groups/${subEvent.code}` : null}
      />
    </EventShell>
  );
}
