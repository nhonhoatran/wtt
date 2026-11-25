import styles from './initials-avatar.module.css';

export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((word) => Array.from(word)[0]).slice(-2).join('').toUpperCase();
}

/** Photo when there is one, otherwise the initials. Always decorative: the name is rendered next to it, so it must not be announced twice. */
export function InitialsAvatar({ name, photoUrl, size = 40, className }: { name: string; photoUrl?: string | null; size?: number; className?: string }) {
  const classes = [styles.avatar, className].filter(Boolean).join(' ');
  const box = { width: size, height: size };
  if (photoUrl) return <img className={classes} style={box} src={photoUrl} width={size} height={size} alt="" loading="lazy" />;
  return <span className={classes} style={{ ...box, fontSize: Math.round(size * 0.4) }} aria-hidden="true">{initialsOf(name)}</span>;
}
