-- ── Enums ──────────────────────────────────────────────────────────────────────
CREATE TYPE "DrawScheduleStatus"  AS ENUM ('DRAFT', 'NEGOTIATING', 'PENDING_APPROVAL', 'LOCKED');
CREATE TYPE "DrawMilestoneStatus" AS ENUM ('PENDING', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'DISPUTED', 'RELEASED');
CREATE TYPE "DrawRequestStatus"   AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISPUTED');

-- ── Jobs: add contractor_id + draw_schedule_locked ─────────────────────────────
ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "contractorId"       TEXT,
  ADD COLUMN IF NOT EXISTS "drawScheduleLocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── draw_schedules ─────────────────────────────────────────────────────────────
CREATE TABLE "draw_schedules" (
  "id"                   TEXT         NOT NULL,
  "jobId"                TEXT         NOT NULL,
  "status"               "DrawScheduleStatus" NOT NULL DEFAULT 'DRAFT',
  "totalAmount"          DOUBLE PRECISION     NOT NULL,
  "drawCount"            INTEGER              NOT NULL,
  "aiGenerated"          BOOLEAN              NOT NULL DEFAULT true,
  "investorApprovedAt"   TIMESTAMP(3),
  "contractorApprovedAt" TIMESTAMP(3),
  "lockedAt"             TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)         NOT NULL,

  CONSTRAINT "draw_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "draw_schedules_jobId_key" ON "draw_schedules"("jobId");

ALTER TABLE "draw_schedules"
  ADD CONSTRAINT "draw_schedules_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── draw_milestones ────────────────────────────────────────────────────────────
CREATE TABLE "draw_milestones" (
  "id"                 TEXT         NOT NULL,
  "scheduleId"         TEXT         NOT NULL,
  "jobId"              TEXT         NOT NULL,
  "drawNumber"         INTEGER      NOT NULL,
  "title"              TEXT         NOT NULL,
  "description"        TEXT         NOT NULL,
  "completionCriteria" TEXT         NOT NULL,
  "percentage"         DOUBLE PRECISION NOT NULL,
  "amount"             DOUBLE PRECISION NOT NULL,
  "status"             "DrawMilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt"        TIMESTAMP(3),
  "approvedAt"         TIMESTAMP(3),
  "releasedAt"         TIMESTAMP(3),
  "dueDate"            DATE,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "draw_milestones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "draw_milestones_scheduleId_drawNumber_key"
  ON "draw_milestones"("scheduleId", "drawNumber");

ALTER TABLE "draw_milestones"
  ADD CONSTRAINT "draw_milestones_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "draw_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "draw_milestones"
  ADD CONSTRAINT "draw_milestones_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── draw_requests ──────────────────────────────────────────────────────────────
CREATE TABLE "draw_requests" (
  "id"              TEXT         NOT NULL,
  "milestoneId"     TEXT         NOT NULL,
  "jobId"           TEXT         NOT NULL,
  "contractorId"    TEXT         NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "note"            TEXT,
  "status"          "DrawRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById"    TEXT,
  "reviewedAt"      TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "draw_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "draw_requests"
  ADD CONSTRAINT "draw_requests_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "draw_milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_requests"
  ADD CONSTRAINT "draw_requests_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_requests"
  ADD CONSTRAINT "draw_requests_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_requests"
  ADD CONSTRAINT "draw_requests_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── draw_evidence ──────────────────────────────────────────────────────────────
CREATE TABLE "draw_evidence" (
  "id"            TEXT         NOT NULL,
  "drawRequestId" TEXT         NOT NULL,
  "milestoneId"   TEXT         NOT NULL,
  "uploadedById"  TEXT         NOT NULL,
  "url"           TEXT         NOT NULL,
  "caption"       TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "draw_evidence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "draw_evidence"
  ADD CONSTRAINT "draw_evidence_drawRequestId_fkey"
  FOREIGN KEY ("drawRequestId") REFERENCES "draw_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "draw_evidence"
  ADD CONSTRAINT "draw_evidence_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "draw_milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_evidence"
  ADD CONSTRAINT "draw_evidence_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── draw_schedule_edits ────────────────────────────────────────────────────────
CREATE TABLE "draw_schedule_edits" (
  "id"          TEXT         NOT NULL,
  "scheduleId"  TEXT         NOT NULL,
  "editedById"  TEXT         NOT NULL,
  "editType"    TEXT         NOT NULL,
  "milestoneId" TEXT,
  "oldValues"   JSONB,
  "newValues"   JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "draw_schedule_edits_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "draw_schedule_edits"
  ADD CONSTRAINT "draw_schedule_edits_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "draw_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_schedule_edits"
  ADD CONSTRAINT "draw_schedule_edits_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_schedule_edits"
  ADD CONSTRAINT "draw_schedule_edits_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "draw_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX "draw_milestones_scheduleId_idx"  ON "draw_milestones"("scheduleId");
CREATE INDEX "draw_milestones_jobId_idx"       ON "draw_milestones"("jobId");
CREATE INDEX "draw_requests_milestoneId_idx"   ON "draw_requests"("milestoneId");
CREATE INDEX "draw_requests_jobId_idx"         ON "draw_requests"("jobId");
CREATE INDEX "draw_evidence_drawRequestId_idx" ON "draw_evidence"("drawRequestId");
