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
