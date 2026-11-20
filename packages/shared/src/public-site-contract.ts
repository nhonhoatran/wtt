/** Site-wide values the public site reads on every request (site name, proxy rate limits). */
export interface PublicSiteConfig {
  siteName: { vi: string; en: string };
  rateLimit: { windowSeconds: number; maxRequests: number; searchMaxRequests: number; maxTrackedIps: number };
  contactRateLimit: { windowSeconds: number; maxRequests: number };
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
