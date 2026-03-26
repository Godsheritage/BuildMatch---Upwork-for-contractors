"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.getById = getById;
exports.updateMyProfile = updateMyProfile;
const contractorService = __importStar(require("../services/contractor.service"));
const response_utils_1 = require("../utils/response.utils");
const app_error_1 = require("../utils/app-error");
function parsePositiveFloat(val) {
    const n = parseFloat(val);
    return isNaN(n) ? undefined : n;
}
function parsePositiveInt(val) {
    const n = parseInt(val, 10);
    return isNaN(n) ? undefined : n;
}
function parseBoolean(val) {
    if (val === 'true')
        return true;
    if (val === 'false')
        return false;
    return undefined;
}
function handleError(res, err) {
    if (err instanceof app_error_1.AppError) {
        (0, response_utils_1.sendError)(res, err.message, err.statusCode);
    }
    else {
        (0, response_utils_1.sendError)(res, 'Internal server error', 500);
    }
}
async function getAll(req, res) {
    try {
        const result = await contractorService.listContractors({
            page: parsePositiveInt(req.query.page),
            limit: parsePositiveInt(req.query.limit),
            specialty: req.query.specialty,
            state: req.query.state,
            city: req.query.city,
            minRating: parsePositiveFloat(req.query.minRating),
            available: parseBoolean(req.query.available),
            search: req.query.search,
        });
        (0, response_utils_1.sendSuccess)(res, result);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function getById(req, res) {
    try {
        const contractor = await contractorService.getContractorById(req.params.id);
        (0, response_utils_1.sendSuccess)(res, contractor);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function updateMyProfile(req, res) {
    try {
        const profile = await contractorService.updateMyProfile(req.user.userId, req.body);
        (0, response_utils_1.sendSuccess)(res, profile);
    }
    catch (err) {
        handleError(res, err);
    }
}
//# sourceMappingURL=contractor.controller.js.map