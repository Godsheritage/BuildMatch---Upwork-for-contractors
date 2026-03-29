import prisma from '../../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../utils/app-error';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminContractorListItem {
  profileId:         string;
  userId:            string;
  firstName:         string;
  lastName:          string;
  email:             string;
  city:              string | null;
  state:             string | null;
  specialties:       string[];
  averageRating:     number;
  completedJobs:     number;
  isAvailable:       boolean;
  isLicenseVerified: boolean;
  reliabilityScore:  number;
  createdAt:         string;
}

export interface AdminContractorPage {
  data:       AdminContractorListItem[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

// ── listContractors ───────────────────────────────────────────────────────────

export async function listContractors(params: {
  page:                number;
  limit:               number;
  search?:             string;
  state?:              string;
  isLicenseVerified?:  boolean;
  isAvailable?:        boolean;
}): Promise<AdminContractorPage> {
  const { page, limit, search, state, isLicenseVerified, isAvailable } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.ContractorProfileWhereInput = {};

  if (state)                 where.state             = state;
  if (isLicenseVerified != null) where.isLicenseVerified = isLicenseVerified;
  if (isAvailable != null)   where.isAvailable        = isAvailable;

  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [total, profiles] = await Promise.all([
    prisma.contractorProfile.count({ where }),
    prisma.contractorProfile.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, city: true, state: true, specialties: true,
        averageRating: true, completedJobs: true, isAvailable: true,
        isLicenseVerified: true, reliabilityScore: true, createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
  ]);

  return {
    data: profiles.map((p) => ({
      profileId:         p.id,
      userId:            p.user.id,
      firstName:         p.user.firstName,
      lastName:          p.user.lastName,
      email:             p.user.email,
      city:              p.city,
      state:             p.state,
      specialties:       p.specialties,
      averageRating:     p.averageRating,
      completedJobs:     p.completedJobs,
      isAvailable:       p.isAvailable,
      isLicenseVerified: p.isLicenseVerified,
      reliabilityScore:  p.reliabilityScore,
      createdAt:         p.createdAt.toISOString(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}

// ── setLicenseVerified ────────────────────────────────────────────────────────

export async function setLicenseVerified(
  profileId: string,
  verified:  boolean,
): Promise<{ licenseNumber: string | null; licenseState: string | null }> {
  const profile = await prisma.contractorProfile.findUnique({
    where:  { id: profileId },
    select: { id: true, licenseNumber: true, licenseState: true },
  });
  if (!profile) throw new AppError('Contractor profile not found', 404);

  await prisma.contractorProfile.update({
    where: { id: profileId },
    data:  { isLicenseVerified: verified },
  });

  return { licenseNumber: profile.licenseNumber, licenseState: profile.licenseState };
}

// ── setAvailability ────────────────────────────────────────────────────────────

export async function setAvailability(
  profileId:   string,
  isAvailable: boolean,
): Promise<void> {
  const profile = await prisma.contractorProfile.findUnique({
    where:  { id: profileId },
    select: { id: true },
  });
  if (!profile) throw new AppError('Contractor profile not found', 404);

  await prisma.contractorProfile.update({
    where: { id: profileId },
    data:  { isAvailable },
  });
}
