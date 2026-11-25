import Link from 'next/link';
import type { PublicRankingTop } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { InitialsAvatar } from '../common/initials-avatar';
import { ScrollRegion } from '../common/scroll-region';
import styles from './home-top-rankings.module.css';

function Movement({ movement, t }: { movement: number | null; t: Dictionary['rankings'] }) {
  if (movement === null) return <span className={styles.same}><span aria-hidden="true">{t.new}</span><span className="visually-hidden">{t.movementNew}</span></span>;
  if (movement === 0) return <span className={styles.same}><span aria-hidden="true">–</span><span className="visually-hidden">{t.movementSame}</span></span>;
  const up = movement > 0;
  const n = Math.abs(movement);
  return (
    <span className={up ? styles.up : styles.down}>
      <span aria-hidden="true">{up ? '▲' : '▼'} {n}</span>
      <span className="visually-hidden">{format(up ? t.movementUp : t.movementDown, { n })}</span>
    </span>
  );
}

/** Navy top-players block. Tabs are links to `?ranking=<code>`, so the chosen list is server-rendered and shareable. */
export function HomeTopRankings({ lists, active, locale, t }: { lists: PublicRankingTop[]; active: PublicRankingTop; locale: Locale; t: Dictionary }) {
  const listName = (l: PublicRankingTop) => pickLocalized(locale, l.list.name, l.list.nameEn);
  return (
    <section className={styles.band} aria-labelledby="home-rankings">
      <div className="container">
        <div className={styles.head}>
          <h2 id="home-rankings" className={styles.title}>{t.home.rankings}</h2>
          {lists.length > 1 && (
            <nav className={styles.tabs} aria-label={t.home.rankingsTabs}>
              {lists.map((l) => (
                <Link key={l.list.code} href={`/${locale}?ranking=${encodeURIComponent(l.list.code)}#home-rankings`} scroll={false} className={styles.tab} aria-current={l === active ? 'page' : undefined}>
                  {listName(l)}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <ScrollRegion label={listName(active)}>
          <table className={styles.table}>
            <caption className="visually-hidden">{listName(active)}</caption>
            <thead><tr>
              <th scope="col">{t.rankings.rank}</th>
              <th scope="col" className={styles.left}>{t.rankings.player}</th>
              <th scope="col" className={`${styles.left} ${styles.clubCol}`}>{t.rankings.club}</th>
              <th scope="col">{t.rankings.points}</th>
              <th scope="col">{t.home.rankingsMovement}</th>
            </tr></thead>
            <tbody>
              {active.items.map((row) => {
                const name = pickLocalized(locale, row.player.name, row.player.nameEn);
                return (
                  <tr key={`${row.rank}-${row.player.slug ?? row.player.name}`}>
                    <td className={styles.rank}>{row.rank}</td>
                    <th scope="row" className={styles.left}>
                      <span className={styles.identity}>
                        <InitialsAvatar name={name} photoUrl={row.player.photo?.url} size={36} className={styles.avatar} />
                        <span>
                          {row.player.slug ? <Link href={`/${locale}/players/${row.player.slug}`} className={styles.name}>{name}</Link> : <span className={styles.name}>{name}</span>}
                          {row.player.club && <span className={styles.clubInline}>{row.player.club}</span>}
                        </span>
                      </span>
                    </th>
                    <td className={`${styles.left} ${styles.clubCol}`}>{row.player.club}</td>
                    <td className={styles.points}>{row.points.toLocaleString(locale)}</td>
                    <td><Movement movement={row.movement} t={t.rankings} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollRegion>
        <p className={styles.more}><Link href={`/${locale}/rankings/${active.list.code}`} className={styles.moreLink}>{t.home.rankingsFull}</Link></p>
      </div>
    </section>
  );
}
