import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import styles from './filter-form.module.css';

export type FilterField =
  | { kind: 'select'; name: string; label: string; value: string; options: { value: string; label: string }[]; allLabel?: string | null }
  | { kind: 'date'; name: string; label: string; value: string; min: string; max: string }
  | { kind: 'search'; name: string; label: string; value: string; maxLength: number };

interface FilterFormProps {
  label: string;
  action: string;
  fields: FilterField[];
  /** Params that survive a filter change (e.g. the match state tab). Page resets to 1 by leaving it out. */
  keep?: Record<string, string>;
  /** Where "clear" goes; default keeps the `keep` params. */
  clearHref?: string;
  /** A filter held outside the form (status pills) is on, so "clear" must show. */
  extraActive?: boolean;
  t: Dictionary['common'];
}

/** A plain GET form: filtering changes the URL and the server renders the result; no JavaScript needed. */
export function FilterForm({ label, action, fields, keep = {}, clearHref: clearTo, extraActive = false, t }: FilterFormProps) {
  const active = extraActive || fields.some((f) => f.value && !(f.kind === 'select' && f.allLabel === null));
  const clearHref = clearTo ?? (Object.keys(keep).length ? `${action}?${new URLSearchParams(keep)}` : action);
  return (
    <form method="get" action={action} className={styles.form} aria-label={label} role="search">
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field) => (
        <label key={field.name} className={field.kind === 'search' ? `${styles.field} ${styles.wide}` : styles.field}>
          <span className={styles.label}>{field.label}</span>
          {field.kind === 'select' ? (
            <select name={field.name} defaultValue={field.value} className={styles.control}>
              {field.allLabel !== null && <option value="">{field.allLabel ?? t.all}</option>}
              {field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : field.kind === 'date' ? (
            <input type="date" name={field.name} defaultValue={field.value} min={field.min} max={field.max} className={styles.control} />
          ) : (
            <input type="search" name={field.name} defaultValue={field.value} maxLength={field.maxLength} className={styles.control} />
          )}
        </label>
      ))}
      <div className={styles.actions}>
        <button type="submit" className={styles.submit}>
          {t.filter}
        </button>
        {active && (
          <Link href={clearHref} className={styles.clear}>
            {t.clearFilters}
          </Link>
        )}
      </div>
    </form>
  );
}
