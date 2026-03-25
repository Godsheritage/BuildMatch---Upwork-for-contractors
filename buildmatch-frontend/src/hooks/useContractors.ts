import { useQuery } from '@tanstack/react-query';
import { getContractors, getContractorById } from '../services/contractor.service';

export function useContractors() {
  return useQuery({
    queryKey: ['contractors'],
    queryFn: getContractors,
  });
}

export function useContractor(id: string) {
  return useQuery({
    queryKey: ['contractors', id],
    queryFn: () => getContractorById(id),
    enabled: !!id,
  });
}
