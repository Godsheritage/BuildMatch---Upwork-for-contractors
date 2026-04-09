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
  displayName: string | null;
  pronouns: string | null;
  timezone: string | null;
  locale: string | null;
  dateFormat: 'MDY' | 'DMY' | 'YMD' | 'LONG' | null;
  numberFormat: 'EN' | 'EU' | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  profilePublic: boolean | null;
  projectPreference: 'SHORT' | 'LONG' | 'BOTH' | null;
  aiPreference: 'FULL' | 'LIMITED' | 'NONE' | null;
  googleId: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  idVerificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  idDocumentUrl: string | null;
  idVerifiedAt: string | null;
  idVerificationNote: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
