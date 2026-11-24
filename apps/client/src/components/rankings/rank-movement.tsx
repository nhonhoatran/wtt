import { format, type Dictionary } from '../../i18n/get-dictionary';
import styles from './rankings.module.css';

export function RankMovement({ movement, t }: { movement: number | null; t: Dictionary['rankings'] }) {
  const label = movement === null ? t.movementNew : movement === 0 ? t.movementSame : format(movement > 0 ? t.movementUp : t.movementDown, { n: Math.abs(movement) });
  return (
    <span className={`${styles.movement} ${movement !== null && movement < 0 ? styles.down : ''}`}>
      <span aria-hidden="true">{movement === null ? t.new : movement === 0 ? '–' : `${movement > 0 ? '↑' : '↓'} ${Math.abs(movement)}`}</span>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
