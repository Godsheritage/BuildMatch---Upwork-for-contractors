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

export async function getMe(): Promise<User> {
  const { data: res } = await api.get<ApiResponse<User>>('/auth/me');
  return res.data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}
