import type { ReactNode } from 'react';
import styles from './scroll-region.module.css';

/** Only this frame scrolls sideways (wide tables, brackets); the page itself never overflows. Focusable for keyboard scrolling. */
export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.scroller} tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}
