import type { Job } from '../../types/job.types';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  return (
    <div className="bg-white border border-border rounded-md p-5 hover:shadow-card-hover transition-all">
      <p className="font-semibold text-primary">{job.title}</p>
      <p className="text-sm text-muted">{job.location}</p>
    </div>
  );
}
