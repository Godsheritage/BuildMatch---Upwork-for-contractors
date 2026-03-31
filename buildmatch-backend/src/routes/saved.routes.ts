import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import { getServiceClient } from '../lib/supabase';
import {
  toggleSave,
  getSavedIds,
  getLists,
  createList,
  renameList,
  deleteList,
  getListContractors,
  moveContractor,
  updateNote,
} from '../services/saved-contractors.service';

const router = Router();

// ── Auth guard — all routes require an authenticated INVESTOR ─────────────────
router.use(authenticate, requireRole('INVESTOR'));

// ── Rate limiter for bookmark toggle (fast action, generous limit) ─────────────
const toggleRateLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  handler:         (_req: Request, res: Response) => {
    sendError(res, 'Too many bookmark actions. Please slow down.', 429);
  },
});

// ── Zod schemas ───────────────────────────────────────────────────────────────

const toggleSchema = z.object({
  contractorProfileId: z.string().min(1),
  listId:              z.string().min(1).optional(),
});

const listNameSchema = z.object({
  name: z.string().min(1).max(50),
});

const moveSchema = z.object({
  targetListId: z.string().min(1),
});

const noteSchema = z.object({
  note: z.string().max(300),
});

// ── POST /toggle ──────────────────────────────────────────────────────────────
// Bookmark toggle — handles both save and unsave in one endpoint.
router.post(
  '/toggle',
  toggleRateLimiter,
  validate(toggleSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await toggleSave({
        investorId:          req.user!.userId,
        contractorProfileId: req.body.contractorProfileId,
        listId:              req.body.listId,
      });
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] POST /toggle error:', err);
      sendError(res, 'Failed to toggle save', 500);
    }
  },
);

// ── GET /ids ──────────────────────────────────────────────────────────────────
// Lightweight — returns Record<contractorProfileId, listId> for icon state init.
router.get(
  '/ids',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await getSavedIds(req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] GET /ids error:', err);
      sendError(res, 'Failed to fetch saved contractor IDs', 500);
    }
  },
);

// ── GET /lists ────────────────────────────────────────────────────────────────
router.get(
  '/lists',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const lists = await getLists(req.user!.userId);
      sendSuccess(res, lists);
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] GET /lists error:', err);
      sendError(res, 'Failed to fetch lists', 500);
    }
  },
);

// ── POST /lists ───────────────────────────────────────────────────────────────
router.post(
  '/lists',
  validate(listNameSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const list = await createList({ investorId: req.user!.userId, name: req.body.name });
      sendSuccess(res, list, undefined, 201);
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] POST /lists error:', err);
      sendError(res, 'Failed to create list', 500);
    }
  },
);

// ── PUT /lists/:listId ────────────────────────────────────────────────────────
router.put(
  '/lists/:listId',
  validate(listNameSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const list = await renameList({
        listId:     req.params.listId,
        investorId: req.user!.userId,
        newName:    req.body.name,
      });
      sendSuccess(res, list);
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] PUT /lists/:listId error:', err);
      sendError(res, 'Failed to rename list', 500);
    }
  },
);

// ── DELETE /lists/:listId ─────────────────────────────────────────────────────
router.delete(
  '/lists/:listId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      await deleteList({ listId: req.params.listId, investorId: req.user!.userId });
      sendSuccess(res, null, 'List deleted');
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] DELETE /lists/:listId error:', err);
      sendError(res, 'Failed to delete list', 500);
    }
  },
);

// ── GET /lists/:listId/contractors ────────────────────────────────────────────
router.get(
  '/lists/:listId/contractors',
  async (req: Request, res: Response): Promise<void> => {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '12'), 10) || 12));

    try {
      const result = await getListContractors({
        listId:     req.params.listId,
        investorId: req.user!.userId,
        page,
        limit,
      });
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] GET /lists/:listId/contractors error:', err);
      sendError(res, 'Failed to fetch list contractors', 500);
    }
  },
);

// ── DELETE /lists/:listId/contractors/:savedId ────────────────────────────────
// Removes a specific saved_contractors row; verifies ownership before deleting.
router.delete(
  '/lists/:listId/contractors/:savedId',
  async (req: Request, res: Response): Promise<void> => {
    const { savedId } = req.params;
    const investorId  = req.user!.userId;

    try {
      const supabase = getServiceClient();

      // Verify the row belongs to this investor (ownership check)
      const { data: entry, error: fetchErr } = await supabase
        .from('saved_contractors')
        .select('id')
        .eq('id', savedId)
        .eq('investor_id', investorId)
        .maybeSingle();

      if (fetchErr) {
        sendError(res, 'Failed to verify ownership', 500);
        return;
      }
      if (!entry) {
        sendError(res, 'Saved contractor not found or access denied', 403);
        return;
      }

      const { error: deleteErr } = await supabase
        .from('saved_contractors')
        .delete()
        .eq('id', savedId);

      if (deleteErr) {
        sendError(res, 'Failed to remove saved contractor', 500);
        return;
      }

      sendSuccess(res, null, 'Contractor removed from list');
    } catch (err) {
      console.error('[saved.routes] DELETE /lists/:listId/contractors/:savedId error:', err);
      sendError(res, 'Failed to remove saved contractor', 500);
    }
  },
);

// ── PUT /contractors/:savedId/move ────────────────────────────────────────────
router.put(
  '/contractors/:savedId/move',
  validate(moveSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await moveContractor({
        savedContractorId: req.params.savedId,
        investorId:        req.user!.userId,
        targetListId:      req.body.targetListId,
      });
      sendSuccess(res, null, 'Contractor moved');
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] PUT /contractors/:savedId/move error:', err);
      sendError(res, 'Failed to move contractor', 500);
    }
  },
);

// ── PUT /contractors/:savedId/note ────────────────────────────────────────────
router.put(
  '/contractors/:savedId/note',
  validate(noteSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await updateNote({
        savedContractorId: req.params.savedId,
        investorId:        req.user!.userId,
        note:              req.body.note,
      });
      sendSuccess(res, null, 'Note updated');
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[saved.routes] PUT /contractors/:savedId/note error:', err);
      sendError(res, 'Failed to update note', 500);
    }
  },
);

export default router;
