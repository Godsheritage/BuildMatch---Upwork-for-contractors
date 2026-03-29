export interface SavedList {
  id: string;
  investorId: string;
  name: string;
  isDefault: boolean;
  contractorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedContractor {
  id: string;
  listId: string;
  investorId: string;
  contractorProfileId: string;
  note: string | null;
  savedAt: string;
  contractor: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    bio: string | null;
    specialties: string[];
    averageRating: number;
    totalReviews: number;
    yearsExperience: number;
    completedJobs: number;
    hourlyRateMin: number | null;
    hourlyRateMax: number | null;
    city: string | null;
    state: string | null;
    isAvailable: boolean;
    reliabilityScore: number;
    isLicenseVerified: boolean;
  };
}

export interface SavedContractorIds {
  // Map of contractor_profile_id -> list_id for fast icon state lookup
  saved: Record<string, string>;
}
