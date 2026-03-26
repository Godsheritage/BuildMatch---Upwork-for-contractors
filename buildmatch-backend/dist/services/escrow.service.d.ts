import type { MilestoneInput } from '../schemas/escrow.schemas';
export declare function fundJob(jobId: string, investorId: string, milestonesInput: MilestoneInput[]): Promise<{
    clientSecret: string;
    escrowPayment: {
        milestones: {
            id: string;
            title: string;
            description: string | null;
            amount: number;
            status: import(".prisma/client").$Enums.MilestoneStatus;
            stripeTransferId: string | null;
            percentage: number;
            order: number;
            disputeReason: string | null;
            completionNotes: string | null;
            approvedAt: Date | null;
            releasedAt: Date | null;
            escrowPaymentId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.PaymentStatus;
        investorId: string;
        jobId: string;
        contractorId: string;
        stripePaymentIntentId: string | null;
        totalAmount: number;
        platformFeeAmount: number;
    };
}>;
export declare function getEscrow(jobId: string, userId: string, role: string): Promise<{
    milestones: {
        id: string;
        title: string;
        description: string | null;
        amount: number;
        status: import(".prisma/client").$Enums.MilestoneStatus;
        stripeTransferId: string | null;
        percentage: number;
        order: number;
        disputeReason: string | null;
        completionNotes: string | null;
        approvedAt: Date | null;
        releasedAt: Date | null;
        escrowPaymentId: string;
    }[];
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: import(".prisma/client").$Enums.PaymentStatus;
    investorId: string;
    jobId: string;
    contractorId: string;
    stripePaymentIntentId: string | null;
    totalAmount: number;
    platformFeeAmount: number;
}>;
export declare function submitMilestone(jobId: string, milestoneId: string, contractorId: string, completionNotes?: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    amount: number;
    status: import(".prisma/client").$Enums.MilestoneStatus;
    stripeTransferId: string | null;
    percentage: number;
    order: number;
    disputeReason: string | null;
    completionNotes: string | null;
    approvedAt: Date | null;
    releasedAt: Date | null;
    escrowPaymentId: string;
}>;
export declare function approveMilestone(jobId: string, milestoneId: string, investorId: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    amount: number;
    status: import(".prisma/client").$Enums.MilestoneStatus;
    stripeTransferId: string | null;
    percentage: number;
    order: number;
    disputeReason: string | null;
    completionNotes: string | null;
    approvedAt: Date | null;
    releasedAt: Date | null;
    escrowPaymentId: string;
}>;
export declare function disputeMilestone(jobId: string, milestoneId: string, investorId: string, reason: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    amount: number;
    status: import(".prisma/client").$Enums.MilestoneStatus;
    stripeTransferId: string | null;
    percentage: number;
    order: number;
    disputeReason: string | null;
    completionNotes: string | null;
    approvedAt: Date | null;
    releasedAt: Date | null;
    escrowPaymentId: string;
}>;
export declare function resolveDispute(jobId: string, milestoneId: string, resolution: 'RELEASE' | 'REFUND'): Promise<{
    id: string;
    title: string;
    description: string | null;
    amount: number;
    status: import(".prisma/client").$Enums.MilestoneStatus;
    stripeTransferId: string | null;
    percentage: number;
    order: number;
    disputeReason: string | null;
    completionNotes: string | null;
    approvedAt: Date | null;
    releasedAt: Date | null;
    escrowPaymentId: string;
}>;
//# sourceMappingURL=escrow.service.d.ts.map