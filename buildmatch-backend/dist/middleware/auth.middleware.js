"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
exports.requireRole = requireRole;
const jwt_utils_1 = require("../utils/jwt.utils");
const response_utils_1 = require("../utils/response.utils");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        (0, response_utils_1.sendError)(res, 'Missing or invalid authorization header', 401);
        return;
    }
    const token = authHeader.slice(7);
    try {
        req.user = (0, jwt_utils_1.verifyToken)(token);
        next();
    }
    catch {
        (0, response_utils_1.sendError)(res, 'Invalid or expired token', 401);
    }
}
/** Like authenticate but does not reject unauthenticated requests — just leaves req.user undefined. */
function optionalAuthenticate(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            req.user = (0, jwt_utils_1.verifyToken)(authHeader.slice(7));
        }
        catch {
            // Invalid token — continue as unauthenticated
        }
    }
    next();
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            (0, response_utils_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.middleware.js.map