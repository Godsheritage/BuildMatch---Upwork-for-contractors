export type UserRole = 'client' | 'contractor' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
}
