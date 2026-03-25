import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password.utils';
import { signToken } from '../utils/jwt.utils';
import type { RegisterInput, LoginInput } from '../schemas/auth.schemas';

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error('Email already in use');

  const hashedPassword = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: input.role,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new Error('Invalid email or password');

  const valid = await comparePassword(input.password, user.password);
  if (!valid) throw new Error('Invalid email or password');

  const token = signToken({ userId: user.id, role: user.role });
  const { password: _pw, ...safeUser } = user;
  return { user: safeUser, token };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) throw new Error('User not found');
  return user;
}
