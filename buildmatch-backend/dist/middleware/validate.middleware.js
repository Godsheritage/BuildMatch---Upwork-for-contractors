"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const response_utils_1 = require("../utils/response.utils");
function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            (0, response_utils_1.sendError)(res, 'Validation failed', 422, result.error.flatten().fieldErrors);
            return;
        }
        req.body = result.data;
        next();
    };
}
//# sourceMappingURL=validate.middleware.js.map