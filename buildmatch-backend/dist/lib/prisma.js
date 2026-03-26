"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Singleton — one client per process.
// Supabase uses PgBouncer (session mode) on DATABASE_URL; the client
// must not open more connections than the pooler allows.
let _prisma = null;
function getPrisma() {
    if (!_prisma) {
        _prisma = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        });
    }
    return _prisma;
}
// Lazy proxy — defers client instantiation until first database call,
// so the server can start before the connection is tested.
const prisma = new Proxy({}, {
    get(_target, prop) {
        return getPrisma()[prop];
    },
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map