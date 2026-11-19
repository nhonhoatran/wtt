/** Site-wide values the public site reads on every request (site name, proxy rate limits). */
export interface PublicSiteConfig {
  siteName: { vi: string; en: string };
  rateLimit: { windowSeconds: number; maxRequests: number; searchMaxRequests: number; maxTrackedIps: number };
  contactRateLimit: { windowSeconds: number; maxRequests: number };
}

export interface PublicSitemap {
  events: { slug: string; updatedAt: string }[];
  articles: { slug: string; updatedAt: string }[];
  pages: { slug: string; updatedAt: string }[];
}
