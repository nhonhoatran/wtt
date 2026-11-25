import type { ReactNode } from 'react';
import { todayInTimezone, type PublicEventDetail } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { PillNav } from '../common/pill-nav';
import { EventHero } from './event-hero';
import { EventHeroCompact } from './event-hero-compact';

export type EventTab = keyof Dictionary['event']['tabs'];

const TAB_PATHS: Record<EventTab, string> = { overview: '', matches: '/matches', draws: '/draws', groups: '/groups', players: '/players', info: '/info' };

/**
 * Hero + tab bar for every event page. A tab only shows when it has content (event.tabs);
 * each tab is its own route, so it has its own URL, metadata and cache tag.
 * The overview gets the full hero, every other tab the slim one.
 */
export function EventShell({ event, locale, t, active, children }: { event: PublicEventDetail; locale: Locale; t: Dictionary; active: EventTab; children: ReactNode }) {
  const base = `/${locale}/events/${event.slug}`;
  const tabs = (Object.keys(TAB_PATHS) as EventTab[]).filter((tab) => tab === 'overview' || event.tabs[tab]);
  return (
    <main id="content">
      {active === 'overview' ? <EventHero event={event} locale={locale} t={t} today={todayInTimezone(event.timezone)} /> : <EventHeroCompact event={event} locale={locale} t={t} />}
      <div className="container">
        <PillNav variant="tabs" label={t.event.tabsLabel} items={tabs.map((tab) => ({ href: `${base}${TAB_PATHS[tab]}`, label: t.event.tabs[tab], current: tab === active }))} />
        {children}
      </div>
    </main>
  );
}
