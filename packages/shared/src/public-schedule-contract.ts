import type { PublicMatchCard, PublicNamed } from './public-event-contract.js';

export interface PublicScheduleTable {
  code: string;
  displayName: string | null;
  matches: PublicMatchCard[];
}

export interface PublicScheduleSession {
  code: string;
  name: string | null;
  nameEn: string | null;
  /** Calendar date in the event timezone. */
  date: string;
  startsAt: string;
  endsAt: string | null;
  venue: PublicNamed | null;
  tables: PublicScheduleTable[];
}

export interface PublicSchedule {
  event: PublicNamed & { slug: string; timezone: string };
  sessions: PublicScheduleSession[];
  /** Only sessions and tables carrying publicly visible, scheduled matches. */
  filters: {
    sessions: Pick<PublicScheduleSession, 'code' | 'name' | 'nameEn' | 'date'>[];
    tables: Pick<PublicScheduleTable, 'code' | 'displayName'>[];
  };
}
