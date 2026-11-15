'use client';

import styles from './session-table-schedule.module.css';

/** The schedule itself is rendered on the server; only the browser print dialog needs JavaScript. */
export function PrintScheduleButton({ label }: { label: string }) {
  return <button type="button" className={styles.printButton} onClick={() => window.print()}>{label}</button>;
}
