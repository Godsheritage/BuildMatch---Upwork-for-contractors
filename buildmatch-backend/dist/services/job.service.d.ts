import type { CreateJobInput, UpdateJobInput, CreateBidInput } from '../schemas/job.schemas';
export interface ListJobsParams {
    page?: number;
    limit?: number;
    tradeType?: string;
    state?: string;
    city?: string;
    minBudget?: number;
    maxBudget?: number;
    status?: string;
    search?: string;
}
export declare function createJob(investorId: string, input: CreateJobInput): Promise<{
    investor: {
        firstName: string;
        lastName: string;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    city: string;
    state: string;
    zipCode: string;
    title: string;
    description: string;
    tradeType: import(".prisma/client").$Enums.TradeType;
    budgetMin: number;
    budgetMax: number;
    status: import(".prisma/client").$Enums.JobStatus;
    investorId: string;
}>;
export declare function listJobs(params: ListJobsParams): Promise<{
    jobs: {
        bidCount: number;
        investor: {
            firstName: string;
            lastName: string;
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        city: string;
        state: string;
        zipCode: string;
        title: string;
        description: string;
        tradeType: import(".prisma/client").$Enums.TradeType;
        budgetMin: number;
        budgetMax: number;
        status: import(".prisma/client").$Enums.JobStatus;
        investorId: string;
    }[];
    total: number;
    page: number;
    totalPages: number;
}>;
export declare function getJobById(id: string, requesterId?: string): Promise<{
    bidCount: number;
    hasBid: boolean;
    investor: {
        firstName: string;
        lastName: string;
    };
    id: string;
    createdAt: Date;
    updatedAt: Date;
    city: string;
    state: string;
    zipCode: string;
    title: string;
    description: string;
    tradeType: import(".prisma/client").$Enums.TradeType;
    budgetMin: number;
    budgetMax: number;
    status: import(".prisma/client").$Enums.JobStatus;
    investorId: string;
}>;
export declare function updateJob(id: string, investorId: string, input: UpdateJobInput): Promise<{
    investor: {
        firstName: string;
        lastName: string;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    city: string;
    state: string;
    zipCode: string;
    title: string;
    description: string;
    tradeType: import(".prisma/client").$Enums.TradeType;
    budgetMin: number;
    budgetMax: number;
    status: import(".prisma/client").$Enums.JobStatus;
    investorId: string;
}>;
export declare function cancelJob(id: string, investorId: string): Promise<{
    investor: {
        firstName: string;
        lastName: string;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    city: string;
    state: string;
    zipCode: string;
    title: string;
    description: string;
    tradeType: import(".prisma/client").$Enums.TradeType;
    budgetMin: number;
    budgetMax: number;
    status: import(".prisma/client").$Enums.JobStatus;
    investorId: string;
}>;
export declare function getMyJobs(investorId: string): Promise<{
    bidCount: number;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    city: string;
    state: string;
    zipCode: string;
    title: string;
    description: string;
    tradeType: import(".prisma/client").$Enums.TradeType;
    budgetMin: number;
    budgetMax: number;
    status: import(".prisma/client").$Enums.JobStatus;
    investorId: string;
}[]>;
export declare function createBid(jobId: string, contractorId: string, input: CreateBidInput): Promise<{
    message: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    amount: number;
    status: import(".prisma/client").$Enums.BidStatus;
    jobId: string;
    contractorId: string;
}>;
export declare function getJobBids(jobId: string, requesterId: string, requesterRole: string): Promise<{
    contractor: {
        user: {
            firstName: string;
            lastName: string;
        };
        yearsExperience: number;
        specialties: string[];
        city: string | null;
        state: string | null;
        averageRating: number;
        totalReviews: number;
        isAvailable: boolean;
        userId: string;
    } | null;
    message: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    amount: number;
    status: import(".prisma/client").$Enums.BidStatus;
    jobId: string;
    contractorId: string;
}[]>;
export declare function getMyBid(jobId: string, contractorId: string): Promise<{
    message: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    amount: number;
    status: import(".prisma/client").$Enums.BidStatus;
    jobId: string;
    contractorId: string;
}>;
export declare function acceptBid(jobId: string, bidId: string, investorId: string): Promise<{
    message: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    amount: number;
    status: import(".prisma/client").$Enums.BidStatus;
    jobId: string;
    contractorId: string;
}>;
export declare function withdrawBid(jobId: string, bidId: string, contractorId: string): Promise<{
    message: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    amount: number;
    status: import(".prisma/client").$Enums.BidStatus;
    jobId: string;
    contractorId: string;
}>;
//# sourceMappingURL=job.service.d.ts.map