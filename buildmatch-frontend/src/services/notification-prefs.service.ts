import api from './api';

export interface NotifPreferences {
  messages:        boolean;
  bidActivity:     boolean;
  jobUpdates:      boolean;
  disputeUpdates:  boolean;
  drawUpdates:     boolean;
}

interface ApiResp<T> { success: boolean; data: T; message?: string }

export async function getPreferences(): Promise<NotifPreferences> {
  const { data } = await api.get<ApiResp<NotifPreferences>>('/users/me/notification-preferences');
  return data.data;
}

export async function updatePreferences(patch: Partial<NotifPreferences>): Promise<NotifPreferences> {
  const { data } = await api.put<ApiResp<NotifPreferences>>('/users/me/notification-preferences', patch);
  return data.data;
}
