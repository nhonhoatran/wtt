import Link from 'next/link';
import { PUBLIC_SEARCH_MAX_LENGTH, type PublicPlayerProfile } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { initialsOf } from '../common/initials-avatar';
import { PlayerHeroStats } from './player-hero-stats';
import styles from './players.module.css';

export function PlayerHero({ player, locale, t }: { player: PublicPlayerProfile; locale: Locale; t: Dictionary['players'] }) {
  const name = pickLocalized(locale, player.name, player.nameEn);
  const top = player.ranks[0];
  const facts = [
    { label: t.profile.hand, value: player.handedness ? t.profile.hands[player.handedness] : null },
    { label: t.profile.age, value: player.age === null ? null : String(player.age) },
  ].filter((fact) => fact.value !== null);
  return (
    <section className={styles.hero} aria-label={name}>
      <div className={styles.heroInner}>
        <Link className={styles.back} href={`/${locale}/players`}><span aria-hidden="true">←</span> {t.profile.back}</Link>
        <div className={styles.heroGrid}>
          {player.photo
            ? <img className={styles.portrait} src={player.photo.url} width={208} height={208} alt="" fetchPriority="high" />
            : <div className={styles.portrait} aria-hidden="true">{initialsOf(name)}</div>}
          <div className={styles.heroBody}>
            <p className={styles.eyebrow}>{t.title} · {t.genders[player.gender]}</p>
            <h1 className={styles.name}>{name}</h1>
            {player.club && <p className={styles.club}>{player.club}</p>}
            {facts.length > 0 && <dl className={styles.facts}>{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
          </div>
          <div className={styles.heroSide}>
            <PlayerHeroStats player={player} locale={locale} t={t} />
            {top && <Link className={styles.rankLink} href={`/${locale}/rankings/${top.list.code}?${new URLSearchParams({ q: player.name.slice(0, PUBLIC_SEARCH_MAX_LENGTH) })}`}>{t.profile.viewRanking}</Link>}
          </div>
        </div>
      </div>
    </section>
  );
}
