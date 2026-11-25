import type { SiteNavKey, SiteSocialPlatform } from './public-site-display-settings.js';

export interface PublicSiteDisplay {
  navItems: { key: SiteNavKey; labelVi?: string; labelEn?: string }[];
  socialLinks: { platform: SiteSocialPlatform; url: string }[];
  tagline: { vi: string; en: string } | null;
  /** Empty string = hide the registration button. */
  registrationUrl: string;
  /** 0 = the "expiring soon" label is off. */
  rankingExpiringSoonDays: number;
}

/** Site-wide values the public site reads on every request (site name, proxy rate limits, display settings). */
export interface PublicSiteConfig {
  siteName: { vi: string; en: string };
  rateLimit: { windowSeconds: number; maxRequests: number; searchMaxRequests: number; maxTrackedIps: number };
  contactRateLimit: { windowSeconds: number; maxRequests: number };
  display: PublicSiteDisplay;
}

export interface PublicSitemap {
  events: {
    slug: string;
    updatedAt: string;
    tabs: { matches: boolean; info: boolean };
    subEvents: { code: string; drawKinds: ('MAIN' | 'QUALIFYING')[]; hasGroups: boolean; entryCount: number }[];
  }[];
  articles: { slug: string; updatedAt: string }[];
  pages: { slug: string; updatedAt: string }[];
  videos: { slug: string; updatedAt: string }[];
  matches: { eventSlug: string; matchNo: number; updatedAt: string }[];
}
