"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function sendSuccess(res, data, message, status = 200) {
    const body = { success: true, data, message };
    return res.status(status).json(body);
}
function sendError(res, message, status = 400, errors) {
    const body = { success: false, message, errors };
    return res.status(status).json(body);
}
//# sourceMappingURL=response.utils.js.map