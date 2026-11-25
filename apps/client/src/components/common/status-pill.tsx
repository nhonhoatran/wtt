import styles from './status-pill.module.css';

export type StatusPillVariant = 'live' | 'official' | 'scheduled' | 'ongoing' | 'upcoming' | 'completed';

/** One pill for every match and event status. The label comes from the dictionary of the caller. */
export function StatusPill({ variant, label, className, dot = variant === 'live' }: { variant: StatusPillVariant; label: string; className?: string; dot?: boolean }) {
  return (
    <span className={[styles.pill, styles[variant], className].filter(Boolean).join(' ')}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {label}
    </span>
  );
}
