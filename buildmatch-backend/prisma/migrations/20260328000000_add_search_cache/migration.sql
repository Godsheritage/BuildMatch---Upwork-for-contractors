-- CreateTable: search_cache
CREATE TABLE "search_cache" (
  "queryHash"   TEXT NOT NULL,
  "query"       TEXT NOT NULL,
  "results"     JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_cache_pkey" PRIMARY KEY ("queryHash")
);

-- RLS: backend service-role only; no public access
ALTER TABLE "search_cache" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access" ON "search_cache" FOR ALL USING (false);
