import prisma from '../lib/prisma';

// ── Categories ───────────────────────────────────────────────────────────────
// Add new categories here as new notification types ship.
export type NotifCategory =
  | 'messages'
  | 'bidActivity'
  | 'jobUpdates'
  | 'disputeUpdates'
  | 'drawUpdates';

export interface NotifPreferences {
  messages:        boolean;
  bidActivity:     boolean;
  jobUpdates:      boolean;
  disputeUpdates:  boolean;
  drawUpdates:     boolean;
}

const COL_BY_CATEGORY: Record<NotifCategory, keyof NotifPreferences> = {
  messages:       'messages',
  bidActivity:    'bidActivity',
  jobUpdates:     'jobUpdates',
  disputeUpdates: 'disputeUpdates',
  drawUpdates:    'drawUpdates',
};
void COL_BY_CATEGORY; // referenced via destructuring below

const SELECT = {
  notifMessages:       true,
  notifBidActivity:    true,
  notifJobUpdates:     true,
  notifDisputeUpdates: true,
  notifDrawUpdates:    true,
} as const;

function rowToPrefs(row: {
  notifMessages: boolean; notifBidActivity: boolean; notifJobUpdates: boolean;
  notifDisputeUpdates: boolean; notifDrawUpdates: boolean;
}): NotifPreferences {
  return {
    messages:       row.notifMessages,
    bidActivity:    row.notifBidActivity,
    jobUpdates:     row.notifJobUpdates,
    disputeUpdates: row.notifDisputeUpdates,
    drawUpdates:    row.notifDrawUpdates,
  };
}

export async function getPreferences(userId: string): Promise<NotifPreferences> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: SELECT });
  if (!row) {
    return { messages: true, bidActivity: true, jobUpdates: true, disputeUpdates: true, drawUpdates: true };
  }
  return rowToPrefs(row);
}

export async function updatePreferences(
  userId: string,
  patch:  Partial<NotifPreferences>,
): Promise<NotifPreferences> {
  const data: Record<string, boolean> = {};
  if (typeof patch.messages       === 'boolean') data.notifMessages       = patch.messages;
  if (typeof patch.bidActivity    === 'boolean') data.notifBidActivity    = patch.bidActivity;
  if (typeof patch.jobUpdates     === 'boolean') data.notifJobUpdates     = patch.jobUpdates;
  if (typeof patch.disputeUpdates === 'boolean') data.notifDisputeUpdates = patch.disputeUpdates;
  if (typeof patch.drawUpdates    === 'boolean') data.notifDrawUpdates    = patch.drawUpdates;
  const row = await prisma.user.update({ where: { id: userId }, data, select: SELECT });
  return rowToPrefs(row);
}

/**
 * Returns true if the user has opted in to receiving the given notification
 * category. Used by every email-sending notification call site as a guard.
 *
 * Fail-safe: if the user can't be loaded for any reason, returns true so a
 * transient DB blip doesn't suppress every notification.
 */
export async function isOptedIn(userId: string, category: NotifCategory): Promise<boolean> {
  try {
    const prefs = await getPreferences(userId);
    return prefs[category];
  } catch {
    return true;
  }
}
