import api from './api';
import type { User, AuthTokens } from '../types/user.types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: 'client' | 'contractor';
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: User;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}
