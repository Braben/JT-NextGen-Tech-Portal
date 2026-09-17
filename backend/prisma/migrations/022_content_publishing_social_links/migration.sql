ALTER TABLE "blogs" ADD COLUMN "content_type" TEXT NOT NULL DEFAULT 'blog';
ALTER TABLE "blogs" ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'draft';
UPDATE "blogs" SET "review_status" = 'published' WHERE "published" = 1;
CREATE TABLE "social_links" ("platform" TEXT PRIMARY KEY, "url" TEXT NOT NULL DEFAULT '');
