import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sideClubs, sideName } from '../../../../../../components/matches/side-name';
import { matchStageLabel } from '../../../../../../components/matches/match-card';
import { MatchScoreTable } from '../../../../../../components/matches/match-score-table';
import { LiveBadge } from '../../../../../../components/common/live-badge';
import styles from '../../../../../../components/matches/match-detail.module.css';
import { format, getDictionary } from '../../../../../../i18n/get-dictionary';
import { isLocale } from '../../../../../../i18n/locales';
import { pickLocalized } from '../../../../../../i18n/pick-localized';
import { sideSourceLabel } from '../../../../../../i18n/render-bracket-labels';
import { formatMatchTime } from '../../../../../../lib/format-date-time';
import { getMatch, isUrlPart } from '../../../../../../lib/public-data';
import { pageMetadata } from '../../../../../../lib/page-metadata';

interface MatchPageProps {
  params: Promise<{ locale: string; slug: string; matchNo: string }>;
}

/** One API call: the match detail carries its event name, so the page skips the event header fetch. */
async function load(params: MatchPageProps['params']) {
  const { locale, slug, matchNo } = await params;
  if (!isLocale(locale) || !isUrlPart(slug) || !/^\d{1,9}$/.test(matchNo)) notFound();
  const match = await getMatch(slug, Number(matchNo));
  if (!match) notFound();
  return { locale, match, t: getDictionary(locale) };
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { locale, match, t } = await load(params);
  const title = `${sideName(locale, match.side1) || '?'} – ${sideName(locale, match.side2) || '?'}`;
  return pageMetadata(locale, `/events/${match.event.slug}/matches/${match.matchNo}`, {
    title: `${title} · ${format(t.match.title, { matchNo: match.matchNo })} · ${pickLocalized(locale, match.event.name, match.event.nameEn)}`,
  });
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { locale, match: m, t } = await load(params);
  const eventBase = `/${locale}/events/${m.event.slug}`;
  const back = m.drawKind === 'GROUP'
    ? { href: `${eventBase}/groups/${m.subEvent.code}`, label: t.match.toGroups }
    : { href: `${eventBase}/draws/${m.subEvent.code}${m.drawKind === 'QUALIFYING' ? '?draw=qualifying' : ''}`, label: t.match.toBracket };
  const time = (iso: string | null) => (iso ? formatMatchTime(iso, locale, m.event.timezone) : null);
  const sides = [
    { side: m.side1, source: m.side1Source, games: m.games1, won: m.winnerSide === 1 },
    { side: m.side2, source: m.side2Source, games: m.games2, won: m.winnerSide === 2 },
  ];
  const facts = [
    { label: t.match.scheduledAt, value: time(m.scheduledAt) },
    { label: t.match.startedAt, value: time(m.startedAt) },
    { label: t.match.officialAt, value: time(m.officialAt) },
  ].filter((f) => f.value);

  return (
    <main id="content" className="container">
      <p className="eyebrow">
        <Link href={eventBase}>{pickLocalized(locale, m.event.name, m.event.nameEn)}</Link>
      </p>
      <h1 className="page-title">
        {format(t.match.title, { matchNo: m.matchNo })} · {pickLocalized(locale, m.subEvent.name, m.subEvent.nameEn)} · {matchStageLabel(m, t)}
      </h1>

      <section className={styles.board} aria-label={t.match.status[m.status]}>
        <p className={styles.status}>
          {m.status === 'LIVE' ? <LiveBadge label={t.bracket.live} variant="deep" /> : t.match.status[m.status]}
          {m.resultType && m.resultType !== 'NORMAL' && ` · ${t.bracket.result[m.resultType]}`}
        </p>
        <div className={styles.sides}>
          {sides.map(({ side, source, games, won }, i) => (
            <div key={i} className={`${styles.side} ${won ? styles.winner : ''}`}>
              <p className={styles.name}>
                {side?.seed != null && <span className={styles.seed}>[{side.seed}] </span>}
                {side ? sideName(locale, side) : sideSourceLabel(t.bracket, source)}
              </p>
              {side && sideClubs(side) && <p className={styles.club}>{sideClubs(side)}</p>}
              <p className={styles.games}>{m.status === 'SCHEDULED' ? '–' : (games ?? 0)}</p>
            </div>
          ))}
        </div>
        {m.voided && <p className={styles.voided}>{t.match.voidedNote}</p>}
      </section>

      {m.games.length > 0 && (
        <>
          <h2 className="section-title">{t.match.scoreTable}</h2>
          <MatchScoreTable match={m} locale={locale} t={t.match} />
        </>
      )}

      {facts.length > 0 && (
        <dl className={styles.facts}>
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p>
        <Link href={back.href} className={styles.back}>
          {back.label}
        </Link>
      </p>
    </main>
  );
}
