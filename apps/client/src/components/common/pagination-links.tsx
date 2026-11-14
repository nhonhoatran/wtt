import Link from 'next/link';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import styles from './pagination-links.module.css';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Builds the URL of a page, keeping the current filters. */
  hrefFor: (page: number) => string;
  t: Dictionary['common'];
}

/** Real links (crawlable, no JavaScript): first, previous, a window around the current page, next, last. */
export function PaginationLinks({ page, pageSize, total, hrefFor, t }: PaginationProps) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, page + 2);
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <nav className={styles.nav} aria-label={t.pagination}>
      {page > 1 && <Link href={hrefFor(page - 1)} className={styles.link} rel="prev">{t.previous}</Link>}
      {from > 1 && <Link href={hrefFor(1)} className={styles.link}>1</Link>}
      {from > 2 && <span className={styles.gap}>…</span>}
      {numbers.map((n) => (
        <Link key={n} href={hrefFor(n)} className={styles.link} aria-current={n === page ? 'page' : undefined} aria-label={format(t.pageN, { n })}>
          {n}
        </Link>
      ))}
      {to < pages - 1 && <span className={styles.gap}>…</span>}
      {to < pages && <Link href={hrefFor(pages)} className={styles.link}>{pages}</Link>}
      {page < pages && <Link href={hrefFor(page + 1)} className={styles.link} rel="next">{t.next}</Link>}
    </nav>
  );
}
