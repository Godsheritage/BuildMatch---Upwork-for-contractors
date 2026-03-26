import api from './api';

export interface ConnectStatus {
  isOnboarded:      boolean;
  chargesEnabled:   boolean;
  payoutsEnabled:   boolean;
  detailsSubmitted: boolean;
}

interface ApiResponse<T> { success: boolean; data: T; }

export async function getConnectStatus(): Promise<ConnectStatus> {
  const { data: res } = await api.get<ApiResponse<ConnectStatus>>('/stripe/connect/status');
  return res.data;
}

export async function createOnboardingLink(): Promise<string> {
  const { data: res } = await api.post<ApiResponse<{ url: string }>>('/stripe/connect/onboard');
  return res.data.url;
}
