import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password.utils';
import { signToken } from '../utils/jwt.utils';
import { AppError } from '../utils/app-error';
import type { RegisterInput, LoginInput } from '../schemas/auth.schemas';

// Fields returned on every user response — never includes password
const USER_SELECT = {
  id:        true,
  email:     true,
  role:      true,
  firstName: true,
  lastName:  true,
  phone:     true,
  avatarUrl: true,
  bio:       true,
  city:      true,
  state:     true,
  company:   true,
  title:     true,
  website:   true,
  displayName:     true,
  pronouns:        true,
  timezone:        true,
  locale:          true,
  dateFormat:      true,
  numberFormat:    true,
  quietHoursStart: true,
  quietHoursEnd:   true,
  profilePublic:     true,
  projectPreference: true,
  aiPreference:      true,
  emailVerifiedAt:      true,
  phoneVerifiedAt:      true,
  idVerificationStatus: true,
  idDocumentUrl:        true,
  idVerifiedAt:         true,
  idVerificationNote:   true,
  googleId:   true,
  isVerified: true,
  isActive:   true,
  createdAt:  true,
  updatedAt:  true,
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

  // Google-only accounts have no stored password — direct them to use Google sign-in.
  if (!userWithPassword.password) {
    throw new AppError(
      'This account uses Google sign-in. Please continue with Google.',
      401,
    );
  }

  const valid = await comparePassword(input.password, userWithPassword.password);
  if (!valid) throw new AppError('Invalid email or password', 401);

  const { password: _pw, ...user } = userWithPassword;
  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}

// ── Google sign-in / sign-up ─────────────────────────────────────────────────
//
// Verifies a Google ID token (issued by Google Identity Services in the
// browser), then either logs in an existing user or creates a new one.
//
// Linking rules:
//   1. If a user with this googleId exists → log them in.
//   2. Else if a user with this verified email exists → link googleId to that
//      account and log them in (one-time merge).
//   3. Else create a brand-new account using the role provided by the caller.

let _googleClient: import('google-auth-library').OAuth2Client | null = null;
async function googleClient() {
  if (!_googleClient) {
    const { OAuth2Client } = await import('google-auth-library');
    _googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return _googleClient;
}

interface GoogleAuthInput {
  idToken: string;
  role?:   'INVESTOR' | 'CONTRACTOR';
  // Optional overrides used when creating a new account from a multi-step
  // signup form. Existing-account sign-ins ignore these.
  firstName?: string;
  lastName?:  string;
  phone?:     string;
}

export async function loginOrRegisterWithGoogle(input: GoogleAuthInput) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError('Google sign-in is not configured on the server', 500);
  }

  // 1. Verify the ID token with Google
  let payload;
  try {
    const client = await googleClient();
    const ticket = await client.verifyIdToken({
      idToken:  input.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('[auth] Google token verification failed:', err);
    throw new AppError('Invalid Google credential', 401);
  }

  if (!payload || !payload.sub || !payload.email) {
    throw new AppError('Invalid Google credential', 401);
  }
  if (!payload.email_verified) {
    throw new AppError('Your Google email must be verified before signing in', 401);
  }

  const googleId  = payload.sub;
  const email     = payload.email.toLowerCase();
  // Form overrides win over Google payload when creating a new user.
  const firstName = input.firstName?.trim() || payload.given_name?.trim()  || 'User';
  const lastName  = input.lastName?.trim()  || payload.family_name?.trim() || '';
  const phone     = input.phone?.trim() || null;
  const avatarUrl = payload.picture ?? null;

  // 2. Existing googleId? log them in.
  const byGoogle = await prisma.user.findUnique({ where: { googleId } });
  if (byGoogle) {
    if (!byGoogle.isActive) throw new AppError('Account disabled', 403);
    const { password: _pw, ...user } = byGoogle;
    const token = signToken({ userId: user.id, role: user.role });
    return { user, token, isNewUser: false };
  }

  // 3. Existing email? link googleId.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    if (!byEmail.isActive) throw new AppError('Account disabled', 403);
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data:  {
        googleId,
        ...(byEmail.avatarUrl ? {} : { avatarUrl }),
      },
      select: USER_SELECT,
    });
    const token = signToken({ userId: linked.id, role: linked.role });
    return { user: linked, token, isNewUser: false };
  }

  // 4. New user — role is required.
  if (!input.role) {
    throw new AppError(
      'No matching account. Please choose Investor or Contractor and try again.',
      400,
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        firstName,
        lastName,
        googleId,
        avatarUrl,
        role: input.role as Role,
        ...(phone ? { phone } : {}),
      },
      select: USER_SELECT,
    });

    if (input.role === 'CONTRACTOR') {
      await tx.contractorProfile.create({
        data: { userId: newUser.id, specialties: [], portfolioImages: [] },
      });
    }

    return newUser;
  });

  const token = signToken({ userId: created.id, role: created.role });
  return { user: created, token, isNewUser: true };
}

// ── Link / unlink Google for the currently signed-in user ────────────────────
// Used by Settings → Connected accounts.

export async function linkGoogleToCurrentUser(userId: string, idToken: string) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError('Google sign-in is not configured on the server', 500);
  }

  const client = await googleClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  }).catch(() => null);

  const payload = ticket?.getPayload();
  if (!payload?.sub) throw new AppError('Invalid Google credential', 401);
  const googleId = payload.sub;

  const existing = await prisma.user.findUnique({ where: { googleId } });
  if (existing && existing.id !== userId) {
    throw new AppError('This Google account is already linked to another user', 409);
  }

  return prisma.user.update({
    where:  { id: userId },
    data:   { googleId },
    select: USER_SELECT,
  });
}

export async function unlinkGoogleFromCurrentUser(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new AppError('User not found', 404);
  // Don't strand the account: if there's no password set, refuse to unlink.
  if (!u.password) {
    throw new AppError(
      'Set a password before unlinking Google, otherwise you will be locked out.',
      400,
    );
  }
  return prisma.user.update({
    where:  { id: userId },
    data:   { googleId: null },
    select: USER_SELECT,
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
}
