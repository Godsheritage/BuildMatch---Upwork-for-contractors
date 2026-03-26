"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Lazy singleton — instantiated on first use so server starts before models are defined
let _prisma = null;
function getPrisma() {
    if (!_prisma) {
        _prisma = new client_1.PrismaClient();
    }
    return _prisma;
}
const prisma = new Proxy({}, {
    get(_target, prop) {
        return getPrisma()[prop];
    },
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map