import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { createPresignedUploadUrl, createPublicPresignedUploadUrl, deleteStorageObject } from '../controllers/upload.controller';
import { bugReportLimiter } from './bug-report.routes';

const router = Router();

router.post('/presign', authenticate, createPresignedUploadUrl);
router.post('/presign-public', bugReportLimiter, createPublicPresignedUploadUrl);
router.delete('/', authenticate, deleteStorageObject);

export default router;
