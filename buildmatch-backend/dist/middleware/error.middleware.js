"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const app_error_1 = require("../utils/app-error");
function errorHandler(err, _req, res, _next) {
    if (err instanceof app_error_1.AppError) {
        res.status(err.statusCode).json({ success: false, message: err.message });
        return;
    }
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
}
//# sourceMappingURL=error.middleware.js.map