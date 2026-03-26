"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateContractorProfileSchema = void 0;
const zod_1 = require("zod");
exports.updateContractorProfileSchema = zod_1.z
    .object({
    bio: zod_1.z.string().max(2000).optional(),
    yearsExperience: zod_1.z.number().int().min(0).max(60).optional(),
    specialties: zod_1.z.array(zod_1.z.string().min(1).max(100)).max(20).optional(),
    licenseNumber: zod_1.z.string().max(100).optional(),
    licenseState: zod_1.z.string().length(2).toUpperCase().optional(),
    hourlyRateMin: zod_1.z.number().min(0).optional(),
    hourlyRateMax: zod_1.z.number().min(0).optional(),
    city: zod_1.z.string().max(100).optional(),
    state: zod_1.z.string().length(2).toUpperCase().optional(),
    zipCode: zod_1.z.string().max(10).optional(),
    isAvailable: zod_1.z.boolean().optional(),
    // ISO-8601 string → coerced to Date; null clears the stored value
    insuranceExpiry: zod_1.z
        .union([
        zod_1.z.string().datetime({ offset: true }).transform((v) => new Date(v)),
        zod_1.z.null(),
    ])
        .optional(),
})
    .refine((data) => {
    if (data.hourlyRateMin !== undefined && data.hourlyRateMax !== undefined) {
        return data.hourlyRateMin <= data.hourlyRateMax;
    }
    return true;
}, { message: 'hourlyRateMin must be ≤ hourlyRateMax', path: ['hourlyRateMin'] });
//# sourceMappingURL=contractor.schemas.js.map