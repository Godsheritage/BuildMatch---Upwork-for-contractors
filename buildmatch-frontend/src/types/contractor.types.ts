// Legacy shape — used by ContractorCard/ContractorsPage, will be migrated later
export interface Contractor {
  id: string;
  userId: string;
  name: string;
  specialty: string[];
  bio: string;
  rating: number;
  reviewCount: number;
  hourlyRateMin: number;
  hourlyRateMax: number;
  yearsExperience: number;
  avatarUrl?: string;
  location: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  tradeType: string;
  city: string;
  state: string;
  budgetMin: number;
  budgetMax: number;
  durationWeeks: number;
  completedAt: string;
  photos: string[];
  clientName: string;
  clientReview: string;
  clientRating: number;
  highlights: string[];
}

// Matches the buildmatch-backend API response shape
export interface ContractorProfile {
  id: string;
  userId: string;
  bio: string | null;
  yearsExperience: number;
  specialties: string[];
  licenseNumber: string | null;
  licenseState: string | null;
  isLicenseVerified: boolean;
  insuranceExpiry: string | null;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  avatarUrl: string | null;
  portfolioImages: string[];
  portfolioProjects: PortfolioProject[] | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  averageRating: number;
  totalReviews: number;
  completedJobs: number;
  isAvailable: boolean;
  reliabilityScore: number | null;
  createdAt: string;
  updatedAt: string;
  user: {
    firstName: string;
    lastName: string;
    email?: string;
  };
}

export interface UpdateProfilePayload {
  bio?: string;
  yearsExperience?: number;
  specialties?: string[];
  licenseNumber?: string;
  licenseState?: string;
  insuranceExpiry?: string | null;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  city?: string;
  state?: string;
  zipCode?: string;
  isAvailable?: boolean;
  avatarUrl?: string;
}
