import type { SiteChromeDisplay } from '../../lib/site-display';
import type { Dictionary } from '../../i18n/get-dictionary';
import styles from './footer.module.css';

/** Short brand marks; the accessible name comes from the dictionary. */
const MARKS: Record<SiteChromeDisplay['socialLinks'][number]['platform'], string> = {
  facebook: 'FB',
  youtube: 'YT',
  tiktok: 'TT',
  instagram: 'IG',
  zalo: 'Zalo',
};

export function FooterSocialLinks({ links, t }: { links: SiteChromeDisplay['socialLinks']; t: Dictionary }) {
  if (links.length === 0) return null;
  return (
    <ul className={styles.social} aria-label={t.footer.social}>
      {links.map((link) => (
        <li key={link.platform}>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label={`${t.social[link.platform]} (${t.nav.opensInNewTab})`}>
            <span aria-hidden="true">{MARKS[link.platform]}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
