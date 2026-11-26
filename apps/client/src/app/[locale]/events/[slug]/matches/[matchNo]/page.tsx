import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sideName } from '../../../../../../components/matches/side-name';
import { matchStageLabel } from '../../../../../../components/matches/match-card';
import { MatchMetaRow } from '../../../../../../components/matches/match-meta-row';
import { MatchPath } from '../../../../../../components/matches/match-path';
import { MatchScoreTable } from '../../../../../../components/matches/match-score-table';
import { MatchScoreboard } from '../../../../../../components/matches/match-scoreboard';
import { MatchSidebar } from '../../../../../../components/matches/match-sidebar';
import { MatchSummary } from '../../../../../../components/matches/match-summary';
import { StatusPill } from '../../../../../../components/common/status-pill';
import styles from '../../../../../../components/matches/match-detail.module.css';
import { format, getDictionary } from '../../../../../../i18n/get-dictionary';
import { isLocale } from '../../../../../../i18n/locales';
import { pickLocalized } from '../../../../../../i18n/pick-localized';
import { followUpMatch, locateMatch } from '../../../../../../lib/bracket-derivations';
import { MATCH_STATUS_PILL } from '../../../../../../lib/match-display';
import { loadMatchContext } from '../../../../../../lib/load-match-context';
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
  const participants = `${sideName(locale, match.side1) || t.bracket.source.TBD} – ${sideName(locale, match.side2) || t.bracket.source.TBD}`;
  const title = `${participants} · ${format(t.match.title, { matchNo: match.matchNo })} · ${pickLocalized(locale, match.event.name, match.event.nameEn)}`;
  return pageMetadata(locale, `/events/${match.event.slug}/matches/${match.matchNo}`, {
    title,
    description: format(t.match.metaDescription, {
      title, subEvent: pickLocalized(locale, match.subEvent.name, match.subEvent.nameEn),
      stage: matchStageLabel(match, t), status: t.match.status[match.status],
    }),
  });
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { locale, match: m, t } = await load(params);
  const context = await loadMatchContext(m);
  const eventBase = `/${locale}/events/${m.event.slug}`;
  const back = m.drawKind === 'GROUP'
    ? { href: `${eventBase}/groups/${m.subEvent.code}`, label: t.match.toGroups }
    : { href: `${eventBase}/draws/${m.subEvent.code}${m.drawKind === 'QUALIFYING' ? '?draw=qualifying' : ''}`, label: t.match.toBracket };
  const followUp = context.rounds ? followUpMatch(context.rounds, m.matchNo) : null;
  const sameRound = context.rounds ? locateMatch(context.rounds, m.matchNo)?.round.matches.filter((x) => x.resultType !== 'BYE') : undefined;
  const neighbours = (context.groupMatches ?? sameRound ?? []).filter((x) => x.matchNo !== m.matchNo).slice(0, context.listLimit);

  return (
    <main id="content" className="container">
      <nav className={styles.crumbs} aria-label={t.match.navLabel}>
        <Link href={back.href} className={styles.back}>
          <span aria-hidden="true">← </span>
          {back.label}
        </Link>
        <StatusPill variant={MATCH_STATUS_PILL[m.status]} label={t.match.status[m.status]} />
      </nav>
      <p className="eyebrow">
        <Link href={eventBase}>{pickLocalized(locale, m.event.name, m.event.nameEn)}</Link>
      </p>
      <h1 className="page-title">
        {format(t.match.title, { matchNo: m.matchNo })} · {pickLocalized(locale, m.subEvent.name, m.subEvent.nameEn)} · {matchStageLabel(m, t)}
      </h1>

      <MatchScoreboard match={m} locale={locale} t={t} />
      <MatchMetaRow match={m} locale={locale} t={t} />

      <div className={styles.layout}>
        <div className={styles.main}>
          {m.games.length > 0 && (
            <>
              <h2 className="section-title">{t.match.scoreTable}</h2>
              <MatchScoreTable match={m} locale={locale} t={t.match} />
            </>
          )}
          <MatchSummary match={m} locale={locale} t={t} followUp={followUp} />
          {context.rounds && <MatchPath rounds={context.rounds} match={m} locale={locale} t={t} />}
        </div>
        <MatchSidebar
          match={m}
          locale={locale}
          t={t}
          followUp={followUp}
          neighbours={neighbours}
          neighboursTitle={m.groupCode ? format(t.match.sameGroup, { code: m.groupCode }) : t.match.sameRound}
        />
      </div>
    </main>
  );
}
