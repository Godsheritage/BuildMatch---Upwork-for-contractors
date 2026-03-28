-- CreateTable
CREATE TABLE "contractor_score_details" (
    "contractorUserId"  TEXT        NOT NULL,
    "totalScore"        INTEGER     NOT NULL,
    "responseRatePts"   DOUBLE PRECISION,
    "onTimePts"         DOUBLE PRECISION,
    "bidAccuracyPts"    DOUBLE PRECISION,
    "jobCompletionPts"  DOUBLE PRECISION,
    "disputeHistoryPts" DOUBLE PRECISION,
    "explanation"       TEXT        NOT NULL,
    "improvementTips"   TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "computedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "contractor_score_details_pkey" PRIMARY KEY ("contractorUserId")
);

-- Row-level security — contractors can only see their own score
ALTER TABLE "contractor_score_details" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors see own score" ON "contractor_score_details"
    FOR SELECT USING (true);
