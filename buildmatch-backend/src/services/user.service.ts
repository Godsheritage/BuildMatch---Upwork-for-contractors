import prisma from '../lib/prisma';

// Fields returned on every user response — never include password
export const USER_SELECT = {
  id:        true,
  email:     true,
  role:      true,
  firstName: true,
  lastName:  true,
  phone:     true,
  avatarUrl: true,
  bio:       true,
  city:      true,
  state:     true,
  company:   true,
  title:     true,
  website:   true,
  displayName:     true,
  pronouns:        true,
  timezone:        true,
  locale:          true,
  dateFormat:      true,
  numberFormat:    true,
  quietHoursStart: true,
  quietHoursEnd:   true,
  isVerified: true,
  isActive:   true,
  createdAt:  true,
  updatedAt:  true,
} as const;

export async function setAvatarUrl(userId: string, avatarUrl: string) {
  return prisma.user.update({
    where:  { id: userId },
    data:   { avatarUrl },
    select: USER_SELECT,
  });
}

export async function clearAvatarUrl(userId: string) {
  return prisma.user.update({
    where:  { id: userId },
    data:   { avatarUrl: null },
    select: USER_SELECT,
  });
}

export interface UpdateProfileInput {
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
  dateFormat?:      string | null;
  numberFormat?:    string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?:   string | null;
}

export async function updateUserProfile(userId: string, data: UpdateProfileInput) {
  return prisma.user.update({
    where:  { id: userId },
    data,
    select: USER_SELECT,
  });
}
