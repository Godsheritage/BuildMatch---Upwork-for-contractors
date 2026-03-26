"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBidSchema = exports.updateJobSchema = exports.createJobSchema = void 0;
const zod_1 = require("zod");
const TRADE_TYPES = [
    'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
    'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
];
exports.createJobSchema = zod_1.z.object({
    title: zod_1.z.string().min(10, 'Title must be at least 10 characters').max(120, 'Title must be at most 120 characters'),
    description: zod_1.z.string().min(50, 'Description must be at least 50 characters').max(2000),
    tradeType: zod_1.z.enum(TRADE_TYPES),
    budgetMin: zod_1.z.number().positive('budgetMin must be positive'),
    budgetMax: zod_1.z.number().positive('budgetMax must be positive'),
    city: zod_1.z.string().min(1, 'City is required'),
    state: zod_1.z.string().min(1, 'State is required'),
    zipCode: zod_1.z.string().min(1, 'Zip code is required'),
}).refine((d) => d.budgetMin < d.budgetMax, {
    message: 'budgetMin must be less than budgetMax',
    path: ['budgetMin'],
});
exports.updateJobSchema = zod_1.z.object({
    title: zod_1.z.string().min(10).max(120).optional(),
    description: zod_1.z.string().min(50).max(2000).optional(),
    tradeType: zod_1.z.enum(TRADE_TYPES).optional(),
    budgetMin: zod_1.z.number().positive().optional(),
    budgetMax: zod_1.z.number().positive().optional(),
}).refine((d) => !(d.budgetMin !== undefined && d.budgetMax !== undefined) || d.budgetMin < d.budgetMax, { message: 'budgetMin must be less than budgetMax', path: ['budgetMin'] });
exports.createBidSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Amount must be positive'),
    message: zod_1.z.string().min(20, 'Message must be at least 20 characters').max(500, 'Message must be at most 500 characters'),
});
//# sourceMappingURL=job.schemas.js.map