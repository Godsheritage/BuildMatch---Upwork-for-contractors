import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import {
  listMethods, addMethod, deleteMethod, setDefaultMethod,
  type AddBillingMethodInput,
} from '../services/billing-method.service';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await listMethods(req.user!.userId);
    sendSuccess(res, rows);
  } catch {
    sendError(res, 'Failed to load billing methods', 500);
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<AddBillingMethodInput> | undefined;
  if (!body?.type || !['CARD', 'PAYPAL', 'VENMO'].includes(body.type)) {
    sendError(res, 'Invalid billing method type', 400);
    return;
  }
  try {
    const created = await addMethod(req.user!.userId, body as AddBillingMethodInput);
    sendSuccess(res, created, 'Billing method added', 201);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else { console.error('[billing] add', err); sendError(res, 'Failed to add billing method', 500); }
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteMethod(req.user!.userId, req.params.id!);
    sendSuccess(res, null, 'Removed');
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to remove', 500);
  }
});

router.put('/:id/default', async (req: Request, res: Response): Promise<void> => {
  try {
    await setDefaultMethod(req.user!.userId, req.params.id!);
    sendSuccess(res, null, 'Default updated');
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to update default', 500);
  }
});

export default router;
