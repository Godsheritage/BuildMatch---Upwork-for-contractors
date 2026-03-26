"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const stripe_controller_1 = require("../controllers/stripe.controller");
const router = (0, express_1.Router)();
// Webhook — must use raw body; express.raw() is applied at the app level for this path
router.post('/webhooks', stripe_controller_1.handleWebhook);
// Connect onboarding
router.post('/connect/onboard', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('CONTRACTOR'), stripe_controller_1.onboard);
router.get('/connect/status', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('CONTRACTOR'), stripe_controller_1.connectStatus);
exports.default = router;
//# sourceMappingURL=stripe.routes.js.map