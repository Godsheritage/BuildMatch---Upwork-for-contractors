import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';
import type { UpdateContractorProfileInput } from '../schemas/contractor.schemas';
import { parseSearchIntent, type SearchIntent } from './ai/search-intent.service';

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

// ── AI-powered search intent parsing ─────────────────────────────────────────

async function applySmartSearch(
  where: Prisma.ContractorProfileWhereInput,
  raw: string,
): Promise<boolean> {
  try {
    const intent = await parseSearchIntent(raw);
    if (!intent) return false;

    const andClauses: Prisma.ContractorProfileWhereInput[] = [];

    // Apply specialty filter (AND — contractor must have at least one)
    if (intent.specialties.length > 0) {
      andClauses.push({
        OR: intent.specialties.map(s => ({ specialties: { has: s } })),
      });
    }

    // Apply city filter (override if not already set by explicit filter)
    if (intent.city && !where.city) {
      andClauses.push({ city: { contains: intent.city, mode: 'insensitive' } });
    }

    // Apply state filter
    if (intent.state && !where.state) {
      andClauses.push({
        OR: [
          { state: { equals: intent.state.toUpperCase(), mode: 'insensitive' } },
          { state: { contains: intent.state, mode: 'insensitive' } },
        ],
      });
    }

    // Apply rating filter
    if (intent.minRating != null && !where.averageRating) {
      andClauses.push({ averageRating: { gte: intent.minRating } });
    }

    // Apply availability filter
    if (intent.available != null && where.isAvailable === undefined) {
      andClauses.push({ isAvailable: intent.available });
    }

    // Apply keyword search across bio/name
    if (intent.keywords.length > 0) {
      const keywordOr: Prisma.ContractorProfileWhereInput[] = [];
      for (const kw of intent.keywords) {
        keywordOr.push(
          { bio:  { contains: kw, mode: 'insensitive' } },
          { user: { firstName: { contains: kw, mode: 'insensitive' } } },
          { user: { lastName:  { contains: kw, mode: 'insensitive' } } },
        );
      }
      andClauses.push({ OR: keywordOr });
    }

    if (andClauses.length === 0) return false;

    // Merge with existing where using AND
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...andClauses];
    return true;
  } catch {
    return false;
  }
}

// ── Fallback word-based search ───────────────────────────────────────────────

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

function applyWordSearch(
  where: Prisma.ContractorProfileWhereInput,
  raw: string,
): void {
  const words = raw.trim().split(/\s+/).filter(w => w.length >= 3).map(w => w.toLowerCase());
  const matchedSpecialties = [...new Set(
    words.map(w => SPECIALTY_MAP[w]).filter((s): s is string => !!s),
  )];

  const orClauses: Prisma.ContractorProfileWhereInput[] = [];

  for (const word of words) {
    if (SPECIALTY_MAP[word]) continue;
    orClauses.push(
      { bio:   { contains: word, mode: 'insensitive' } },
      { city:  { contains: word, mode: 'insensitive' } },
      { state: { contains: word, mode: 'insensitive' } },
      { user:  { firstName: { contains: word, mode: 'insensitive' } } },
      { user:  { lastName:  { contains: word, mode: 'insensitive' } } },
    );
  }

  for (const spec of matchedSpecialties) {
    orClauses.push({ specialties: { has: spec } });
  }

  if (raw.trim().length >= 3) {
    orClauses.push({ bio: { contains: raw.trim(), mode: 'insensitive' } });
  }

  if (orClauses.length > 0) {
    where.OR = orClauses;
  }
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

  // search: AI-powered intent parsing with word-based fallback
  if (query.search) {
    const searchApplied = await applySmartSearch(where, query.search);
    if (!searchApplied) {
      // Fallback: simple word-based matching
      applyWordSearch(where, query.search);
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
