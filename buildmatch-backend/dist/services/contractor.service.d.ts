import type { UpdateContractorProfileInput } from '../schemas/contractor.schemas';
export interface ListContractorsQuery {
    page?: number;
    limit?: number;
    specialty?: string;
    state?: string;
    city?: string;
    minRating?: number;
    available?: boolean;
    search?: string;
}
export declare function listContractors(query: ListContractorsQuery): Promise<{
    contractors: {
        user: {
            firstName: string;
            lastName: string;
        };
        id: string;
        createdAt: Date;
        bio: string | null;
        yearsExperience: number;
        specialties: string[];
        isLicenseVerified: boolean;
        hourlyRateMin: number | null;
        hourlyRateMax: number | null;
        city: string | null;
        state: string | null;
        zipCode: string | null;
        averageRating: number;
        totalReviews: number;
        completedJobs: number;
        isAvailable: boolean;
    }[];
    total: number;
    page: number;
    totalPages: number;
}>;
export declare function getContractorById(id: string): Promise<{
    user: {
        email: string;
        firstName: string;
        lastName: string;
    };
    id: string;
    createdAt: Date;
    updatedAt: Date;
    bio: string | null;
    yearsExperience: number;
    specialties: string[];
    licenseNumber: string | null;
    licenseState: string | null;
    isLicenseVerified: boolean;
    insuranceExpiry: Date | null;
    hourlyRateMin: number | null;
    hourlyRateMax: number | null;
    portfolioImages: string[];
    city: string | null;
    state: string | null;
    zipCode: string | null;
    averageRating: number;
    totalReviews: number;
    completedJobs: number;
    isAvailable: boolean;
}>;
export declare function updateMyProfile(userId: string, input: UpdateContractorProfileInput): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    bio: string | null;
    yearsExperience: number;
    specialties: string[];
    licenseNumber: string | null;
    licenseState: string | null;
    isLicenseVerified: boolean;
    insuranceExpiry: Date | null;
    hourlyRateMin: number | null;
    hourlyRateMax: number | null;
    portfolioImages: string[];
    city: string | null;
    state: string | null;
    zipCode: string | null;
    averageRating: number;
    totalReviews: number;
    completedJobs: number;
    isAvailable: boolean;
    userId: string;
}>;
//# sourceMappingURL=contractor.service.d.ts.map