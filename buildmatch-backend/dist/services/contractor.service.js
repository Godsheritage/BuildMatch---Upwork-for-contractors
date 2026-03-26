"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listContractors = listContractors;
exports.getContractorById = getContractorById;
exports.getMyProfile = getMyProfile;
exports.updateMyProfile = updateMyProfile;
const prisma_1 = __importDefault(require("../lib/prisma"));
const app_error_1 = require("../utils/app-error");
// Fields returned on list queries
const LIST_SELECT = {
    id: true,
    bio: true,
    yearsExperience: true,
    specialties: true,
    city: true,
    state: true,
    zipCode: true,
    hourlyRateMin: true,
    hourlyRateMax: true,
    averageRating: true,
    totalReviews: true,
    completedJobs: true,
    isAvailable: true,
    isLicenseVerified: true,
    createdAt: true,
    user: { select: { firstName: true, lastName: true } },
};
// Full fields for single-contractor detail view
const DETAIL_SELECT = {
    ...LIST_SELECT,
    licenseNumber: true,
    licenseState: true,
    insuranceExpiry: true,
    portfolioImages: true,
    updatedAt: true,
    user: { select: { firstName: true, lastName: true, email: true } },
};
async function listContractors(query) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 12));
    const skip = (page - 1) * limit;
    const where = {};
    if (query.state) {
        where.state = { equals: query.state.toUpperCase() };
    }
    if (query.city) {
        where.city = { contains: query.city, mode: 'insensitive' };
    }
    if (query.minRating !== undefined) {
        where.averageRating = { gte: query.minRating };
    }
    if (query.available !== undefined) {
        where.isAvailable = query.available;
    }
    // specialty: has-match on the String[] column.
    // Note: Prisma does not support case-insensitive contains on array elements
    // without raw SQL, so this is an exact-match filter.
    if (query.specialty) {
        where.specialties = { has: query.specialty };
    }
    // search: bio contains OR specialties array has the term
    if (query.search) {
        const term = query.search;
        where.OR = [
            { bio: { contains: term, mode: 'insensitive' } },
            { specialties: { has: term } },
        ];
    }
    const [contractors, total] = await Promise.all([
        prisma_1.default.contractorProfile.findMany({
            where,
            select: LIST_SELECT,
            skip,
            take: limit,
            orderBy: [{ averageRating: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma_1.default.contractorProfile.count({ where }),
    ]);
    return {
        contractors,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}
async function getContractorById(id) {
    const contractor = await prisma_1.default.contractorProfile.findUnique({
        where: { id },
        select: DETAIL_SELECT,
    });
    if (!contractor)
        throw new app_error_1.AppError('Contractor not found', 404);
    return contractor;
}
async function getMyProfile(userId) {
    const contractor = await prisma_1.default.contractorProfile.findUnique({
        where: { userId },
        select: DETAIL_SELECT,
    });
    if (!contractor)
        throw new app_error_1.AppError('Contractor profile not found', 404);
    return contractor;
}
async function updateMyProfile(userId, input) {
    const existing = await prisma_1.default.contractorProfile.findUnique({ where: { userId } });
    if (!existing)
        throw new app_error_1.AppError('Contractor profile not found', 404);
    return prisma_1.default.contractorProfile.update({
        where: { userId },
        data: input,
    });
}
//# sourceMappingURL=contractor.service.js.map