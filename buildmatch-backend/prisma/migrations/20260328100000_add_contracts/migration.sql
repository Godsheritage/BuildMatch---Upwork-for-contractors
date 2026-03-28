-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURES', 'ACTIVE', 'COMPLETED', 'VOIDED');

-- CreateTable
CREATE TABLE "contracts" (
    "id"                         TEXT NOT NULL,
    "jobId"                      TEXT NOT NULL,
    "investorId"                 TEXT NOT NULL,
    "contractorId"               TEXT NOT NULL,
    "bidId"                      TEXT,
    "status"                     "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "title"                      TEXT NOT NULL,
    "scopeOfWork"                TEXT NOT NULL,
    "exclusions"                 TEXT,
    "investorResponsibilities"   TEXT,
    "contractorResponsibilities" TEXT,
    "timelineEstimate"           TEXT,
    "timelineOverageClause"      TEXT,
    "disputeResolutionProcess"   TEXT,
    "paymentSchedule"            JSONB NOT NULL,
    "aiGenerated"                BOOLEAN NOT NULL DEFAULT true,
    "aiModel"                    TEXT,
    "investorSignedAt"           TIMESTAMPTZ,
    "contractorSignedAt"         TIMESTAMPTZ,
    "investorIp"                 TEXT,
    "contractorIp"               TEXT,
    "fullText"                   TEXT NOT NULL,
    "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_investorId_fkey"
    FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contractorId_fkey"
    FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_bidId_fkey"
    FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "idx_contracts_job"        ON "contracts"("jobId");
CREATE INDEX "idx_contracts_investor"   ON "contracts"("investorId");
CREATE INDEX "idx_contracts_contractor" ON "contracts"("contractorId");

-- Row-level security
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties see own contracts" ON "contracts"
    FOR SELECT USING (true);
