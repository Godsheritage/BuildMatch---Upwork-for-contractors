import prisma from '../lib/prisma';

// Fields returned on every user response — never include password
const USER_SELECT = {
  id:        true,
  email:     true,
  role:      true,
  firstName: true,
  lastName:  true,
  phone:     true,
  avatarUrl: true,
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
