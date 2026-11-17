import Link from 'next/link';
import type { PublicRankingPlayer } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import styles from './players.module.css';

/** Shared public identity: a null slug deliberately renders plain text. */
export function PlayerIdentity({ player, locale, showClub = true }: { player: PublicRankingPlayer; locale: Locale; showClub?: boolean }) {
  const name = pickLocalized(locale, player.name, player.nameEn);
  return (
    <span className={styles.identity}>
      {player.photo && <img className={styles.avatar} src={player.photo.url} width={40} height={40} alt="" loading="lazy" />}
      <span className={styles.identityText}>
        {player.slug ? <Link className={styles.nameLink} href={`/${locale}/players/${player.slug}`}>{name}</Link> : <span>{name}</span>}
        {showClub && player.club && <span className={styles.club}>{player.club}</span>}
      </span>
    </span>
  );
}
