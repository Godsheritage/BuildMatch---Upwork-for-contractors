import type { Contractor } from '../../types/contractor.types';

interface ContractorCardProps {
  contractor: Contractor;
}

export function ContractorCard({ contractor }: ContractorCardProps) {
  return (
    <div className="bg-white border border-border rounded-md p-5 hover:border-primary/20 hover:shadow-card-hover transition-all">
      <p className="font-semibold text-primary">{contractor.name}</p>
      <p className="text-sm text-muted">{contractor.location}</p>
    </div>
  );
}
