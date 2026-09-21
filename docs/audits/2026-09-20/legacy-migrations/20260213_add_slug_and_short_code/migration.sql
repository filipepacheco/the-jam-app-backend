-- AlterTable: Add slug and shortCode columns to jams
ALTER TABLE "jams" ADD COLUMN "slug" TEXT;
ALTER TABLE "jams" ADD COLUMN "codigo_curto" TEXT;

-- CreateIndex: Unique constraints
CREATE UNIQUE INDEX "jams_slug_key" ON "jams"("slug");
CREATE UNIQUE INDEX "jams_codigo_curto_key" ON "jams"("codigo_curto");

-- Backfill existing jams with short codes and slugs
-- Short code: first 6 hex chars of UUID (uppercase, hyphens stripped)
-- Slug: slugified name + lowercase short code suffix
UPDATE "jams"
SET
  "codigo_curto" = UPPER(LEFT(REPLACE(id::text, '-', ''), 6)),
  "slug" = CONCAT(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        LOWER(REGEXP_REPLACE("nome", '[^a-zA-Z0-9 ]', '', 'g')),
        '\s+', '-', 'g'
      ),
      '^-+|-+$', '', 'g'
    ),
    '-',
    LOWER(LEFT(REPLACE(id::text, '-', ''), 6))
  )
WHERE "codigo_curto" IS NULL;
