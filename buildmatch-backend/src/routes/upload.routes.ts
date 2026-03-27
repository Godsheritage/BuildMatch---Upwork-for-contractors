import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { createPresignedUploadUrl, deleteStorageObject } from '../controllers/upload.controller';

const router = Router();

router.post('/presign', authenticate, createPresignedUploadUrl);
router.delete('/', authenticate, deleteStorageObject);

export default router;
