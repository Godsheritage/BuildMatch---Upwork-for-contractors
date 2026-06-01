import type { Request, Response } from 'express';
import * as messageService from '../services/message.service';
import { AppError } from '../utils/app-error';
import { sendSuccess, sendError } from '../utils/response.utils';

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    console.error('[message controller]', err);
    sendError(res, 'Something went wrong', 500);
  }
}

// ── Conversation handlers ─────────────────────────────────────────────────────

export async function createConversation(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, recipientId } = req.body as { jobId: string; recipientId: string };
    const conversation = await messageService.createOrGetConversation(
      req.user!.userId,
      req.user!.role,
      jobId,
      recipientId,
    );
    sendSuccess(res, conversation, 'Conversation ready', 200);
  } catch (err) {
    handleError(res, err);
  }
}

export async function listConversations(req: Request, res: Response): Promise<void> {
  try {
    const conversations = await messageService.listConversations(req.user!.userId);
    sendSuccess(res, conversations);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  try {
    const conversation = await messageService.getConversationById(
      req.params.conversationId,
      req.user!.userId,
    );
    sendSuccess(res, conversation);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  try {
    const total = await messageService.getUnreadCount(req.user!.userId);
    sendSuccess(res, { total });
  } catch (err) {
    handleError(res, err);
  }
}

// ── Conversation message handlers ────────────────────────────────────────────

export async function sendConversationMessage(req: Request, res: Response): Promise<void> {
  try {
    const { content, replyToId } = req.body as { content: string; replyToId?: string };
    const message = await messageService.sendConversationMessage(
      req.params.conversationId,
      req.user!.userId,
      content,
      replyToId ?? null,
    );
    sendSuccess(res, message, 'Message sent', 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function editConversationMessage(req: Request, res: Response): Promise<void> {
  try {
    const message = await messageService.editConversationMessage(
      req.params.messageId,
      req.user!.userId,
      (req.body?.content as string) ?? '',
    );
    sendSuccess(res, message, 'Message updated');
  } catch (err) {
    handleError(res, err);
  }
}

export async function deleteConversationMessage(req: Request, res: Response): Promise<void> {
  try {
    await messageService.deleteConversationMessage(req.params.messageId, req.user!.userId);
    sendSuccess(res, null, 'Message deleted');
  } catch (err) {
    handleError(res, err);
  }
}

export async function reportConversationMessage(req: Request, res: Response): Promise<void> {
  try {
    const { reason, description } = req.body as { reason?: string; description?: string };
    await messageService.reportConversationMessage(
      req.params.messageId,
      req.user!.userId,
      reason ?? '',
      typeof description === 'string' ? description : null,
    );
    sendSuccess(res, null, 'Thanks — we received your report.');
  } catch (err) {
    handleError(res, err);
  }
}

export async function getConversationMessages(req: Request, res: Response): Promise<void> {
  try {
    const page   = req.query.page   ? parseInt(req.query.page  as string, 10) : 1;
    const limit  = req.query.limit  ? parseInt(req.query.limit as string, 10) : 30;
    const before = req.query.before as string | undefined;

    const result = await messageService.getConversationMessages(
      req.params.conversationId,
      req.user!.userId,
      page,
      limit,
      before,
    );
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

// ── Existing job-scoped message handlers (used by job.routes.ts) ──────────────

export async function createMessage(req: Request, res: Response): Promise<void> {
  try {
    const msg = await messageService.createMessage(
      req.params.jobId,
      req.user!.userId,
      req.body.body,
    );
    sendSuccess(res, msg, 'Message sent', 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getJobMessages(req: Request, res: Response): Promise<void> {
  try {
    const messages = await messageService.getJobMessages(req.params.jobId, req.user!.userId);
    sendSuccess(res, messages);
  } catch (err) {
    handleError(res, err);
  }
}
