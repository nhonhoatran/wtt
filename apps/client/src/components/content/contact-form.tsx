'use client';

import { useActionState } from 'react';
import type { ContactActionState } from '../../app/[locale]/contact/actions';
import { submitContact } from '../../app/[locale]/contact/actions';
import styles from './contact-form.module.css';

const INITIAL: ContactActionState = { status: 'idle' };

export function ContactForm({ copy, locale }: { copy: { name: string; email: string; phone: string; organization: string; message: string; submit: string; sending: string; success: string; error: string }; locale: 'vi' | 'en' }) {
  const safeSubmit = async (previous: ContactActionState, data: FormData): Promise<ContactActionState> => {
    try { return await submitContact(previous, data); }
    catch { return { status: 'error', message: copy.error }; }
  };
  const [state, action, pending] = useActionState(safeSubmit, INITIAL);
  return (
    <form action={action} className={styles.contactForm}>
      <input type="hidden" name="locale" value={locale} />
      {state.status === 'success' && <p role="status" className={styles.success}>{copy.success}</p>}
      {state.status === 'error' && !state.fieldErrors && <p role="alert" className={styles.error}>{state.message ?? copy.error}</p>}
      <label className={styles.field}>{copy.name}<input name="name" required minLength={2} maxLength={120} autoComplete="name" className={styles.control} aria-invalid={Boolean(state.fieldErrors?.name)} />{state.fieldErrors?.name && <span className={styles.error}>{state.fieldErrors.name}</span>}</label>
      <label className={styles.field}>{copy.email}<input name="email" type="email" required maxLength={254} autoComplete="email" className={styles.control} aria-invalid={Boolean(state.fieldErrors?.email)} />{state.fieldErrors?.email && <span className={styles.error}>{state.fieldErrors.email}</span>}</label>
      <label className={styles.field}>{copy.phone}<input name="phone" type="tel" maxLength={40} autoComplete="tel" className={styles.control} aria-invalid={Boolean(state.fieldErrors?.phone)} />{state.fieldErrors?.phone && <span className={styles.error}>{state.fieldErrors.phone}</span>}</label>
      <label className={styles.field}>{copy.organization}<input name="organization" maxLength={160} autoComplete="organization" className={styles.control} aria-invalid={Boolean(state.fieldErrors?.organization)} />{state.fieldErrors?.organization && <span className={styles.error}>{state.fieldErrors.organization}</span>}</label>
      <label className={styles.field}>{copy.message}<textarea name="message" required minLength={10} maxLength={5000} className={`${styles.control} ${styles.textarea}`} aria-invalid={Boolean(state.fieldErrors?.message)} />{state.fieldErrors?.message && <span className={styles.error}>{state.fieldErrors.message}</span>}</label>
      <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button type="submit" className={styles.submit} disabled={pending}>{pending ? copy.sending : copy.submit}</button>
    </form>
  );
}
