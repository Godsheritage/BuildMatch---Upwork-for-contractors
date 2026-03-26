import type { JobPost } from '../../types/job.types';
import { JobCard } from './JobCard';

interface JobListProps {
  jobs: JobPost[];
}

export function JobList({ jobs }: JobListProps) {
  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
