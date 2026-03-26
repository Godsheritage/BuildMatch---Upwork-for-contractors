"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const response_utils_1 = require("../utils/response.utils");
const router = (0, express_1.Router)();
// Placeholder — expand as user management features are added
router.get('/profile', auth_middleware_1.authenticate, (req, res) => {
    (0, response_utils_1.sendSuccess)(res, { userId: req.user?.userId });
});
exports.default = router;
//# sourceMappingURL=user.routes.js.map