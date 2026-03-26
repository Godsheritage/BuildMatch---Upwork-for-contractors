"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboard = onboard;
exports.connectStatus = connectStatus;
exports.handleWebhook = handleWebhook;
const response_utils_1 = require("../utils/response.utils");
const stripe_service_1 = require("../services/stripe.service");
const app_error_1 = require("../utils/app-error");
// POST /api/stripe/connect/onboard
async function onboard(req, res) {
    try {
        const userId = req.user.userId;
        const url = await (0, stripe_service_1.createOnboardingLink)(userId);
        (0, response_utils_1.sendSuccess)(res, { url });
    }
    catch (err) {
        if (err instanceof app_error_1.AppError) {
            (0, response_utils_1.sendError)(res, err.message, err.statusCode);
        }
        else {
            (0, response_utils_1.sendError)(res, 'Failed to create onboarding link', 500);
        }
    }
}
// GET /api/stripe/connect/status
async function connectStatus(req, res) {
    try {
        const userId = req.user.userId;
        const status = await (0, stripe_service_1.getOnboardingStatus)(userId);
        (0, response_utils_1.sendSuccess)(res, status);
    }
    catch (err) {
        if (err instanceof app_error_1.AppError) {
            (0, response_utils_1.sendError)(res, err.message, err.statusCode);
        }
        else {
            (0, response_utils_1.sendError)(res, 'Failed to retrieve connect status', 500);
        }
    }
}
// POST /api/stripe/webhooks
async function handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
        (0, response_utils_1.sendError)(res, 'Missing stripe-signature header', 400);
        return;
    }
    let event;
    try {
        event = (0, stripe_service_1.constructWebhookEvent)(req.body, sig);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Webhook verification failed';
        (0, response_utils_1.sendError)(res, msg, 400);
        return;
    }
    try {
        switch (event.type) {
            case 'account.updated':
                await (0, stripe_service_1.handleAccountUpdated)(event.data.object);
                break;
            case 'payment_intent.succeeded':
                await (0, stripe_service_1.handlePaymentIntentSucceeded)(event.data.object);
                break;
            case 'transfer.created':
                await (0, stripe_service_1.handleTransferCreated)(event.data.object);
                break;
            default:
                // Unhandled event types — acknowledge receipt
                break;
        }
        res.json({ received: true });
    }
    catch (err) {
        (0, response_utils_1.sendError)(res, 'Webhook handler error', 500);
    }
}
//# sourceMappingURL=stripe.controller.js.map