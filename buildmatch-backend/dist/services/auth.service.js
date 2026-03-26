"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getMe = getMe;
const prisma_1 = __importDefault(require("../lib/prisma"));
const password_utils_1 = require("../utils/password.utils");
const jwt_utils_1 = require("../utils/jwt.utils");
const app_error_1 = require("../utils/app-error");
// Fields returned on every user response — never includes password
const USER_SELECT = {
    id: true,
    email: true,
    role: true,
    firstName: true,
    lastName: true,
    phone: true,
    isVerified: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
async function register(input) {
    const existing = await prisma_1.default.user.findUnique({ where: { email: input.email } });
    if (existing)
        throw new app_error_1.AppError('Email is already in use', 409);
    const hashedPassword = await (0, password_utils_1.hashPassword)(input.password);
    // Create user and, if CONTRACTOR, the empty profile — atomically
    const user = await prisma_1.default.$transaction(async (tx) => {
        const created = await tx.user.create({
            data: {
                email: input.email,
                password: hashedPassword,
                firstName: input.firstName,
                lastName: input.lastName,
                role: input.role,
                ...(input.phone ? { phone: input.phone } : {}),
            },
            select: USER_SELECT,
        });
        if (input.role === 'CONTRACTOR') {
            await tx.contractorProfile.create({
                data: {
                    userId: created.id,
                    specialties: [],
                    portfolioImages: [],
                },
            });
        }
        return created;
    });
    const token = (0, jwt_utils_1.signToken)({ userId: user.id, role: user.role });
    return { user, token };
}
async function login(input) {
    // Fetch with password for comparison, then strip it before returning
    const userWithPassword = await prisma_1.default.user.findUnique({ where: { email: input.email } });
    // Use the same generic message for both "not found" and "wrong password"
    // to avoid user enumeration
    if (!userWithPassword)
        throw new app_error_1.AppError('Invalid email or password', 401);
    const valid = await (0, password_utils_1.comparePassword)(input.password, userWithPassword.password);
    if (!valid)
        throw new app_error_1.AppError('Invalid email or password', 401);
    const { password: _pw, ...user } = userWithPassword;
    const token = (0, jwt_utils_1.signToken)({ userId: user.id, role: user.role });
    return { user, token };
}
async function getMe(userId) {
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: USER_SELECT,
    });
    if (!user)
        throw new app_error_1.AppError('User not found', 404);
    return user;
}
//# sourceMappingURL=auth.service.js.map