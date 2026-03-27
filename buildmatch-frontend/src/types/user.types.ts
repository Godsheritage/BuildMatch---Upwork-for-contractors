export type UserRole = 'INVESTOR' | 'CONTRACTOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  company: string | null;
  title: string | null;
  website: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
