import styles from './site-chrome.module.css';

export function SiteFooter({ text }: { text: string }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        © {new Date().getFullYear()} {text}
      </div>
    </footer>
  );
}
