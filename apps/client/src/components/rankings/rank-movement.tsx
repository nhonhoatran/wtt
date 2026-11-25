import { format, type Dictionary } from '../../i18n/get-dictionary';
import styles from './rankings.module.css';

/** Direction is carried by the arrow and the number, never by colour alone. */
export function RankMovement({ movement, previousRank = null, t }: { movement: number | null; previousRank?: number | null; t: Dictionary['rankings'] }) {
  const label = movement === null ? t.movementNew : movement === 0 ? t.movementSame : format(movement > 0 ? t.movementUp : t.movementDown, { n: Math.abs(movement) });
  const tone = movement === null || movement === 0 ? '' : movement > 0 ? styles.up : styles.down;
  const mark = movement === null ? t.new : movement === 0 ? '–' : `${movement > 0 ? '▲' : '▼'} ${Math.abs(movement)}`;
  return (
    <span className={`${styles.movement} ${tone}`}>
      <span aria-hidden="true">{mark}</span>
      <span className="visually-hidden">{label}</span>
      {previousRank !== null && <span className={styles.previous}>{format(t.previousRank, { n: previousRank })}</span>}
    </span>
  );
}
