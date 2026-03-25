import prisma from '../lib/prisma';
import type { ContractorProfileInput } from '../schemas/contractor.schemas';

export async function getAllContractors() {
  return prisma.contractorProfile.findMany({
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
}

export async function getContractorById(id: string) {
  const contractor = await prisma.contractorProfile.findUnique({
    where: { id },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
  if (!contractor) throw new Error('Contractor not found');
  return contractor;
}

export async function upsertContractorProfile(userId: string, input: ContractorProfileInput) {
  return prisma.contractorProfile.upsert({
    where: { userId },
    update: input,
    create: { ...input, userId, specialties: [], portfolioImages: [] },
  });
}
