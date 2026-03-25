import prisma from '../lib/prisma';
import type { CreateJobInput } from '../schemas/job.schemas';

export async function getAllJobs() {
  return prisma.job.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getJobById(id: string) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new Error('Job not found');
  return job;
}

export async function createJob(investorId: string, input: CreateJobInput) {
  return prisma.job.create({ data: { ...input, investorId } });
}
