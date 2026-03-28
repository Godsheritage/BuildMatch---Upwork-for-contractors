import cron from 'node-cron';
import { computeAllReliabilityScores } from '../services/ai/reliability-score.service';

// Runs nightly at 2:00 AM
const SCHEDULE = '0 2 * * *';

export function registerReliabilityScoreJob(): void {
  cron.schedule(SCHEDULE, async () => {
    console.log('[cron] reliability-score: starting nightly computation');
    try {
      await computeAllReliabilityScores();
    } catch (err) {
      console.error('[cron] reliability-score: unhandled error:', err);
    }
  });

  console.log('[cron] reliability-score: registered (runs nightly at 02:00)');
}
