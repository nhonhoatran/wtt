import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventShell } from '../../../../../components/events/event-shell';
import styles from '../../../../../components/events/event-info.module.css';
import { pickLocalizedOrNull } from '../../../../../i18n/pick-localized';
import { loadEventPage } from '../../../../../lib/event-page';
import { getEventInfo } from '../../../../../lib/public-data';
import { eventPageMetadata } from '../../../../../lib/page-metadata';

interface InfoPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: InfoPageProps): Promise<Metadata> {
  const { locale, event, t } = await loadEventPage(params);
  return eventPageMetadata(locale, event, '/info', t.info.title);
}

export default async function EventInfoPage({ params }: InfoPageProps) {
  const { locale, event, t } = await loadEventPage(params);
  if (!event.tabs.info) notFound();
  const info = await getEventInfo(event.slug);
  // Either language beats a 404: the tab shows whenever one of them is set.
  const html = info && (pickLocalizedOrNull(locale, info.infoBody, info.infoBodyEn) ?? info.infoBodyEn);
  if (!html) notFound();
  return (
    <EventShell event={event} locale={locale} t={t} active="info">
      <h2 className="visually-hidden">{t.info.title}</h2>
      {/* Safe: the API re-sanitizes infoBody with the rich-text allowlist on the way out. */}
      <div className={styles.body} dangerouslySetInnerHTML={{ __html: html }} />
    </EventShell>
  );
}
