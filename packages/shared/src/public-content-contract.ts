import type { PublicEventCard, PublicImage } from './public-event-contract.js';
import type { PublicRankingTop } from './public-ranking-contract.js';

export interface PublicArticleCard {
  slug: string;
  title: string;
  titleEn: string | null;
  summary: string | null;
  summaryEn: string | null;
  cover: PublicImage | null;
  category: string | null;
  authorName: string | null;
  publishedAt: string;
  eventSlugs: string[];
}

export interface PublicArticle extends PublicArticleCard {
  body: string;
  bodyEn: string | null;
}

export interface PublicVideo {
  slug: string;
  title: string;
  titleEn: string | null;
  provider: string;
  embedId: string;
  url: string;
  thumbnailUrl: string | null;
  durationText: string | null;
  publishedAt: string;
  eventSlug: string | null;
}

export interface PublicStaticPage { slug: string; title: string; titleEn: string | null; body: string; bodyEn: string | null; updatedAt: string }
export interface PublicSponsor { name: string; logo: PublicImage | null; logoDark: PublicImage | null; url: string | null; roleLabel: string | null; roleLabelEn: string | null }
export interface PublicFooter { pages: Array<{ slug: string; title: string; titleEn: string | null; group: string | null; order: number }>; sponsors: PublicSponsor[] }
export interface PublicHome {
  featuredEvents: PublicEventCard[];
  upcomingEvents: PublicEventCard[];
  featuredArticles: PublicArticleCard[];
  latestVideos: PublicVideo[];
  sponsors: PublicSponsor[];
  topRankings: PublicRankingTop[];
  sections: { hero: boolean; events: boolean; news: boolean; videos: boolean; rankings: boolean; sponsors: boolean };
}
export interface PublicEventContent { articles: PublicArticleCard[]; videos: PublicVideo[]; sponsors: PublicSponsor[] }
export interface ContactSubmission { name: string; email: string; phone?: string | null; organization?: string | null; message: string; website?: string }
export interface PublicArticleList { data: PublicArticleCard[]; total: number; page: number; pageSize: number; categories: string[] }
export interface PublicVideoList { data: PublicVideo[]; total: number; page: number; pageSize: number }
