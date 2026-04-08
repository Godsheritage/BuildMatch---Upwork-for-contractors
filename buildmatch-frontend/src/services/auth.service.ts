import api from './api';
import type { User, UserRole } from '../types/user.types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Exclude<UserRole, 'ADMIN'>;
}

export interface AuthData {
  user: User;
  token: string;
}

export async function login(payload: LoginPayload): Promise<AuthData> {
  const { data: res } = await api.post<ApiResponse<AuthData>>('/auth/login', payload);
  return res.data;
}

export async function register(payload: RegisterPayload): Promise<AuthData> {
  const { data: res } = await api.post<ApiResponse<AuthData>>('/auth/register', payload);
  return res.data;
}

export interface GoogleAuthData extends AuthData {
  isNewUser: boolean;
}

export interface GoogleAuthExtras {
  firstName?: string;
  lastName?:  string;
  phone?:     string;
}

export async function googleAuth(
  idToken: string,
  role?:   'INVESTOR' | 'CONTRACTOR',
  extras?: GoogleAuthExtras,
): Promise<GoogleAuthData> {
  const { data: res } = await api.post<ApiResponse<GoogleAuthData>>('/auth/google', {
    idToken,
    role,
    ...(extras ?? {}),
  });
  return res.data;
}

export async function linkGoogleAccount(idToken: string): Promise<User> {
  const { data: res } = await api.post<ApiResponse<User>>('/auth/google/link', { idToken });
  return res.data;
}

export async function unlinkGoogleAccount(): Promise<User> {
  const { data: res } = await api.post<ApiResponse<User>>('/auth/google/unlink', {});
  return res.data;
}

export async function getMe(): Promise<User> {
  const { data: res } = await api.get<ApiResponse<User>>('/auth/me');
  return res.data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export interface VerifyResetTokenResult { email: string }

export async function verifyResetToken(token: string): Promise<VerifyResetTokenResult> {
  const { data: res } = await api.get<ApiResponse<VerifyResetTokenResult>>(
    '/auth/reset-password/verify',
    { params: { token } },
  );
  return res.data;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?:  string;
  phone?:     string | null;
  bio?:       string | null;
  city?:      string | null;
  state?:     string | null;
  company?:   string | null;
  title?:     string | null;
  website?:   string | null;
  displayName?:     string | null;
  pronouns?:        string | null;
  timezone?:        string | null;
  locale?:          string | null;
  dateFormat?:      'MDY' | 'DMY' | 'YMD' | 'LONG' | null;
  numberFormat?:    'EN' | 'EU' | null;
  quietHoursStart?: string | null;
  quietHoursEnd?:   string | null;
}

export async function updateUserProfile(payload: UpdateProfilePayload): Promise<User> {
  const { data: res } = await api.put<ApiResponse<User>>('/users/me', payload);
  return res.data;
}
