import type { Request, Response } from 'express';
import * as aiService from '../services/ai.service';
import { sendSuccess, sendError } from '../utils/response.utils';
import prisma from '../lib/prisma';

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
