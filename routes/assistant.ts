import express from 'express';
import { body, validationResult } from 'express-validator';
import type { Request, Response } from 'express';
import { ask, isAssistantConfigured, type AssistantTurn } from '../config/assistant/index.js';
import { generatePost, isPostGraphConfigured } from '../config/postGraph/index.js';
import { asyncHandler, requireAdminUser, validateInput } from '../middleware/index.js';

/**
 * The AI surfaces: TAssistant and post generation.
 *
 * Both are admin-only. They read live chapter data and spend money per call, so
 * neither belongs on an unauthenticated route.
 */

const router = express.Router();

router.use(validateInput);
router.use(requireAdminUser);

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return true;
  res.status(400).json({ success: false, message: 'Invalid request', errors: errors.array() });
  return false;
};

/** What is wired up, so the UI can render a useful state before asking. */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      assistant: isAssistantConfigured(),
      postGeneration: isPostGraphConfigured(),
      missing: [
        !process.env.DEEPSEEK_API_KEY && !process.env.XAI_API_KEY
          ? 'DEEPSEEK_API_KEY or XAI_API_KEY'
          : null,
        !process.env.TAMID_GATEWAY_URL ? 'TAMID_GATEWAY_URL' : null,
        !process.env.XAI_API_KEY ? 'XAI_API_KEY (needed for image generation)' : null,
      ].filter((v): v is string => v !== null),
    },
  });
});

/** Ask TAssistant a question. */
router.post(
  '/ask',
  body('question').isString().isLength({ min: 1, max: 2000 }),
  body('history').optional().isArray({ max: 20 }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    if (!isAssistantConfigured()) {
      res.status(503).json({
        success: false,
        message:
          'TAssistant is not configured. It needs TAMID_GATEWAY_URL and a model key ' +
          '(DEEPSEEK_API_KEY or XAI_API_KEY).',
        code: 'assistant_not_configured',
      });
      return;
    }

    const { question, history } = req.body as { question: string; history?: AssistantTurn[] };
    res.json({ success: true, data: await ask(question, history ?? []) });
  })
);

/**
 * Generate a post from a brief.
 *
 * Returns a draft. Nothing is staged or published here — that stays with the
 * Instagram routes, so a generated post still goes through the same human
 * confirmation as one written by hand.
 */
router.post(
  '/generate-post',
  body('brief').isString().isLength({ min: 1, max: 2000 }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    if (!isPostGraphConfigured()) {
      res.status(503).json({
        success: false,
        message:
          'Post generation is not configured. It needs XAI_API_KEY (for Grok and image ' +
          'generation) or DEEPSEEK_API_KEY for text only.',
        code: 'generation_not_configured',
      });
      return;
    }

    const { brief } = req.body as { brief: string };
    res.json({ success: true, data: await generatePost(brief) });
  })
);

export default router;
