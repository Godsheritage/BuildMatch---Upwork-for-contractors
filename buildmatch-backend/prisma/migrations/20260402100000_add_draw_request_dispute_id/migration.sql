-- AddColumn: disputeId on draw_requests
-- Links a draw request to a Supabase dispute UUID when the investor files a dispute.

ALTER TABLE "draw_requests" ADD COLUMN "disputeId" TEXT;
