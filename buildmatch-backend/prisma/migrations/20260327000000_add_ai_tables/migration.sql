-- AlterTable: add AI matching signals to contractor profiles
ALTER TABLE "ContractorProfile"
  ADD COLUMN "bidWinRate"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "reliabilityScore"     INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "responseTimeAvgHours" DOUBLE PRECISION NOT NULL DEFAULT 24;

-- CreateTable: AI usage log (shared by all AI features)
CREATE TABLE "ai_usage_log" (
    "id"           TEXT NOT NULL,
    "feature"      TEXT NOT NULL,
    "userId"       TEXT,
    "model"        TEXT NOT NULL,
    "inputTokens"  INTEGER,
    "outputTokens" INTEGER,
    "latencyMs"    INTEGER,
    "success"      BOOLEAN NOT NULL DEFAULT true,
    "errorMsg"     TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable: matching results cache (5 min TTL handled in service layer)
CREATE TABLE "matching_cache" (
    "jobId"       TEXT NOT NULL,
    "results"     JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matching_cache_pkey" PRIMARY KEY ("jobId")
);

-- AddForeignKey
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_cache" ADD CONSTRAINT "matching_cache_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: no public access to internal AI tables
ALTER TABLE "ai_usage_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access" ON "ai_usage_log" FOR ALL USING (false);

ALTER TABLE "matching_cache" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access" ON "matching_cache" FOR ALL USING (false);
