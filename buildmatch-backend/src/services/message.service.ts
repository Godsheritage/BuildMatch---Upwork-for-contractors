import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { getServiceClient } from '../lib/supabase';
import { filterMessageContent } from '../utils/message-filter';
import { AppError } from '../utils/app-error';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConversationListItem {
  id: string;
  jobId: string;
  jobTitle: string;
  lastMessageAt: Date;
  createdAt: Date;
  unreadCount: number;
  otherUser: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    role: string;
  };
  lastMessage: {
    preview: string;
    createdAt: Date;
    senderId: string;
  } | null;
}

interface RawConversationRow {
  id: string;
  job_id: string;
  job_title: string;
  last_message_at: Date;
  created_at: Date;
  unread_count: bigint | number;
  other_user_id: string;
  other_first_name: string;
  other_last_name: string;
  other_avatar_url: string | null;
  other_role: string;
  last_message_content: string | null;
  last_message_created_at: Date | null;
  last_message_sender_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toListItem(row: RawConversationRow): ConversationListItem {
  return {
    id:            row.id,
    jobId:         row.job_id,
    jobTitle:      row.job_title,
    lastMessageAt: row.last_message_at,
    createdAt:     row.created_at,
    unreadCount:   Number(row.unread_count),
    otherUser: {
      id:        row.other_user_id,
      firstName: row.other_first_name,
      lastName:  row.other_last_name,
      avatarUrl: row.other_avatar_url,
      role:      row.other_role,
    },
    lastMessage: row.last_message_content
      ? {
          preview:   row.last_message_content.slice(0, 60),
          createdAt: row.last_message_created_at!,
          senderId:  row.last_message_sender_id!,
        }
      : null,
  };
}

// Shared SELECT used by both list and single-fetch — keeps shape identical.
const CONV_SELECT = (userId: string) => Prisma.sql`
  SELECT
    c.id,
    c.job_id,
    j.title                                                                AS job_title,
    c.last_message_at,
    c.created_at,
    CASE WHEN c.investor_id = ${userId}
         THEN c.investor_unread_count
         ELSE c.contractor_unread_count END                                AS unread_count,
    ou.id                                                                  AS other_user_id,
    ou."firstName"                                                         AS other_first_name,
    ou."lastName"                                                          AS other_last_name,
    ou."avatarUrl"                                                         AS other_avatar_url,
    ou.role                                                                AS other_role,
    lm.content                                                             AS last_message_content,
    lm.created_at                                                          AS last_message_created_at,
    lm.sender_id                                                           AS last_message_sender_id
  FROM conversations c
  JOIN "Job"  j  ON j.id  = c.job_id
  JOIN "User" ou ON ou.id = CASE
                              WHEN c.investor_id = ${userId} THEN c.contractor_id
                              ELSE c.investor_id
                            END
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id
    FROM   messages
    WHERE  conversation_id = c.id
    ORDER  BY created_at DESC
    LIMIT  1
  ) lm ON true
`;

// ── Conversation services ─────────────────────────────────────────────────────

export async function createOrGetConversation(
  userId:      string,
  role:        string,
  jobId:       string,
  recipientId: string,
): Promise<ConversationListItem> {
  // Verify job exists
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);

  // Verify recipient exists
  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) throw new AppError('Recipient not found', 404);

  // Assign investor / contractor IDs based on the caller's role
  const investorId   = role === 'INVESTOR'   ? userId      : recipientId;
  const contractorId = role === 'CONTRACTOR' ? userId      : recipientId;

  // Access check: investor must own the job; contractor must have bid on it
  if (role === 'INVESTOR') {
    if (job.investorId !== userId) throw new AppError('You do not own this job', 403);
  } else {
    const bid = await prisma.bid.findFirst({ where: { jobId, contractorId: userId } });
    if (!bid) throw new AppError('You have not bid on this job', 403);
  }

  // Upsert — DO UPDATE with a no-op so RETURNING always fires on conflict
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    INSERT INTO conversations (job_id, investor_id, contractor_id)
    VALUES (${jobId}, ${investorId}, ${contractorId})
    ON CONFLICT (job_id, investor_id, contractor_id)
    DO UPDATE SET updated_at = NOW()
    RETURNING id
  `);

  const conversationId = rows[0]?.id;
  if (!conversationId) throw new AppError('Failed to create conversation', 500);

  const item = await getConversationRow(conversationId, userId);
  if (!item) throw new AppError('Conversation not found after upsert', 500);
  return item;
}

export async function listConversations(userId: string): Promise<ConversationListItem[]> {
  const rows = await prisma.$queryRaw<RawConversationRow[]>(Prisma.sql`
    ${CONV_SELECT(userId)}
    WHERE  c.investor_id = ${userId} OR c.contractor_id = ${userId}
    ORDER  BY c.last_message_at DESC
  `);
  return rows.map(toListItem);
}

export async function getConversationById(
  conversationId: string,
  userId: string,
): Promise<ConversationListItem> {
  // Participant check + fetch
  const item = await getConversationRow(conversationId, userId);
  if (!item) throw new AppError('Conversation not found', 404);

  // Mark all unread incoming messages as read
  await prisma.$executeRaw(Prisma.sql`
    UPDATE messages
    SET    read_at = NOW()
    WHERE  conversation_id = ${conversationId}
      AND  sender_id != ${userId}
      AND  read_at IS NULL
  `);

  // Reset caller's unread count column
  const convRows = await prisma.$queryRaw<{ investor_id: string }[]>(Prisma.sql`
    SELECT investor_id FROM conversations WHERE id = ${conversationId}
  `);
  if (!convRows.length) throw new AppError('Conversation not found', 404);

  const isInvestor = convRows[0].investor_id === userId;
  if (isInvestor) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE conversations SET investor_unread_count = 0 WHERE id = ${conversationId}
    `);
  } else {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE conversations SET contractor_unread_count = 0 WHERE id = ${conversationId}
    `);
  }

  // Re-fetch with updated unread count
  return (await getConversationRow(conversationId, userId))!;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COALESCE(SUM(
      CASE WHEN investor_id = ${userId}
           THEN investor_unread_count
           ELSE contractor_unread_count END
    ), 0) AS total
    FROM conversations
    WHERE investor_id = ${userId} OR contractor_id = ${userId}
  `);
  return Number(rows[0]?.total ?? 0);
}

// ── Private ───────────────────────────────────────────────────────────────────

async function getConversationRow(
  conversationId: string,
  userId: string,
): Promise<ConversationListItem | null> {
  const rows = await prisma.$queryRaw<RawConversationRow[]>(Prisma.sql`
    ${CONV_SELECT(userId)}
    WHERE  c.id = ${conversationId}
      AND  (c.investor_id = ${userId} OR c.contractor_id = ${userId})
  `);
  return rows.length ? toListItem(rows[0]) : null;
}

// ── Conversation message services ────────────────────────────────────────────

export interface SentMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isFiltered: boolean;
  filterReason: string | null;
  createdAt: string;
  filterWarning?: string;
}

export interface MessagePage {
  messages: MessageWithSender[];
  nextCursor: string | null; // message id to pass as `before` for next page
  hasMore: boolean;
}

export interface MessageWithSender {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isFiltered: boolean;
  createdAt: string;
  sender: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

const FILTER_WARNING =
  'Some contact information was removed from your message. ' +
  'Sharing contact details outside the platform violates our Terms of Service.';

/** Assert the user is a participant in the conversation; return investor_id. */
async function assertParticipant(conversationId: string, userId: string): Promise<string> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('investor_id, contractor_id')
    .eq('id', conversationId)
    .single();

  if (error || !data) throw new AppError('Conversation not found', 404);

  const { investor_id, contractor_id } = data as { investor_id: string; contractor_id: string };
  if (investor_id !== userId && contractor_id !== userId) {
    throw new AppError('Forbidden', 403);
  }
  return investor_id;
}

export async function sendConversationMessage(
  conversationId: string,
  senderId: string,
  rawContent: string,
): Promise<SentMessage> {
  const supabase = getServiceClient();

  // Participant check
  const investorId = await assertParticipant(conversationId, senderId);

  // Filter content — mandatory, never skip
  const { filteredContent, wasFiltered, filterReasons } = filterMessageContent(rawContent);

  // Insert message
  const { data: msgData, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id:       senderId,
      content:         filteredContent,
      is_filtered:     wasFiltered,
      filter_reason:   wasFiltered ? filterReasons.join(', ') : null,
    })
    .select('id, conversation_id, sender_id, content, is_filtered, filter_reason, created_at')
    .single();

  if (msgError || !msgData) {
    throw new AppError('Failed to send message', 500);
  }

  // Update conversation: bump last_message_at and increment the OTHER user's unread count
  const isInvestor    = senderId === investorId;
  const unreadColumn  = isInvestor ? 'contractor_unread_count' : 'investor_unread_count';

  const { error: convError } = await supabase.rpc('increment_unread_and_touch', {
    p_conversation_id: conversationId,
    p_unread_column:   unreadColumn,
  });

  // If the RPC doesn't exist, fall back to two raw updates
  if (convError) {
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    await supabase.rpc('increment_conversation_unread', {
      p_conversation_id: conversationId,
      p_column:          unreadColumn,
    }).then(() => {/* best-effort */});
  }

  const row = msgData as {
    id: string; conversation_id: string; sender_id: string;
    content: string; is_filtered: boolean; filter_reason: string | null; created_at: string;
  };

  return {
    id:             row.id,
    conversationId: row.conversation_id,
    senderId:       row.sender_id,
    content:        row.content,
    isFiltered:     row.is_filtered,
    filterReason:   row.filter_reason,
    createdAt:      row.created_at,
    ...(wasFiltered ? { filterWarning: FILTER_WARNING } : {}),
  };
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  page   = 1,
  limit  = 30,
  before?: string,
): Promise<MessagePage> {
  const supabase = getServiceClient();

  // Participant check
  await assertParticipant(conversationId, userId);

  // Fetch sender info from Prisma (User table managed by Prisma)
  // We fetch messages first, then JOIN sender data in a second query.
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, is_filtered, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }) // newest first for cursor pagination
    .limit(limit + 1);                          // +1 to detect hasMore

  // Cursor: return messages created before the given message id
  if (before) {
    // Resolve the timestamp of the cursor message
    const { data: cursorRow } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', before)
      .single();

    if (cursorRow) {
      query = query.lt('created_at', (cursorRow as { created_at: string }).created_at);
    }
  }

  const { data, error } = await query;
  if (error) throw new AppError('Failed to fetch messages', 500);

  const rows = (data ?? []) as Array<{
    id: string; conversation_id: string; sender_id: string;
    content: string; is_filtered: boolean; created_at: string;
  }>;

  const hasMore   = rows.length > limit;
  const pageRows  = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;

  // Fetch sender profiles (firstName, lastName, avatarUrl) via Prisma
  const senderIds = [...new Set(pageRows.map((r) => r.sender_id))];
  const senders = await prisma.user.findMany({
    where:  { id: { in: senderIds } },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  // Reverse to ascending order (oldest first) for the response
  const messages: MessageWithSender[] = pageRows.reverse().map((row) => {
    const sender = senderMap.get(row.sender_id);
    return {
      id:             row.id,
      conversationId: row.conversation_id,
      senderId:       row.sender_id,
      content:        row.content,
      isFiltered:     row.is_filtered,
      createdAt:      row.created_at,
      sender: {
        firstName: sender?.firstName ?? '',
        lastName:  sender?.lastName  ?? '',
        avatarUrl: sender?.avatarUrl ?? null,
      },
    };
  });

  return { messages, nextCursor, hasMore };
}

// ── Existing job-scoped message functions (used by job.routes.ts) ─────────────

const SENDER_SELECT = {
  select: { firstName: true, lastName: true, role: true },
} as const;

async function assertJobAccess(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({
    where:   { id: jobId },
    include: { bids: { where: { contractorId: userId, status: { in: ['ACCEPTED', 'PENDING'] } } } },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.investorId !== userId && job.bids.length === 0) {
    throw new AppError('Forbidden', 403);
  }
  return job;
}

export async function createMessage(
  jobId:        string,
  senderId:     string,
  body:         string,
  isAiGenerated = false,
) {
  await assertJobAccess(jobId, senderId);
  return prisma.message.create({
    data:    { jobId, senderId, body, isAiGenerated },
    include: { sender: SENDER_SELECT },
  });
}

export async function getJobMessages(jobId: string, requesterId: string) {
  await assertJobAccess(jobId, requesterId);
  return prisma.message.findMany({
    where:   { jobId },
    orderBy: { createdAt: 'asc' },
    include: { sender: SENDER_SELECT },
  });
}
