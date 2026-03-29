import prisma from '../../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../utils/app-error';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminUserListItem {
  id:         string;
  email:      string;
  firstName:  string;
  lastName:   string;
  role:       string;
  isActive:   boolean;
  isVerified: boolean;
  createdAt:  string;
  jobCount:   number;
}

export interface AdminUserDetail extends AdminUserListItem {
  phone:    string | null;
  city:     string | null;
  state:    string | null;
  company:  string | null;
  avatarUrl: string | null;
  contractor: {
    id:               string;
    specialties:      string[];
    averageRating:    number;
    completedJobs:    number;
    isLicenseVerified: boolean;
    isAvailable:      boolean;
  } | null;
  recentJobs: { id: string; title: string; status: string; createdAt: string }[];
}

export interface AdminUserPage {
  data:       AdminUserListItem[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

// ── listUsers ─────────────────────────────────────────────────────────────────

export async function listUsers(params: {
  page:      number;
  limit:     number;
  search?:   string;
  role?:     string;
  isActive?: boolean;
}): Promise<AdminUserPage> {
  const { page, limit, search, role, isActive } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { email:     { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role)            where.role     = role as 'INVESTOR' | 'CONTRACTOR' | 'ADMIN';
  if (isActive != null) where.isActive = isActive;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, isVerified: true, createdAt: true,
        _count: { select: { postedJobs: true } },
      },
    }),
  ]);

  return {
    data: users.map((u) => ({
      id:         u.id,
      email:      u.email,
      firstName:  u.firstName,
      lastName:   u.lastName,
      role:       u.role,
      isActive:   u.isActive,
      isVerified: u.isVerified,
      createdAt:  u.createdAt.toISOString(),
      jobCount:   u._count.postedJobs,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}

// ── getUserDetail ─────────────────────────────────────────────────────────────

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isActive: true, isVerified: true, createdAt: true,
      phone: true, city: true, state: true, company: true, avatarUrl: true,
      _count: { select: { postedJobs: true } },
      contractor: {
        select: {
          id: true, specialties: true, averageRating: true,
          completedJobs: true, isLicenseVerified: true, isAvailable: true,
        },
      },
      postedJobs: {
        take:    5,
        orderBy: { createdAt: 'desc' },
        select:  { id: true, title: true, status: true, createdAt: true },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);

  return {
    id:         user.id,
    email:      user.email,
    firstName:  user.firstName,
    lastName:   user.lastName,
    role:       user.role,
    isActive:   user.isActive,
    isVerified: user.isVerified,
    createdAt:  user.createdAt.toISOString(),
    jobCount:   user._count.postedJobs,
    phone:      user.phone,
    city:       user.city,
    state:      user.state,
    company:    user.company,
    avatarUrl:  user.avatarUrl,
    contractor: user.contractor
      ? {
          id:                user.contractor.id,
          specialties:       user.contractor.specialties,
          averageRating:     user.contractor.averageRating,
          completedJobs:     user.contractor.completedJobs,
          isLicenseVerified: user.contractor.isLicenseVerified,
          isAvailable:       user.contractor.isAvailable,
        }
      : null,
    recentJobs: user.postedJobs.map((j) => ({
      id:        j.id,
      title:     j.title,
      status:    j.status,
      createdAt: j.createdAt.toISOString(),
    })),
  };
}

// ── banUser / unbanUser ───────────────────────────────────────────────────────

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'ADMIN') throw new AppError('Cannot ban another admin', 403);

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
}

// ── changeUserRole ─────────────────────────────────────────────────────────────

export async function changeUserRole(
  userId:  string,
  newRole: string,
  adminId: string,
): Promise<{ previousRole: string }> {
  if (!['INVESTOR', 'CONTRACTOR'].includes(newRole)) {
    throw new AppError('Role must be INVESTOR or CONTRACTOR', 400);
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, role: true },
  });
  if (!user) throw new AppError('User not found', 404);
  if (user.id === adminId) throw new AppError('Cannot change your own role', 403);
  if (user.role === 'ADMIN') throw new AppError('Cannot change the role of another admin', 403);

  const previousRole = user.role;
  await prisma.user.update({
    where: { id: userId },
    data:  { role: newRole as 'INVESTOR' | 'CONTRACTOR' },
  });

  return { previousRole };
}
