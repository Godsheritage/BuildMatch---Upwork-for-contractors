import type { ContractorProfile } from '../../types/contractor.types';
import { ContractorCard } from './ContractorCard';

interface ContractorListProps {
  contractors: ContractorProfile[];
}

export function ContractorList({ contractors }: ContractorListProps) {
  return (
    <div className="grid gap-4">
      {contractors.map((c) => (
        <ContractorCard key={c.id} contractor={c} />
      ))}
    </div>
  );
}
