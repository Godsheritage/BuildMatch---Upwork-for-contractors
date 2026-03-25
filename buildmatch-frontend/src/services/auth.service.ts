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

// TODO: remove entire MOCK block before production
const MOCK_TOKEN = '__mock__';
const MOCK_USER: User = {
  id: 'mock-001',
  email: 'test@test.com',
  role: 'INVESTOR',
  firstName: 'Test',
  lastName: 'User',
  phone: null,
  isVerified: true,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export async function login(payload: LoginPayload): Promise<AuthData> {
  // TODO: remove mock auth before production
  if (payload.email === 'test@test.com' && payload.password === 'test') {
    return { user: MOCK_USER, token: MOCK_TOKEN };
  }
  const { data: res } = await api.post<ApiResponse<AuthData>>('/auth/login', payload);
  return res.data;
}

export async function register(payload: RegisterPayload): Promise<AuthData> {
  const { data: res } = await api.post<ApiResponse<AuthData>>('/auth/register', payload);
  return res.data;
}

export async function getMe(): Promise<User> {
  // TODO: remove mock auth before production
  const token = localStorage.getItem('buildmatch_token');
  if (token === MOCK_TOKEN) return MOCK_USER;
  const { data: res } = await api.get<ApiResponse<User>>('/auth/me');
  return res.data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}
