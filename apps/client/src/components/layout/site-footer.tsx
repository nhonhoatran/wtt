import Link from 'next/link';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { getFooter, isUrlPart } from '../../lib/public-data';
import { SponsorStrip } from '../content/sponsor-strip';
import contentStyles from '../content/content-layout.module.css';
import styles from './site-chrome.module.css';
import type { PublicFooter } from '@kamito/shared';

export async function SiteFooter({ text, locale }: { text: string; locale: Locale }) {
  const footer = await getFooter();
  const groups = new Map<string, PublicFooter['pages']>();
  for (const page of footer?.pages ?? []) {
    if (!isUrlPart(page.slug)) continue;
    const group = page.group || (locale === 'vi' ? 'Thông tin' : 'Information');
    groups.set(group, [...(groups.get(group) ?? []), page]);
  }
  return (
    <footer className={styles.footer}>
      <div className={contentStyles.footerContent}>
        {groups.size > 0 && <nav aria-label={locale === 'vi' ? 'Liên kết' : 'Links'} className={contentStyles.footerGroups}>
          {[...groups.entries()].map(([group, pages]) => <section key={group} className={contentStyles.footerGroup}>
            <h2>{group}</h2>
            <ul>{pages.map((page) => <li key={page.slug}><Link href={`/${locale}/pages/${page.slug}`}>{pickLocalized(locale, page.title, page.titleEn)}</Link></li>)}</ul>
          </section>)}
        </nav>}
        {footer?.sponsors.length ? <section aria-label={locale === 'vi' ? 'Nhà tài trợ' : 'Sponsors'}><SponsorStrip sponsors={footer.sponsors} locale={locale} /></section> : null}
      </div>
      <div className={styles.footerInner}>
        © {new Date().getFullYear()} {text}
      </div>
    </footer>
  );
}
