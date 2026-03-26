"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contractor_controller_1 = require("../controllers/contractor.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const contractor_schemas_1 = require("../schemas/contractor.schemas");
const router = (0, express_1.Router)();
// Public
router.get('/', contractor_controller_1.getAll);
router.get('/:id', contractor_controller_1.getById);
// CONTRACTOR only — must come before /:id to avoid being swallowed by the param route
router.put('/me', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('CONTRACTOR'), (0, validate_middleware_1.validate)(contractor_schemas_1.updateContractorProfileSchema), contractor_controller_1.updateMyProfile);
exports.default = router;
//# sourceMappingURL=contractor.routes.js.map