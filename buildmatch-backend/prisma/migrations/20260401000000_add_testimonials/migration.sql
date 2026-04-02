-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'SUBMITTED', 'EXPIRED');

-- CreateTable: TestimonialRequest
CREATE TABLE "testimonial_requests" (
    "id"                  TEXT NOT NULL,
    "contractorProfileId" TEXT NOT NULL,
    "recipientEmail"      TEXT NOT NULL,
    "recipientName"       TEXT NOT NULL,
    "personalMessage"     TEXT,
    "token"               TEXT NOT NULL,
    "status"              "TestimonialStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt"           TIMESTAMP(3) NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "testimonial_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Testimonial
CREATE TABLE "testimonials" (
    "id"                  TEXT NOT NULL,
    "contractorProfileId" TEXT NOT NULL,
    "requestId"           TEXT NOT NULL,
    "authorName"          TEXT NOT NULL,
    "authorEmail"         TEXT NOT NULL,
    "body"                TEXT NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "testimonial_requests_token_key" ON "testimonial_requests"("token");
CREATE UNIQUE INDEX "testimonials_requestId_key" ON "testimonials"("requestId");

-- Foreign keys
ALTER TABLE "testimonial_requests"
    ADD CONSTRAINT "testimonial_requests_contractorProfileId_fkey"
    FOREIGN KEY ("contractorProfileId")
    REFERENCES "ContractorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "testimonials"
    ADD CONSTRAINT "testimonials_contractorProfileId_fkey"
    FOREIGN KEY ("contractorProfileId")
    REFERENCES "ContractorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "testimonials"
    ADD CONSTRAINT "testimonials_requestId_fkey"
    FOREIGN KEY ("requestId")
    REFERENCES "testimonial_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
