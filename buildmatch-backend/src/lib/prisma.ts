import { PrismaClient } from '@prisma/client';

// Singleton — one client per process.
// Supabase uses PgBouncer (session mode) on DATABASE_URL; the client
// must not open more connections than the pooler allows.
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return _prisma;
}

// Lazy proxy — defers client instantiation until first database call,
// so the server can start before the connection is tested.
const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export default prisma;
