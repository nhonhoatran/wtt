import { Fragment } from 'react';
import Link from 'next/link';
import type { PublicSide } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import styles from './players.module.css';

/** A pair keeps an individual profile link for each public player. */
export function SidePlayers({ side, locale }: { side: PublicSide; locale: Locale }) {
  return <>{side.players.map((player, i) => <Fragment key={i}>
    {i > 0 && ' / '}
    {player.slug ? <Link className={styles.inlineLink} href={`/${locale}/players/${player.slug}`}>{pickLocalized(locale, player.name, player.nameEn)}</Link> : pickLocalized(locale, player.name, player.nameEn)}
  </Fragment>)}</>;
}
