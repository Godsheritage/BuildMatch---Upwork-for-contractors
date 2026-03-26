"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDisputeSchema = exports.disputeMilestoneSchema = exports.submitMilestoneSchema = exports.fundJobSchema = exports.milestoneInputSchema = void 0;
const zod_1 = require("zod");
exports.milestoneInputSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(120),
    description: zod_1.z.string().max(500).optional(),
    percentage: zod_1.z.number().positive().max(100),
});
exports.fundJobSchema = zod_1.z.object({
    milestones: zod_1.z.array(exports.milestoneInputSchema).max(10),
});
exports.submitMilestoneSchema = zod_1.z.object({
    completionNotes: zod_1.z.string().max(1000).optional(),
});
exports.disputeMilestoneSchema = zod_1.z.object({
    reason: zod_1.z.string().min(20).max(1000),
});
exports.resolveDisputeSchema = zod_1.z.object({
    resolution: zod_1.z.enum(['RELEASE', 'REFUND']),
    notes: zod_1.z.string().min(1).max(1000),
});
//# sourceMappingURL=escrow.schemas.js.map