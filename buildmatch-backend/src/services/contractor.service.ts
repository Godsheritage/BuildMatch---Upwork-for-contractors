import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';
import type { UpdateContractorProfileInput } from '../schemas/contractor.schemas';

// Fields returned on list queries
const LIST_SELECT = {
  id: true,
  userId: true,
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
  reliabilityScore: true,
  createdAt: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ContractorProfileSelect;

// Full fields for single-contractor detail view
const DETAIL_SELECT = {
  ...LIST_SELECT,
  userId: true,
  licenseNumber: true,
  licenseState: true,
  insuranceExpiry: true,
  avatarUrl: true,
  portfolioImages: true,
  portfolioProjects: true,
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

  // search: split into words, match across name/bio/specialties/city/state
  if (query.search) {
    const raw = query.search.trim();
    // Extract words (3+ chars to skip noise like "a", "in", "an")
    const words = raw.split(/\s+/).filter(w => w.length >= 3).map(w => w.toLowerCase());

    // Map common search terms to specialty enum values
    const SPECIALTY_MAP: Record<string, string> = {
      electrical: 'ELECTRICAL', electric: 'ELECTRICAL', wiring: 'ELECTRICAL', rewire: 'ELECTRICAL',
      plumbing: 'PLUMBING', plumber: 'PLUMBING', pipes: 'PLUMBING',
      hvac: 'HVAC', heating: 'HVAC', cooling: 'HVAC', furnace: 'HVAC',
      roofing: 'ROOFING', roof: 'ROOFING', shingles: 'ROOFING',
      flooring: 'FLOORING', floor: 'FLOORING', floors: 'FLOORING', hardwood: 'FLOORING', tile: 'FLOORING',
      painting: 'PAINTING', paint: 'PAINTING', painter: 'PAINTING',
      landscaping: 'LANDSCAPING', landscape: 'LANDSCAPING', lawn: 'LANDSCAPING',
      demolition: 'DEMOLITION', demo: 'DEMOLITION',
      general: 'GENERAL', renovation: 'GENERAL', remodel: 'GENERAL', contractor: 'GENERAL',
    };

    // Detect specialty keywords
    const matchedSpecialties = [...new Set(
      words.map(w => SPECIALTY_MAP[w]).filter((s): s is string => !!s),
    )];

    // Build OR conditions for each word
    const orClauses: Prisma.ContractorProfileWhereInput[] = [];

    for (const word of words) {
      // Skip if it's a known specialty keyword (handled separately)
      if (SPECIALTY_MAP[word]) continue;
      orClauses.push(
        { bio:   { contains: word, mode: 'insensitive' } },
        { city:  { contains: word, mode: 'insensitive' } },
        { state: { contains: word, mode: 'insensitive' } },
        { user:  { firstName: { contains: word, mode: 'insensitive' } } },
        { user:  { lastName:  { contains: word, mode: 'insensitive' } } },
      );
    }

    // Add specialty matches
    for (const spec of matchedSpecialties) {
      orClauses.push({ specialties: { has: spec } });
    }

    // Also try the full raw string against bio (catches multi-word phrases)
    if (raw.length >= 3) {
      orClauses.push({ bio: { contains: raw, mode: 'insensitive' } });
    }

    if (orClauses.length > 0) {
      where.OR = orClauses;
    }
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
