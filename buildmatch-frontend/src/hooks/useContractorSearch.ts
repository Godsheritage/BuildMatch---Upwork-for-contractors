import { useMutation } from '@tanstack/react-query';
import api from '../services/api';

export interface SearchedContractor {
  contractorId:        string;
  contractorProfileId: string;
  firstName:           string;
  lastName:            string;
  avatarUrl:           string | null;
  specialties:         string[];
  averageRating:       number;
  completedJobs:       number;
  yearsExperience:     number;
  hourlyRateMin:       number | null;
  hourlyRateMax:       number | null;
  city:                string | null;
  state:               string | null;
  reliabilityScore:    number;
  matchScore:          number;
  matchExplanation:    string;
  matchReasons:        string[];
}

export interface SearchResult {
  contractors: SearchedContractor[];
  generatedAt: string;
  fromCache:   boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

async function postSearch(query: string): Promise<SearchResult> {
  const { data: res } = await api.post<ApiResponse<SearchResult>>('/ai/search', { query });
  return res.data;
}

export function useContractorSearch() {
  const mutation = useMutation({
    mutationFn: postSearch,
  });

  return {
    results:   mutation.data?.contractors ?? null,
    isPending: mutation.isPending,
    isError:   mutation.isError,
    search:    (query: string) => mutation.mutate(query),
    reset:     () => mutation.reset(),
  };
}
