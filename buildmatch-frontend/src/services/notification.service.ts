import api from './api';

export interface Notification {
  id:        string;
  type:      'bid_received' | 'bid_accepted' | 'bid_rejected' | 'bid_withdrawn' | 'job_awarded' | 'job_cancelled' | 'job_completed';
  message:   string;
  jobTitle:  string;
  jobId:     string;
  createdAt: string;
  read:      boolean;
}

interface NotificationResponse {
  success: boolean;
  data: { notifications: Notification[] };
}

export async function getNotifications(): Promise<Notification[]> {
  const { data: res } = await api.get<NotificationResponse>('/notifications');
  return res.data.notifications;
}
