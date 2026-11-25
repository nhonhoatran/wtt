import type { PublicPlayerProfile } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { initialsOf } from '../common/initials-avatar';
import styles from './players.module.css';

export function PlayerHero({ player, locale, t }: { player: PublicPlayerProfile; locale: Locale; t: Dictionary['players'] }) {
  const name = pickLocalized(locale, player.name, player.nameEn);
  const facts = [
    { label: t.club, value: player.club },
    { label: t.gender, value: t.genders[player.gender] },
    { label: t.profile.hand, value: player.handedness ? t.profile.hands[player.handedness] : null },
    { label: t.profile.age, value: player.age === null ? null : String(player.age) },
  ].filter((fact) => fact.value !== null);
  return (
    <section className={styles.hero} aria-label={name}>
      {player.photo ? <img className={styles.portrait} src={player.photo.url} width={192} height={208} alt={name} fetchPriority="high" /> : (
        <div className={styles.portraitPlaceholder} aria-hidden="true">{initialsOf(name)}</div>
      )}
      <div className={styles.heroBody}>
        <h1 className="page-title">{name}</h1>
        <dl className={styles.facts}>{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
      </div>
    </section>
  );
}
