import styles from './live-badge.module.css';

/** Same live marker across brackets, match cards, score boards and schedules. */
export function LiveBadge({ label, variant = 'default', className }: { label: string; variant?: 'default' | 'deep' | 'schedule'; className?: string }) {
  return <span className={[styles.badge, variant === 'deep' ? styles.deep : variant === 'schedule' ? styles.schedule : '', className].filter(Boolean).join(' ')}>{label}</span>;
}
