import express from 'express';
import { body, query, validationResult } from 'express-validator';
import type { Request, Response } from 'express';
import {
  instagram,
  instagramAccountId,
  isInstagramConfigured,
  InstagramError,
} from '../config/instagram.js';
import { checkCaption } from '../config/instagramCaption.js';
import { accountInsights, postInsights, audienceInsights } from '../config/instagramInsights.js';
import { asyncHandler, requireAdminUser, validateInput } from '../middleware/index.js';
import { logger } from '../logger.js';

/**
 * Instagram publishing for the admin panel.
 *
 * Every route is admin-only: these act on the chapter's public account, and
 * publishing cannot be undone.
 *
 * Publishing is deliberately two calls. POST /stage builds a media container
 * that is not visible on the account; POST /publish takes that container id and
 * requires an explicit `confirm: true`. A single-call publish would make an
 * irreversible public action too easy to trigger by accident or by a bug.
 */

const router = express.Router();

router.use(validateInput);
router.use(requireAdminUser);

interface CaptionBody {
  caption?: unknown;
}

interface StageBody extends CaptionBody {
  imageUrl?: unknown;
}

interface PublishBody {
  creationId?: unknown;
  confirm?: unknown;
}

/** Narrow an already-validated body field to a string for type-safe use. */
const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Names the likeliest misconfiguration when a token is rejected.
 *
 * The two Instagram login paths issue tokens that are only valid against their
 * own host, and a mismatch fails in a way that looks like a bad token rather
 * than a wrong URL. Surfacing the host being used makes that obvious.
 */
const graphHostHint = (): string => {
  const usingInstagramHost = (process.env.IG_GRAPH_URL ?? '').includes('graph.instagram.com');
  return usingInstagramHost
    ? 'Calling graph.instagram.com (Instagram Login). The token must come from an ' +
        'Instagram app with instagram_business_content_publish.'
    : 'Calling graph.facebook.com (Facebook Login). If the account was set up with ' +
        'Instagram Login and no Facebook Page, set IG_GRAPH_URL=https://graph.instagram.com/v21.0.';
};

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return true;
  res.status(400).json({ success: false, message: 'Invalid request', errors: errors.array() });
  return false;
};

const guardConfigured = (res: Response): boolean => {
  if (isInstagramConfigured()) return true;
  res.status(503).json({
    success: false,
    message: 'Instagram is not connected. Set IG_ACCESS_TOKEN and IG_USER_ID on the backend.',
    code: 'instagram_not_configured',
  });
  return false;
};

/** Connection status — lets the panel render a useful state before any call. */
router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!isInstagramConfigured()) {
      res.json({ success: true, data: { connected: false } });
      return;
    }

    try {
      const account = await instagram.get<Record<string, unknown>>(`/${instagramAccountId()}`, {
        fields: 'username,name,followers_count,media_count,profile_picture_url',
      });
      res.json({ success: true, data: { connected: true, account } });
    } catch (error) {
      // Configured but unreachable — usually an expired token, or credentials
      // issued for one login path being sent to the other path's host. Report it
      // as a state the panel can render rather than as a request failure.
      const message = error instanceof InstagramError ? error.message : 'Unknown error';
      res.json({
        success: true,
        data: { connected: false, error: message, hint: graphHostHint() },
      });
    }
  })
);

/** Recent posts, for matching voice and checking what already went out. */
router.get(
  '/recent',
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    if (!guardConfigured(res)) return;

    const limit = (req.query.limit as number | undefined) ?? 12;
    const data = await instagram.get<{ data?: unknown[] }>(`/${instagramAccountId()}/media`, {
      fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count',
      limit,
    });
    res.json({ success: true, data: data.data ?? [] });
  })
);

/** Caption check, so the panel can show issues before anything is staged. */
router.post(
  '/check-caption',
  body('caption').isString().isLength({ min: 1, max: 2200 }),
  (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    const { caption } = req.body as CaptionBody;
    res.json({ success: true, data: checkCaption(asString(caption)) });
  }
);

/** Remaining posts inside Instagram's rolling 24-hour limit of 25. */
router.get(
  '/limit',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!guardConfigured(res)) return;
    const data = await instagram.get<{ data?: unknown[] }>(
      `/${instagramAccountId()}/content_publishing_limit`,
      { fields: 'config,quota_usage' }
    );
    res.json({ success: true, data: data.data ?? data });
  })
);

/** Stages a post. Creates a container; publishes nothing. */
router.post(
  '/stage',
  body('imageUrl').isURL({ protocols: ['https'], require_protocol: true }),
  body('caption').isString().isLength({ min: 1, max: 2200 }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    if (!guardConfigured(res)) return;

    const { caption: rawCaption, imageUrl: rawImageUrl } = req.body as StageBody;
    const caption = asString(rawCaption);
    const imageUrl = asString(rawImageUrl);

    const check = checkCaption(caption);
    if (!check.ok) {
      res.status(422).json({
        success: false,
        message: 'Caption has blocking issues and was not staged.',
        code: 'caption_blocked',
        data: check,
      });
      return;
    }

    const created = await instagram.post<{ id: string }>(`/${instagramAccountId()}/media`, {
      image_url: imageUrl,
      caption,
    });

    logger.info({ message: 'Instagram post staged', creationId: created.id });

    res.status(201).json({
      success: true,
      data: {
        creationId: created.id,
        published: false,
        captionCheck: check,
      },
    });
  })
);

/**
 * Publishes a staged container to the live account.
 *
 * `confirm` must be explicitly true. It exists so that publishing is a separate,
 * deliberate act rather than a side effect of staging.
 */
router.post(
  '/publish',
  body('creationId').isString().isLength({ min: 1, max: 128 }),
  body('confirm').isBoolean(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    if (!guardConfigured(res)) return;

    const { creationId: rawCreationId, confirm } = req.body as PublishBody;

    if (confirm !== true) {
      res.status(400).json({
        success: false,
        message: 'Not published. confirm must be true.',
        code: 'confirmation_required',
      });
      return;
    }

    const creationId = asString(rawCreationId);
    const published = await instagram.post<{ id: string }>(
      `/${instagramAccountId()}/media_publish`,
      { creation_id: creationId }
    );

    const media = await instagram.get<Record<string, unknown>>(`/${published.id}`, {
      fields: 'id,permalink,timestamp',
    });

    logger.info({
      message: 'Instagram post published',
      mediaId: published.id,
      actor: (req as Request & { user?: { email?: string } }).user?.email,
    });

    res.status(201).json({ success: true, data: { published: true, ...media } });
  })
);

/** Account-level analytics over a recent window. */
router.get(
  '/insights/account',
  query('days').optional().isInt({ min: 1, max: 30 }).toInt(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    if (!guardConfigured(res)) return;
    const days = (req.query.days as number | undefined) ?? 28;
    res.json({ success: true, data: await accountInsights(days) });
  })
);

/** Per-post analytics for recent posts. */
router.get(
  '/insights/posts',
  query('limit').optional().isInt({ min: 1, max: 25 }).toInt(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    if (!guardConfigured(res)) return;
    const limit = (req.query.limit as number | undefined) ?? 10;
    res.json({ success: true, data: await postInsights(limit) });
  })
);

/** Follower demographics. */
router.get(
  '/insights/audience',
  query('breakdown').optional().isIn(['city', 'country', 'age', 'gender']),
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    if (!guardConfigured(res)) return;
    const breakdown = (req.query.breakdown as string | undefined) ?? 'city';
    res.json({ success: true, data: await audienceInsights(breakdown) });
  })
);

export default router;
