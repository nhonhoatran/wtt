import styles from './header.module.css';

/** Shown only when the registration URL setting is set (https, validated by the API). */
export function RegistrationButton({ url, label, newTabLabel, className }: { url: string; label: string; newTabLabel: string; className?: string }) {
  if (!url) return null;
  return (
    <a className={`btn-primary ${styles.register} ${className ?? ''}`} href={url} target="_blank" rel="noopener noreferrer">
      {label}
      <span className="visually-hidden"> ({newTabLabel})</span>
    </a>
  );
}
