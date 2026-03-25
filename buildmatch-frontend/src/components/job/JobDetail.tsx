import type { Job } from '../../types/job.types';

interface JobDetailProps {
  job: Job;
}

export function JobDetail({ job }: JobDetailProps) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold text-primary">{job.title}</h2>
      <p className="text-muted mt-2">{job.description}</p>
    </div>
  );
}
