import type { Request, Response } from 'express';
import * as aiService from '../services/ai.service';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import prisma from '../lib/prisma';

// ── Polish reply ───────────────────────────────────────────────────────────

export async function polishReply(req: Request, res: Response): Promise<void> {
  try {
    const { message, context } = req.body as { message: string; context: 'investor' | 'contractor' };
    const polished = await aiService.polishMessage(message, context);
    sendSuccess(res, { original: message, polished });
  } catch (err) {
    if (err instanceof Error && err.message === 'AI service unavailable') {
      sendError(res, 'AI service unavailable', 503);
    } else {
      sendError(res, 'Something went wrong', 500);
    }
  }
}

// ── Summarize thread ───────────────────────────────────────────────────────

export async function summarizeThread(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId    = req.user!.userId;

    // Access check: investor or contractor with a bid on the job
    const job = await prisma.job.findUnique({
      where:   { id: jobId },
      include: { bids: { where: { contractorId: userId } } },
    });
    if (!job) throw new AppError('Job not found', 404);
    if (job.investorId !== userId && job.bids.length === 0) throw new AppError('Forbidden', 403);

    const rawMessages = await prisma.message.findMany({
      where:   { jobId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { firstName: true } } },
    });

    if (rawMessages.length === 0) {
      sendSuccess(res, { summary: 'No messages yet for this job.', messageCount: 0 });
      return;
    }

    const mapped = rawMessages.map((m) => ({
      sender:    m.sender.firstName,
      body:      m.body,
      createdAt: m.createdAt.toISOString(),
    }));

    const summary = await aiService.summarizeThread(mapped);
    sendSuccess(res, { summary, messageCount: rawMessages.length });
  } catch (err) {
    if (err instanceof AppError) {
      sendError(res, err.message, err.statusCode);
    } else if (err instanceof Error && err.message === 'AI service unavailable') {
      sendError(res, 'AI service unavailable', 503);
    } else {
      sendError(res, 'Something went wrong', 500);
    }
  }
}

// ── Classify preview (no auth — for live PostJobPage hint) ─────────────────

export async function classifyPreview(req: Request, res: Response): Promise<void> {
  try {
    const { title, description } = req.body as { title: string; description: string };
    if (!title || !description) {
      sendError(res, 'title and description are required', 400);
      return;
    }
    const suggestedTradeType = await aiService.classifyJob(title, description);
    sendSuccess(res, { suggestedTradeType });
  } catch (err) {
    if (err instanceof Error && err.message === 'AI service unavailable') {
      sendError(res, 'AI service unavailable', 503);
    } else {
      sendError(res, 'Something went wrong', 500);
    }
  }
}

export async function handleChat(req: Request, res: Response): Promise<void> {
  try {
    const { message, history = [] } = req.body as {
      message: string;
      history?: aiService.ChatMessage[];
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      sendError(res, 'Message is required', 400);
      return;
    }

    // Get user context for better personalisation
    let userContext: { firstName: string; role: string } | undefined;
    if (req.user) {
      const user = await prisma.user.findUnique({
        where:  { id: req.user.userId },
        select: { firstName: true, role: true },
      });
      if (user) userContext = { firstName: user.firstName, role: user.role };
    }

    const messages: aiService.ChatMessage[] = [
      ...history.slice(-10), // keep last 10 turns for context
      { role: 'user', content: message.trim() },
    ];

    const reply = await aiService.chat(messages, userContext);
    sendSuccess(res, { reply });
  } catch (err) {
    console.error('AI chat error:', err);
    sendError(res, 'AI service unavailable. Please try again later.', 503);
  }
}
