import type { PublicSubEventSummary } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { PillNav } from '../common/pill-nav';

/** Sub-event switch shared by the draws, groups and players tabs; hidden when there is only one choice. */
export function SubEventChooser({
  subEvents,
  current,
  hrefFor,
  locale,
  t,
}: {
  subEvents: PublicSubEventSummary[];
  current: string;
  hrefFor: (code: string) => string;
  locale: Locale;
  t: Dictionary;
}) {
  if (subEvents.length < 2) return null;
  return (
    <PillNav
      label={t.event.subEventChooser}
      items={subEvents.map((s) => ({ href: hrefFor(s.code), label: pickLocalized(locale, s.name, s.nameEn), current: s.code === current }))}
    />
  );
}
