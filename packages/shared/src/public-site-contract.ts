/** Site-wide values the public site reads on every request (site name, proxy rate limits). */
export interface PublicSiteConfig {
  siteName: { vi: string; en: string };
  rateLimit: { windowSeconds: number; maxRequests: number; searchMaxRequests: number; maxTrackedIps: number };
}

export interface PublicSitemap {
  events: { slug: string; updatedAt: string }[];
}
