import type { PublicSide } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';

export const sideName = (locale: Locale, side: PublicSide | null): string =>
  side ? side.players.map((p) => pickLocalized(locale, p.name, p.nameEn)).join(' / ') : '';

export const sideClubs = (side: PublicSide | null): string =>
  side ? [...new Set(side.players.map((p) => p.club).filter(Boolean))].join(' / ') : '';
