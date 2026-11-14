import { notFound, redirect } from 'next/navigation';
import type { PublicSubEventSummary as SubEvent } from '@kamito/shared';
import { getDictionary } from '../i18n/get-dictionary';
import { isLocale } from '../i18n/locales';
import { getEvent, isUrlPart } from './public-data';

/** Shared first step of every event tab: valid locale + slug, the event exists and is public, else 404. */
export async function loadEventPage(params: Promise<{ locale: string; slug: string }>) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isUrlPart(slug)) notFound();
  const event = await getEvent(slug);
  if (!event) notFound();
  return { locale, event, t: getDictionary(locale) };
}

/** Sub-event code from the URL, checked against the event's own list (no API call for unknown codes). */
export function requireSubEvent<T extends { code: string }>(subEvents: T[], code: string): T {
  const found = isUrlPart(code) ? subEvents.find((s) => s.code === code) : undefined;
  if (!found) notFound();
  return found;
}

/** Index of a per-sub-event tab: go to the first sub-event that has content for it, else 404. */
export async function redirectToFirstSubEvent(
  params: Promise<{ locale: string; slug: string }>,
  tab: 'draws' | 'groups' | 'players',
): Promise<never> {
  const { locale, event } = await loadEventPage(params);
  const has = { draws: (s: SubEvent) => s.drawKinds.length > 0, groups: (s: SubEvent) => s.hasGroups, players: (s: SubEvent) => s.entryCount > 0 }[tab];
  const first = event.subEvents.find(has);
  if (!first) notFound();
  redirect(`/${locale}/events/${event.slug}/${tab}/${first.code}`);
}
