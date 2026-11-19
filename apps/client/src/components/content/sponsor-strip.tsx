import type { PublicSponsor } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import styles from './content-layout.module.css';

export function SponsorStrip({ sponsors, locale }: { sponsors: PublicSponsor[]; locale: Locale }) {
  if (!sponsors.length) return null;
  return (
    <ul className={styles.sponsors}>
      {sponsors.map((sponsor) => {
        const logo = sponsor.logoDark ?? sponsor.logo;
        const content = <>{logo && <img src={logo.url} width={logo.width} height={logo.height} alt={pickLocalized(locale, logo.alt ?? sponsor.name, logo.altEn)} loading="lazy" />}<span>{sponsor.name}{pickLocalized(locale, sponsor.roleLabel ?? '', sponsor.roleLabelEn) && <small> · {pickLocalized(locale, sponsor.roleLabel ?? '', sponsor.roleLabelEn)}</small>}</span></>;
        return <li key={`${sponsor.name}-${sponsor.url ?? 'none'}`}>{sponsor.url ? <a className={styles.sponsor} href={sponsor.url} target="_blank" rel="noopener noreferrer">{content}</a> : <span className={styles.sponsor}>{content}</span>}</li>;
      })}
    </ul>
  );
}
