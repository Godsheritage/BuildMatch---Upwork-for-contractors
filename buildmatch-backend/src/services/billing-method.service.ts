import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';

// ── Card brand detection from BIN (issuer identification number) ─────────────
// Lightweight — we never store the full PAN, only last4 + brand for display.

function detectBrand(rawNumber: string): string {
  const n = rawNumber.replace(/\D/g, '');
  if (/^4/.test(n))            return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n))         return 'Amex';
  if (/^6(?:011|5)/.test(n))    return 'Discover';
  if (/^3(?:0[0-5]|[68])/.test(n)) return 'Diners';
  return 'Card';
}

// Luhn check — tiny client-side sanity guard.
function luhnOk(rawNumber: string): boolean {
  const n = rawNumber.replace(/\D/g, '');
  if (n.length < 12 || n.length > 19) return false;
  let sum = 0; let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = parseInt(n[i]!, 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}

export interface AddCardInput {
  type:         'CARD';
  cardNumber:   string;
  holderName:   string;
  expMonth:     number;
  expYear:      number;
  // securityCode is intentionally never persisted
  country:      string;
  addressLine1: string;
  addressLine2?: string;
  city:         string;
  state:        string;
  zipCode:      string;
}

export interface AddPaypalInput  { type: 'PAYPAL';  accountEmail: string }
export interface AddVenmoInput   { type: 'VENMO';   accountEmail: string }

export type AddBillingMethodInput = AddCardInput | AddPaypalInput | AddVenmoInput;

export async function listMethods(userId: string) {
  return prisma.billingMethod.findMany({
    where:   { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function addMethod(userId: string, input: AddBillingMethodInput) {
  // Auto-promote first method to default.
  const existingCount = await prisma.billingMethod.count({ where: { userId } });
  const isDefault    = existingCount === 0;

  if (input.type === 'CARD') {
    const digits = input.cardNumber.replace(/\D/g, '');
    if (!luhnOk(digits))                throw new AppError('Invalid card number', 400);
    if (input.expMonth < 1 || input.expMonth > 12) throw new AppError('Invalid expiration month', 400);
    const yr = input.expYear < 100 ? 2000 + input.expYear : input.expYear;
    if (yr < new Date().getFullYear()) throw new AppError('Card has expired', 400);
    if (!input.holderName?.trim())     throw new AppError('Card holder name is required', 400);

    return prisma.billingMethod.create({
      data: {
        userId,
        type:        'CARD',
        brand:       detectBrand(digits),
        last4:       digits.slice(-4),
        holderName:  input.holderName.trim(),
        expMonth:    input.expMonth,
        expYear:     yr,
        country:     input.country,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        city:        input.city,
        state:       input.state,
        zipCode:     input.zipCode,
        isDefault,
      },
    });
  }

  // PayPal / Venmo — connect by email handle (real OAuth flow can replace later).
  if (!input.accountEmail?.trim()) throw new AppError('Account email is required', 400);
  return prisma.billingMethod.create({
    data: {
      userId,
      type:         input.type,
      accountEmail: input.accountEmail.trim(),
      isDefault,
    },
  });
}

export async function deleteMethod(userId: string, methodId: string) {
  const row = await prisma.billingMethod.findUnique({ where: { id: methodId } });
  if (!row || row.userId !== userId) throw new AppError('Billing method not found', 404);
  await prisma.billingMethod.delete({ where: { id: methodId } });

  // If we just removed the default, promote the most-recent remaining one.
  if (row.isDefault) {
    const next = await prisma.billingMethod.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (next) {
      await prisma.billingMethod.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}

export async function setDefaultMethod(userId: string, methodId: string) {
  const row = await prisma.billingMethod.findUnique({ where: { id: methodId } });
  if (!row || row.userId !== userId) throw new AppError('Billing method not found', 404);
  await prisma.$transaction([
    prisma.billingMethod.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.billingMethod.update({ where: { id: methodId }, data: { isDefault: true } }),
  ]);
}
