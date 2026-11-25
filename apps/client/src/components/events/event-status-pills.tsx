import { PUBLIC_EVENT_STATUSES } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import { PillNav } from '../common/pill-nav';

interface EventStatusPillsProps {
  /** Path of the list, e.g. /vi/events. */
  base: string;
  /** Current filters as a query string (with or without the leading "?"); the page number is never part of it. */
  filters: string;
  /** Current status value, '' for all. */
  status: string;
  t: Dictionary;
}

/** Status chooser as plain links: each keeps the other filters and drops the page, so it works without JavaScript. */
export function EventStatusPills({ base, filters, status, t }: EventStatusPillsProps) {
  const hrefFor = (value: string) => {
    const search = new URLSearchParams(filters.replace(/^\?/, ''));
    search.delete('status');
    if (value) search.set('status', value);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const items = [
    { value: '', label: t.common.all },
    ...Object.entries(PUBLIC_EVENT_STATUSES).map(([value, lifecycle]) => ({ value, label: t.events.status[lifecycle] })),
  ].map(({ value, label }) => ({ href: hrefFor(value), label, current: value === status }));
  return <PillNav label={t.events.filters.status} items={items} />;
}
