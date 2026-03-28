import app from './app';
import { registerReliabilityScoreJob } from './jobs/reliability-score.job';

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  registerReliabilityScoreJob();
});
