import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import { StatusPill } from '../common/status-pill';
import styles from './bracket-nav.module.css';

/** Key to the markers used in the match boxes, plus the link to the group stage when the draw has one. */
export function BracketLegend({ t, groupsHref }: { t: Dictionary['bracket']; groupsHref: string | null }) {
  return (
    <div className={styles.legendRow}>
      <ul className={styles.legend} aria-label={t.legend}>
        <li><span className={styles.winnerSwatch} aria-hidden="true" />{t.winner}</li>
        <li><StatusPill variant="live" label={t.status.LIVE} /></li>
        <li><StatusPill variant="official" label={t.status.OFFICIAL} /></li>
        <li><StatusPill variant="scheduled" label={t.status.SCHEDULED} /></li>
      </ul>
      {groupsHref && <Link href={groupsHref} className={styles.groupsLink}>{t.viewGroups} <span aria-hidden="true">→</span></Link>}
    </div>
  );
}
