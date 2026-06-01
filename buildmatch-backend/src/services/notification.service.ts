import prisma from '../lib/prisma';
import { getPreferences } from './notification-prefs.service';

const BID_TYPES = new Set(['bid_received', 'bid_accepted', 'bid_rejected', 'bid_withdrawn']);
const JOB_TYPES = new Set(['job_awarded', 'job_cancelled', 'job_completed']);

export interface Notification {
  id:        string;
  type:      'bid_received' | 'bid_accepted' | 'bid_rejected' | 'bid_withdrawn' | 'job_awarded' | 'job_cancelled' | 'job_completed';
  message:   string;
  jobTitle:  string;
  jobId:     string;
  createdAt: string;
  read:      boolean;
}

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

export async function getNotificationsForUser(userId: string, role: string): Promise<Notification[]> {
  const since = THIRTY_DAYS_AGO();
  const notifications: Notification[] = [];

  if (role === 'INVESTOR') {
    // Bids received on the investor's jobs
    const bids = await prisma.bid.findMany({
      where: {
        job: { investorId: userId },
        createdAt: { gte: since },
      },
      include: {
        job: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    for (const bid of bids) {
      if (bid.status === 'PENDING') {
        notifications.push({
          id:        `bid-received-${bid.id}`,
          type:      'bid_received',
          message:   `New bid of $${bid.amount.toLocaleString()} received on "${bid.job.title}"`,
          jobTitle:  bid.job.title,
          jobId:     bid.job.id,
          createdAt: bid.createdAt.toISOString(),
          read:      false,
        });
      }
      if (bid.status === 'WITHDRAWN') {
        notifications.push({
          id:        `bid-withdrawn-${bid.id}`,
          type:      'bid_withdrawn',
          message:   `A contractor withdrew their bid on "${bid.job.title}"`,
          jobTitle:  bid.job.title,
          jobId:     bid.job.id,
          createdAt: bid.updatedAt.toISOString(),
          read:      false,
        });
      }
    }

    // Investor's jobs that were awarded (accepted a bid)
    const awardedJobs = await prisma.job.findMany({
      where: {
        investorId: userId,
        status: { in: ['AWARDED', 'IN_PROGRESS', 'COMPLETED'] },
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    for (const job of awardedJobs) {
      if (job.status === 'COMPLETED') {
        notifications.push({
          id:        `job-completed-${job.id}`,
          type:      'job_completed',
          message:   `Your job "${job.title}" has been marked as completed`,
          jobTitle:  job.title,
          jobId:     job.id,
          createdAt: job.updatedAt.toISOString(),
          read:      true,
        });
      } else if (job.status === 'AWARDED') {
        notifications.push({
          id:        `job-awarded-${job.id}`,
          type:      'job_awarded',
          message:   `You awarded the job "${job.title}" to a contractor`,
          jobTitle:  job.title,
          jobId:     job.id,
          createdAt: job.updatedAt.toISOString(),
          read:      true,
        });
      }
    }
  }

  if (role === 'CONTRACTOR') {
    // Bid status changes for the contractor
    const bids = await prisma.bid.findMany({
      where: {
        contractorId: userId,
        updatedAt: { gte: since },
      },
      include: {
        job: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });

    for (const bid of bids) {
      if (bid.status === 'ACCEPTED') {
        notifications.push({
          id:        `bid-accepted-${bid.id}`,
          type:      'bid_accepted',
          message:   `Your bid of $${bid.amount.toLocaleString()} on "${bid.job.title}" was accepted! 🎉`,
          jobTitle:  bid.job.title,
          jobId:     bid.job.id,
          createdAt: bid.updatedAt.toISOString(),
          read:      false,
        });
      } else if (bid.status === 'REJECTED') {
        notifications.push({
          id:        `bid-rejected-${bid.id}`,
          type:      'bid_rejected',
          message:   `Your bid on "${bid.job.title}" was not selected`,
          jobTitle:  bid.job.title,
          jobId:     bid.job.id,
          createdAt: bid.updatedAt.toISOString(),
          read:      false,
        });
      } else if (bid.status === 'PENDING') {
        notifications.push({
          id:        `bid-pending-${bid.id}`,
          type:      'bid_received',
          message:   `Your bid of $${bid.amount.toLocaleString()} on "${bid.job.title}" is under review`,
          jobTitle:  bid.job.title,
          jobId:     bid.job.id,
          createdAt: bid.createdAt.toISOString(),
          read:      true,
        });
      }
    }
  }

  // Apply user notification preferences — drop categories the user has opted out of.
  const prefs = await getPreferences(userId);
  const filtered = notifications.filter((n) => {
    if (BID_TYPES.has(n.type)) return prefs.bidActivity;
    if (JOB_TYPES.has(n.type)) return prefs.jobUpdates;
    return true;
  });

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return filtered.slice(0, 20);
}
