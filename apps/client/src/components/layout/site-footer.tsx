import Link from 'next/link';
import type { PublicFooter } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import { resolveNavItems } from '../../lib/nav-items';
import { getFooter, isUrlPart } from '../../lib/public-data';
import type { SiteChromeDisplay } from '../../lib/site-display';
import { SponsorStrip } from '../content/sponsor-strip';
import { FooterSocialLinks } from './footer-social-links';
import styles from './footer.module.css';

export async function SiteFooter({ siteName, locale, t, display }: { siteName: string; locale: Locale; t: Dictionary; display: SiteChromeDisplay }) {
  const footer = await getFooter().catch(() => null);
  const groups = new Map<string, PublicFooter['pages']>();
  for (const page of footer?.pages ?? []) {
    if (!isUrlPart(page.slug)) continue;
    const group = pickLocalizedOrNull(locale, page.group, page.groupEn) || t.footer.information;
    groups.set(group, [...(groups.get(group) ?? []), page]);
  }
  const explore = resolveNavItems(display.navItems, locale, t.nav);
  if (!explore.some((item) => item.key === 'contact')) explore.push(...resolveNavItems([{ key: 'contact' }], locale, t.nav));
  const tagline = display.tagline ? pickLocalized(locale, display.tagline.vi, display.tagline.en) : '';
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.intro}>
          <Link href={`/${locale}`} className={styles.wordmark}>
            <span className={styles.wordmarkText}>{siteName}</span>
            <span aria-hidden="true" className={styles.mark} />
          </Link>
          {tagline && <p className={styles.tagline}>{tagline}</p>}
          <FooterSocialLinks links={display.socialLinks} t={t} />
        </div>
        <nav aria-label={t.footer.links} className={styles.groups}>
          <section className={styles.group}>
            <h2>{t.footer.explore}</h2>
            <ul>{explore.map((item) => <li key={item.key}><Link href={item.href}>{item.label}</Link></li>)}</ul>
          </section>
          {[...groups.entries()].map(([group, pages]) => (
            <section key={group} className={styles.group}>
              <h2>{group}</h2>
              <ul>{pages.map((page) => <li key={page.slug}><Link href={`/${locale}/pages/${page.slug}`}>{pickLocalized(locale, page.title, page.titleEn)}</Link></li>)}</ul>
            </section>
          ))}
        </nav>
      </div>
      {footer?.sponsors.length ? (
        <section aria-label={t.footer.sponsors} className={styles.sponsors}>
          <SponsorStrip sponsors={footer.sponsors} locale={locale} />
        </section>
      ) : null}
      <div className={styles.bottom}>© {new Date().getFullYear()} {siteName}</div>
    </footer>
  );
}
