"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChat = handleChat;
const aiService = __importStar(require("../services/ai.service"));
const response_utils_1 = require("../utils/response.utils");
const prisma_1 = __importDefault(require("../lib/prisma"));
async function handleChat(req, res) {
    try {
        const { message, history = [] } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            (0, response_utils_1.sendError)(res, 'Message is required', 400);
            return;
        }
        // Get user context for better personalisation
        let userContext;
        if (req.user) {
            const user = await prisma_1.default.user.findUnique({
                where: { id: req.user.userId },
                select: { firstName: true, role: true },
            });
            if (user)
                userContext = { firstName: user.firstName, role: user.role };
        }
        const messages = [
            ...history.slice(-10), // keep last 10 turns for context
            { role: 'user', content: message.trim() },
        ];
        const reply = await aiService.chat(messages, userContext);
        (0, response_utils_1.sendSuccess)(res, { reply });
    }
    catch (err) {
        console.error('AI chat error:', err);
        (0, response_utils_1.sendError)(res, 'AI service unavailable. Please try again later.', 503);
    }
}
//# sourceMappingURL=ai.controller.js.map