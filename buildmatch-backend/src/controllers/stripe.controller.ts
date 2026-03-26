import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import {
  createOnboardingLink,
  getOnboardingStatus,
  constructWebhookEvent,
  handleAccountUpdated,
  handlePaymentIntentSucceeded,
  handleTransferCreated,
} from '../services/stripe.service';
import { AppError } from '../utils/app-error';
import type Stripe from 'stripe';

// POST /api/stripe/connect/onboard
export async function onboard(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const url = await createOnboardingLink(userId);
    sendSuccess(res, { url });
  } catch (err) {
    if (err instanceof AppError) {
      sendError(res, err.message, err.statusCode);
    } else {
      sendError(res, 'Failed to create onboarding link', 500);
    }
  }
}

// GET /api/stripe/connect/status
export async function connectStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const status = await getOnboardingStatus(userId);
    sendSuccess(res, status);
  } catch (err) {
    if (err instanceof AppError) {
      sendError(res, err.message, err.statusCode);
    } else {
      sendError(res, 'Failed to retrieve connect status', 500);
    }
  }
}

// POST /api/stripe/webhooks
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    sendError(res, 'Missing stripe-signature header', 400);
    return;
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(req.body as Buffer, sig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook verification failed';
    sendError(res, msg, 400);
    return;
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;
      default:
        // Unhandled event types — acknowledge receipt
        break;
    }
    res.json({ received: true });
  } catch (err) {
    sendError(res, 'Webhook handler error', 500);
  }
}
