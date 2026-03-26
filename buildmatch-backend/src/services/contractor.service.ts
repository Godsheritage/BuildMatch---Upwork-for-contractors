import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';
import type { UpdateContractorProfileInput } from '../schemas/contractor.schemas';

// Fields returned on list queries
const LIST_SELECT = {
  id: true,
  bio: true,
  yearsExperience: true,
  specialties: true,
  city: true,
  state: true,
  zipCode: true,
  hourlyRateMin: true,
  hourlyRateMax: true,
  averageRating: true,
  totalReviews: true,
  completedJobs: true,
  avatarUrl: true,
  isAvailable: true,
  isLicenseVerified: true,
  createdAt: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ContractorProfileSelect;

// Full fields for single-contractor detail view
const DETAIL_SELECT = {
  ...LIST_SELECT,
  licenseNumber: true,
  licenseState: true,
  insuranceExpiry: true,
  avatarUrl: true,
  portfolioImages: true,
  updatedAt: true,
  user: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.ContractorProfileSelect;

export interface ListContractorsQuery {
  page?: number;
  limit?: number;
  specialty?: string;
  state?: string;
  city?: string;
  minRating?: number;
  available?: boolean;
  search?: string;
}

export async function listContractors(query: ListContractorsQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, Math.max(1, query.limit ?? 12));
  const skip = (page - 1) * limit;

  const where: Prisma.ContractorProfileWhereInput = {};

  if (query.state) {
    where.state = { equals: query.state.toUpperCase() };
  }

  if (query.city) {
    where.city = { contains: query.city, mode: 'insensitive' };
  }

  if (query.minRating !== undefined) {
    where.averageRating = { gte: query.minRating };
  }

  if (query.available !== undefined) {
    where.isAvailable = query.available;
  }

  // specialty: has-match on the String[] column.
  // Note: Prisma does not support case-insensitive contains on array elements
  // without raw SQL, so this is an exact-match filter.
  if (query.specialty) {
    where.specialties = { has: query.specialty };
  }

  // search: bio contains OR specialties array has the term
  if (query.search) {
    const term = query.search;
    where.OR = [
      { bio: { contains: term, mode: 'insensitive' } },
      { specialties: { has: term } },
    ];
  }

  const [contractors, total] = await Promise.all([
    prisma.contractorProfile.findMany({
      where,
      select: LIST_SELECT,
      skip,
      take: limit,
      orderBy: [{ averageRating: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.contractorProfile.count({ where }),
  ]);

  return {
    contractors,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getContractorById(id: string) {
  const contractor = await prisma.contractorProfile.findUnique({
    where: { id },
    select: DETAIL_SELECT,
  });
  if (!contractor) throw new AppError('Contractor not found', 404);
  return contractor;
}

export async function getMyProfile(userId: string) {
  const contractor = await prisma.contractorProfile.findUnique({
    where: { userId },
    select: DETAIL_SELECT,
  });
  if (!contractor) throw new AppError('Contractor profile not found', 404);
  return contractor;
}

export async function updateMyProfile(userId: string, input: UpdateContractorProfileInput) {
  const existing = await prisma.contractorProfile.findUnique({ where: { userId } });
  if (!existing) throw new AppError('Contractor profile not found', 404);

  return prisma.contractorProfile.update({
    where: { userId },
    data: input,
  });
}
