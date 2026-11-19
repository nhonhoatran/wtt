CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

CREATE TABLE "Article" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "titleEn" TEXT,
  "summary" TEXT,
  "summaryEn" TEXT,
  "body" TEXT NOT NULL,
  "bodyEn" TEXT,
  "coverMediaId" TEXT,
  "category" TEXT,
  "authorName" TEXT,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "publishAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");
CREATE INDEX "Article_category_status_publishedAt_idx" ON "Article"("category", "status", "publishedAt");
CREATE INDEX "Article_isFeatured_status_publishedAt_idx" ON "Article"("isFeatured", "status", "publishedAt");
ALTER TABLE "Article" ADD CONSTRAINT "Article_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ArticleEvent" (
  "articleId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  CONSTRAINT "ArticleEvent_pkey" PRIMARY KEY ("articleId", "eventId")
);
CREATE INDEX "ArticleEvent_eventId_idx" ON "ArticleEvent"("eventId");
ALTER TABLE "ArticleEvent" ADD CONSTRAINT "ArticleEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleEvent" ADD CONSTRAINT "ArticleEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Video" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "titleEn" TEXT,
  "url" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "embedId" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "durationText" TEXT,
  "eventId" TEXT,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Video_slug_key" ON "Video"("slug");
CREATE INDEX "Video_status_publishedAt_idx" ON "Video"("status", "publishedAt");
CREATE INDEX "Video_eventId_status_publishedAt_idx" ON "Video"("eventId", "status", "publishedAt");
ALTER TABLE "Video" ADD CONSTRAINT "Video_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Sponsor" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoMediaId" TEXT,
  "logoDarkMediaId" TEXT,
  "url" TEXT,
  "roleLabel" TEXT,
  "roleLabelEn" TEXT,
  "eventId" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Sponsor_eventId_isActive_order_idx" ON "Sponsor"("eventId", "isActive", "order");
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_logoDarkMediaId_fkey" FOREIGN KEY ("logoDarkMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StaticPage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "titleEn" TEXT,
  "body" TEXT NOT NULL,
  "bodyEn" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "footerGroup" TEXT,
  "footerOrder" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaticPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaticPage_slug_key" ON "StaticPage"("slug");
CREATE INDEX "StaticPage_status_footerGroup_footerOrder_idx" ON "StaticPage"("status", "footerGroup", "footerOrder");

CREATE TABLE "ContactMessage" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "organization" TEXT,
  "message" TEXT NOT NULL,
  "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
  "ipHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
