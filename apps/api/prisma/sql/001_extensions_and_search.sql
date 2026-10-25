-- =============================================================================
-- Paste into the FIRST migration, ABOVE the Prisma-generated SQL:
--   pnpm --filter api exec prisma migrate dev --create-only --name init
--   (edit prisma/migrations/<ts>_init/migration.sql, then)
--   pnpm --filter api exec prisma migrate dev
--
-- The trigger section (below the marker) must come AFTER the CREATE TABLE "articles"
-- statement, so put it at the very END of the same migration file.
-- =============================================================================

-- ---- 1) TOP OF MIGRATION ----------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram similarity (duplicate detection, typeahead)
CREATE EXTENSION IF NOT EXISTS unaccent;  -- accent-insensitive search

-- Sequential invoice numbers (INV-YYYY-NNNNNN). Used by InvoiceNumberService.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- ---- 2) BOTTOM OF MIGRATION (after CREATE TABLE "articles") -----------------
-- 'simple' config + unaccent = language-neutral (works for English, Bangla, Arabic).
-- Switch to a per-language config later if needed (e.g. 'english' for stemming).
CREATE OR REPLACE FUNCTION articles_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
      setweight(to_tsvector('simple', unaccent(coalesce(NEW."title", ''))),     'A')
   || setweight(to_tsvector('simple', unaccent(coalesce(NEW."subtitle", ''))),  'B')
   || setweight(to_tsvector('simple', unaccent(coalesce(NEW."excerpt", ''))),   'B')
   || setweight(to_tsvector('simple', unaccent(coalesce(NEW."plainText", ''))), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_search_vector_trg ON "articles";
CREATE TRIGGER articles_search_vector_trg
  BEFORE INSERT OR UPDATE OF "title", "subtitle", "excerpt", "plainText"
  ON "articles"
  FOR EACH ROW
  EXECUTE FUNCTION articles_search_vector_update();

-- Example search query used by SearchRepository (via $queryRaw with parameters):
--   SELECT id, ts_rank_cd("searchVector", q) AS rank
--   FROM articles, websearch_to_tsquery('simple', unaccent($1)) q
--   WHERE "searchVector" @@ q AND status = 'PUBLISHED' AND "deletedAt" IS NULL
--   ORDER BY rank DESC, "publishedAt" DESC
--   LIMIT $2 OFFSET $3;
