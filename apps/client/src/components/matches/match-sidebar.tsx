import Link from 'next/link';
import type { PublicMatchDetail, PublicSide, PublicSideSource } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { roundLabel, sideSourceLabel } from '../../i18n/render-bracket-labels';
import type { FollowUp } from '../../lib/bracket-derivations';
import { formatMatchTime } from '../../lib/format-date-time';
import { matchStageLabel } from './match-card';
import { sideName } from './side-name';
import styles from './match-sidebar.module.css';

/** What a neighbouring match needs to be listed; bracket matches and group matches both fit. */
export interface NeighbourMatch {
  matchNo: number;
  status: 'SCHEDULED' | 'LIVE' | 'OFFICIAL';
  games1: number | null;
  games2: number | null;
  scheduledAt: string | null;
  side1: PublicSide | null;
  side2: PublicSide | null;
  side1Source: PublicSideSource | null;
  side2Source: PublicSideSource | null;
}

interface MatchSidebarProps {
  match: PublicMatchDetail;
  locale: Locale;
  t: Dictionary;
  followUp: FollowUp | null;
  /** Related matches, already without the current one. */
  neighbours: NeighbourMatch[];
  neighboursTitle: string;
}

export function MatchSidebar({ match: m, locale, t, followUp, neighbours, neighboursTitle }: MatchSidebarProps) {
  const base = `/${locale}/events/${m.event.slug}`;
  const time = (iso: string | null) => (iso ? formatMatchTime(iso, locale, m.event.timezone) : null);
  const rows = [
    { label: t.match.infoEvent, value: pickLocalized(locale, m.event.name, m.event.nameEn) },
    { label: t.match.infoSubEvent, value: pickLocalized(locale, m.subEvent.name, m.subEvent.nameEn) },
    { label: m.groupCode ? t.groups.title : t.match.infoRound, value: matchStageLabel(m, t) },
    { label: t.match.startedAt, value: time(m.startedAt) },
    { label: t.match.officialAt, value: time(m.officialAt) },
    { label: t.match.infoStatus, value: t.match.status[m.status] },
  ].filter((row) => row.value);
  const nextTarget = followUp && `${roundLabel(t.bracket, followUp.next.round.code, followUp.next.round.number)}${followUp.next.round.matches.length > 1 ? ` ${followUp.next.match.orderInRound}` : ''}`;

  return (
    <aside className={styles.aside}>
      <section className={styles.card} aria-labelledby="match-info">
        <h2 id="match-info" className={styles.title}>{t.match.info}</h2>
        <dl className={styles.facts}>
          {rows.map((row) => (
            <div key={row.label} className={styles.fact}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {followUp && nextTarget && (
        <Link className={styles.next} href={`${base}/matches/${followUp.next.match.matchNo}`}>
          {format(t.match.nextMatch, { target: nextTarget })}
        </Link>
      )}

      {neighbours.length > 0 && (
        <section className={styles.card} aria-labelledby="match-neighbours">
          <h2 id="match-neighbours" className={styles.title}>{neighboursTitle}</h2>
          <ul className={styles.list}>
            {neighbours.map((n) => {
              const name = (side: PublicSide | null, source: PublicSideSource | null) => (side ? sideName(locale, side) : sideSourceLabel(t.bracket, source));
              const score = n.status === 'SCHEDULED' ? '–' : `${n.games1 ?? 0}–${n.games2 ?? 0}`;
              const when = n.status === 'SCHEDULED' ? time(n.scheduledAt) : null;
              return (
                <li key={n.matchNo}>
                  <Link className={styles.item} href={`${base}/matches/${n.matchNo}`}>
                    <span className={styles.pair}>{name(n.side1, n.side1Source)} {score} {name(n.side2, n.side2Source)}</span>
                    <span className={styles.state}>{[when, t.bracket.status[n.status]].filter(Boolean).join(' · ')}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
