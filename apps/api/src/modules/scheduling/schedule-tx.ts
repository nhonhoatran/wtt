/**
 * Fixed on purpose (internal reliability knob, not an operational setting). Re-timing a session rewrites every match of it, and the locks taken first (sub-events, draw, sessions)
 * can wait behind result entry on match day; the 5 s Prisma default would abort a legitimate schedule edit.
 */
export const SCHEDULE_TX_TIMEOUT_MS = 30_000;
