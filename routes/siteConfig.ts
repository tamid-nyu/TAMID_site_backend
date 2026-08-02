import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import {
  query,
  validationResult,
  type ValidationChain,
  type Result,
  type ValidationError,
} from 'express-validator';
import { getSupabase } from '../config/supabase.js';
import { asyncHandler, requireAdminUser, validateInput } from '../middleware/index.js';
import {
  adminSiteConfigKeyValidation,
  createAdminCreateHandler,
  createAdminDeleteHandler,
  createAdminGetHandler,
  createAdminListHandler,
  createAdminUpdateHandler,
  handleAdminValidationErrors,
} from './adminResource.js';

const router = express.Router();

router.use(validateInput);

const optionalAdminRead = (handler: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.get('Authorization')) {
      next();
      return;
    }

    void requireAdminUser(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }

      handler(req, res, next);
    });
  };
};

const handleValidationErrors = (req: Request, res: Response, next: express.NextFunction): void => {
  const errors: Result<ValidationError> = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Missing required query parameter: keys',
        code: 'MISSING_PARAM',
      },
    });
    return;
  }
  next();
};

/*
  @desc    Get site configuration values
  @route   GET /v1/site-config
  @access  Public
*/
router.get(
  '/',
  optionalAdminRead(createAdminListHandler('site-config')),
  [
    query('keys').notEmpty().withMessage('Missing required query parameter: keys').isString(),
  ] as ValidationChain[],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const keysParam = req.query.keys as string;
    const keysMatch = keysParam
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    if (keysMatch.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Missing required query parameter: keys',
          code: 'MISSING_PARAM',
        },
      });
      return;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('site_config')
      .select('key, value')
      .in('key', keysMatch);

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: data || [],
    });
  })
);

/*
  @desc    Create site configuration value
  @route   POST /v1/site-config
  @access  Admin
*/
router.post('/', requireAdminUser, createAdminCreateHandler('site-config'));

/*
  @desc    Get single site configuration value
  @route   GET /v1/site-config/:id
  @access  Admin
*/
router.get(
  '/:id',
  requireAdminUser,
  adminSiteConfigKeyValidation,
  handleAdminValidationErrors,
  createAdminGetHandler('site-config')
);

/*
  @desc    Update site configuration value
  @route   PUT /v1/site-config/:id
  @access  Admin
*/
router.put(
  '/:id',
  requireAdminUser,
  adminSiteConfigKeyValidation,
  handleAdminValidationErrors,
  createAdminUpdateHandler('site-config')
);

/*
  @desc    Delete site configuration value
  @route   DELETE /v1/site-config/:id
  @access  Admin
*/
router.delete(
  '/:id',
  requireAdminUser,
  adminSiteConfigKeyValidation,
  handleAdminValidationErrors,
  createAdminDeleteHandler('site-config')
);

export default router;
