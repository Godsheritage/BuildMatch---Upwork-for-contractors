import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';

const SENDER_SELECT = {
  select: { firstName: true, lastName: true, role: true },
} as const;

/** Verify caller is the investor or an accepted contractor on the job. */
async function assertAccess(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({
    where:   { id: jobId },
    include: { bids: { where: { contractorId: userId, status: { in: ['ACCEPTED', 'PENDING'] } } } },
  });
  if (!job) throw new AppError('Job not found', 404);

  const isInvestor   = job.investorId === userId;
  const isContractor = job.bids.length > 0;
  if (!isInvestor && !isContractor) throw new AppError('Forbidden', 403);

  return job;
}

export async function createMessage(
  jobId:        string,
  senderId:     string,
  body:         string,
  isAiGenerated = false,
) {
  await assertAccess(jobId, senderId);

  return prisma.message.create({
    data:    { jobId, senderId, body, isAiGenerated },
    include: { sender: SENDER_SELECT },
  });
}

export async function getJobMessages(jobId: string, requesterId: string) {
  await assertAccess(jobId, requesterId);

  return prisma.message.findMany({
    where:   { jobId },
    orderBy: { createdAt: 'asc' },
    include: { sender: SENDER_SELECT },
  });
}
