import type { PublicPlayerProfile } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import styles from './players.module.css';

/** Rank and points of the first list plus the win-loss record; a figure without data is left out. */
export function PlayerHeroStats({ player, locale, t }: { player: PublicPlayerProfile; locale: Locale; t: Dictionary['players'] }) {
  const top = player.ranks[0];
  const { wins, losses } = player.record;
  const stats = [
    top ? { label: format(t.profile.rankIn, { list: pickLocalized(locale, top.list.name, top.list.nameEn) }), value: String(top.rank), accent: true } : null,
    top ? { label: t.profile.points, value: top.points.toLocaleString(locale), accent: false } : null,
    wins + losses > 0 ? { label: t.profile.record, value: `${wins}–${losses}`, accent: false } : null,
  ].filter((s) => s !== null);
  if (stats.length === 0) return null;
  return (
    <dl className={styles.stats}>
      {stats.map((s) => (
        <div key={s.label} className={styles.stat}>
          <dt>{s.label}</dt>
          <dd className={s.accent ? styles.statAccent : undefined}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
