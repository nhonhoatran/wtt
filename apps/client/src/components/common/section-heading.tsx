import Link from 'next/link';
import styles from './section-heading.module.css';

/** Block title with an optional eyebrow and "see all" link. Give the section `aria-labelledby={id}`. */
export function SectionHeading({ id, title, eyebrow, link }: { id: string; title: string; eyebrow?: string; link?: { href: string; label: string } }) {
  return (
    <div className={styles.head}>
      <div>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 id={id} className={styles.title}>{title}</h2>
      </div>
      {link ? <Link href={link.href} className={styles.link}>{link.label}</Link> : null}
    </div>
  );
}
