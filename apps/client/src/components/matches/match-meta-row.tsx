import type { PublicMatchDetail } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalizedOrNull } from '../../i18n/pick-localized';
import { formatMatchTime } from '../../lib/format-date-time';
import { tableName } from '../../lib/match-display';
import styles from './match-meta-row.module.css';

/** Whole minutes between start and result; hidden when either instant is missing or the order makes no sense. */
export function matchMinutes(startedAt: string | null, officialAt: string | null): number | null {
  if (!startedAt || !officialAt) return null;
  const minutes = Math.round((Date.parse(officialAt) - Date.parse(startedAt)) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

export function sessionLabel(m: Pick<PublicMatchDetail, 'session'>, locale: Locale): string | null {
  return m.session ? (pickLocalizedOrNull(locale, m.session.name, m.session.nameEn) ?? m.session.code) : null;
}

export function MatchMetaRow({ match: m, locale, t }: { match: PublicMatchDetail; locale: Locale; t: Dictionary }) {
  const minutes = matchMinutes(m.startedAt, m.officialAt);
  const items = [
    { label: t.match.table, value: tableName(m.table, t.schedule.tableCode) },
    { label: t.match.session, value: sessionLabel(m, locale) },
    { label: t.match.time, value: m.scheduledAt ? formatMatchTime(m.scheduledAt, locale, m.event.timezone) : null },
    { label: t.match.duration, value: minutes ? format(t.match.durationMinutes, { n: minutes }) : null },
  ].filter((item) => item.value);
  if (items.length === 0) return null;
  return (
    <dl className={styles.row} aria-label={t.match.metaLabel}>
      {items.map((item) => (
        <div key={item.label} className={styles.item}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
