import styles from './empty-state.module.css';

export function EmptyState({ text }: { text: string }) {
  return <p className={styles.empty}>{text}</p>;
}
