import type { Contractor } from '../../types/contractor.types';

interface ContractorProfileProps {
  contractor: Contractor;
}

export function ContractorProfile({ contractor }: ContractorProfileProps) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold text-primary">{contractor.name}</h2>
      <p className="text-muted mt-1">{contractor.bio}</p>
    </div>
  );
}
