import { StatusPill } from './status-pill';
import styles from './live-badge.module.css';

/** Compact live marker for brackets, match cards, score boards and schedules; shares the StatusPill look without the dot. */
export function LiveBadge({ label, variant = 'default', className }: { label: string; variant?: 'default' | 'deep' | 'schedule'; className?: string }) {
  const compact = [styles.badge, variant === 'deep' ? styles.deep : variant === 'schedule' ? styles.schedule : '', className].filter(Boolean).join(' ');
  return <StatusPill variant="live" label={label} dot={false} className={compact} />;
}
