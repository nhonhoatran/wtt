import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { PlayerCurrentRanks } from '../../../../components/players/player-current-ranks';
import { PlayerEventsTable } from '../../../../components/players/player-events-table';
import { PlayerHero } from '../../../../components/players/player-hero';
import { PlayerResultsList } from '../../../../components/players/player-results-list';
import styles from '../../../../components/players/players.module.css';
import { getDictionary } from '../../../../i18n/get-dictionary';
import { isLocale } from '../../../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../../../i18n/pick-localized';
import { pageMetadata } from '../../../../lib/page-metadata';
import { getPlayerProfile, getPlayerResults, isUrlPart } from '../../../../lib/public-data';
import { isPageParam, toQuery } from '../../../../lib/public-query';

interface PlayerProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function loadPlayer(params: PlayerProps['params']) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isUrlPart(slug)) notFound();
  const player = await getPlayerProfile(slug);
  if (!player) notFound();
  // The proxy handles normal HTTP requests with 301; this also covers an RSC navigation race.
  if ('redirectTo' in player) {
    if (!isUrlPart(player.redirectTo)) notFound();
    permanentRedirect(`/${locale}/players/${player.redirectTo}`);
  }
  return { locale, player, t: getDictionary(locale) };
}

export async function generateMetadata({ params }: PlayerProps): Promise<Metadata> {
  const { locale, player } = await loadPlayer(params);
  return {
    ...pageMetadata(locale, `/players/${player.slug}`, {
      title: pickLocalized(locale, player.name, player.nameEn),
      description: pickLocalizedOrNull(locale, player.bio, player.bioEn),
      image: player.photo,
    }),
    robots: { index: !player.noindex, follow: true },
  };
}

export default async function PlayerPage({ params, searchParams }: PlayerProps) {
  const [{ locale, player, t }, query] = await Promise.all([loadPlayer(params), searchParams]);
  const results = await getPlayerResults(player.slug, toQuery(query, { page: isPageParam }));
  if (!results) notFound();
  const bio = pickLocalizedOrNull(locale, player.bio, player.bioEn);
  return (
    <main id="content">
      <PlayerHero player={player} locale={locale} t={t.players} />
      <div className="container">
        {bio && <section><h2 className="section-title">{t.players.profile.bio}</h2><p className={styles.bio}>{bio}</p></section>}
        <section aria-labelledby="results"><h2 id="results" className="section-title">{t.players.profile.results}</h2><PlayerResultsList results={results} slug={player.slug} locale={locale} t={t} /></section>
        <section aria-labelledby="current-ranks"><h2 id="current-ranks" className="section-title">{t.players.profile.currentRanks}</h2><PlayerCurrentRanks ranks={player.ranks} locale={locale} t={t} /></section>
        <section aria-labelledby="events"><h2 id="events" className="section-title">{t.players.profile.events}</h2><PlayerEventsTable events={player.events} locale={locale} t={t.players.profile} /></section>
      </div>
    </main>
  );
}
