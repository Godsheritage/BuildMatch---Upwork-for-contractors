import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface MatchedContractor {
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

export interface MatchingResult {
  matches:     MatchedContractor[];
  generatedAt: string;
  jobId:       string;
}

interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

async function fetchContractorMatching(jobId: string): Promise<MatchingResult> {
  const { data: res } = await api.get<ApiResponse<MatchingResult>>(`/ai/matching/${jobId}`);
  return res.data;
}

export function useContractorMatching(jobId: string) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contractor-matching', jobId],
    queryFn:  () => fetchContractorMatching(jobId),
    staleTime: 5 * 60 * 1000, // 5 minutes — matches server cache TTL
    enabled:   !!jobId,
  });

  return {
    matches:   data?.matches ?? [],
    isLoading,
    isError,
    refetch,
  };
}
