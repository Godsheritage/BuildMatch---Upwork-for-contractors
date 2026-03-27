export type UserRole = 'INVESTOR' | 'CONTRACTOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
