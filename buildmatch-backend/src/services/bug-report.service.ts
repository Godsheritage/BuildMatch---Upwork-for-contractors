import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';
import type { SubmitBugReportInput, UpdateBugReportInput } from '../schemas/bug-report.schemas';

export async function createBugReport(
  input:     SubmitBugReportInput,
  userId:    string | null,
  ipAddress: string | null,
) {
  return prisma.bugReport.create({
    data: {
      title:           input.title,
      description:     input.description,
      severity:        input.severity,
      pageUrl:         input.pageUrl       ?? null,
      userAgent:       input.userAgent     ?? null,
      screenshotUrls:  input.screenshotUrls,
      reportingUserId: userId,
      ipAddress:       userId ? null : ipAddress,
    },
    select: { id: true },
  });
}

const LIST_SELECT = {
  id: true, title: true, description: true, severity: true, status: true,
  screenshotUrls: true, pageUrl: true, userAgent: true,
  reportingUserId: true, ipAddress: true, adminNote: true,
  resolvedAt: true, createdAt: true, updatedAt: true,
  reportingUser: {
    select: { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true },
  },
} as const;

export async function listBugReports(params: {
  status?: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX';
  page:    number;
  limit:   number;
}) {
  const { status, page, limit } = params;
  const where = status ? { status } : {};
  const [total, data] = await Promise.all([
    prisma.bugReport.count({ where }),
    prisma.bugReport.findMany({
      where,
      select:  LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getNewCount(): Promise<number> {
  return prisma.bugReport.count({ where: { status: 'NEW' } });
}

export async function getBugReport(id: string) {
  const row = await prisma.bugReport.findUnique({ where: { id }, select: LIST_SELECT });
  if (!row) throw new AppError('Bug report not found', 404);
  return row;
}

export async function updateBugReport(id: string, patch: UpdateBugReportInput) {
  const existing = await prisma.bugReport.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new AppError('Bug report not found', 404);

  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    data.status = patch.status;
    data.resolvedAt = patch.status === 'RESOLVED' ? new Date() : null;
  }
  if (patch.adminNote !== undefined) data.adminNote = patch.adminNote;

  return prisma.bugReport.update({ where: { id }, data, select: LIST_SELECT });
}
