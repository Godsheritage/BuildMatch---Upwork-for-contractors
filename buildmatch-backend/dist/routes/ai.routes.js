"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_controller_1 = require("../controllers/ai.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Optional auth — works for both guests and logged-in users
router.post('/chat', auth_middleware_1.optionalAuthenticate, ai_controller_1.handleChat);
exports.default = router;
//# sourceMappingURL=ai.routes.js.map