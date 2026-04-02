import api from './api';

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

export interface TestimonialRequestPayload {
  recipientEmail:  string;
  recipientName:   string;
  personalMessage?: string;
}

export interface TestimonialRequestInfo {
  id:              string;
  token:           string;
  recipientName:   string;
  personalMessage?: string;
  status:          'PENDING' | 'SUBMITTED' | 'EXPIRED';
  expiresAt:       string;
  contractorProfile: {
    user: { firstName: string; lastName: string };
  };
}

export interface Testimonial {
  id:         string;
  authorName: string;
  body:       string;
  createdAt:  string;
}

export async function requestTestimonial(
  contractorUserId: string,
  payload: TestimonialRequestPayload,
): Promise<void> {
  await api.post(`/contractors/${contractorUserId}/testimonial-requests`, payload);
}

export async function getTestimonialRequest(token: string): Promise<TestimonialRequestInfo> {
  const { data: res } = await api.get<ApiResponse<TestimonialRequestInfo>>(`/testimonials/${token}`);
  return res.data;
}

export async function submitTestimonial(token: string, body: string): Promise<Testimonial> {
  const { data: res } = await api.post<ApiResponse<Testimonial>>(`/testimonials/${token}`, { body });
  return res.data;
}

export async function getContractorTestimonials(contractorUserId: string): Promise<Testimonial[]> {
  const { data: res } = await api.get<ApiResponse<Testimonial[]>>(`/contractors/${contractorUserId}/testimonials`);
  return res.data;
}
