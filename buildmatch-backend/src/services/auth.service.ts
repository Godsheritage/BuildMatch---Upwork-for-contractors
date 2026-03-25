import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password.utils';
import { signToken } from '../utils/jwt.utils';
import { AppError } from '../utils/app-error';
import type { RegisterInput, LoginInput } from '../schemas/auth.schemas';

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
} as const;

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('Email is already in use', 409);

  const hashedPassword = await hashPassword(input.password);

  // Create user and, if CONTRACTOR, the empty profile — atomically
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role as Role,
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

  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}

export async function login(input: LoginInput) {
  // Fetch with password for comparison, then strip it before returning
  const userWithPassword = await prisma.user.findUnique({ where: { email: input.email } });

  // Use the same generic message for both "not found" and "wrong password"
  // to avoid user enumeration
  if (!userWithPassword) throw new AppError('Invalid email or password', 401);

  const valid = await comparePassword(input.password, userWithPassword.password);
  if (!valid) throw new AppError('Invalid email or password', 401);

  const { password: _pw, ...user } = userWithPassword;
  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
}
