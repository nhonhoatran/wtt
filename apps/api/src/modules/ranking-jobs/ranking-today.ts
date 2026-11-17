import { todayInTimezone, tournamentSettings } from '@kamito/shared';
import type { AppSettingsService } from '../settings/app-settings.service.js';

/** "Today" for ranking dates in the business timezone (`event.defaultTimezone`), not server UTC. */
export async function rankingToday(settings: AppSettingsService, now: Date = new Date()): Promise<string> {
  return todayInTimezone(await settings.get(tournamentSettings.defaultTimezone), now);
}
