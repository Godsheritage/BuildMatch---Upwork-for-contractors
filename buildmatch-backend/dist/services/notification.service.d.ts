export interface Notification {
    id: string;
    type: 'bid_received' | 'bid_accepted' | 'bid_rejected' | 'bid_withdrawn' | 'job_awarded' | 'job_cancelled' | 'job_completed';
    message: string;
    jobTitle: string;
    jobId: string;
    createdAt: string;
    read: boolean;
}
export declare function getNotificationsForUser(userId: string, role: string): Promise<Notification[]>;
//# sourceMappingURL=notification.service.d.ts.map