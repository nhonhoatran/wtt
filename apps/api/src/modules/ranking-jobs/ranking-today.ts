import { todayInTimezone, tournamentSettings } from '@kamito/shared';
import type { AppSettingsService } from '../settings/app-settings.service.js';

/** "Today" for ranking dates in the business timezone (`event.defaultTimezone`), not server UTC. */
export async function rankingToday(settings: AppSettingsService, now: Date = new Date()): Promise<string> {
  return (await rankingDateContext(settings, now)).today;
}

/** Share the same clock and timezone with admin date inputs and date-only expiry labels. */
export async function rankingDateContext(settings: AppSettingsService, now: Date = new Date()) {
  const timeZone = await settings.get(tournamentSettings.defaultTimezone);
  return { today: todayInTimezone(timeZone, now), timeZone };
}
