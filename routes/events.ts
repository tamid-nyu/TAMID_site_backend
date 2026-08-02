import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import {
  param,
  query,
  validationResult,
  type ValidationChain,
  type Result,
  type ValidationError,
} from 'express-validator';
import { Event } from '../models/index.js';
import { asyncHandler, requireAdminUser, validateInput } from '../middleware/index.js';
import {
  adminIdValidation,
  createAdminCreateHandler,
  createAdminDeleteHandler,
  createAdminGetHandler,
  createAdminListHandler,
  createAdminUpdateHandler,
  handleAdminValidationErrors,
} from './adminResource.js';
import { replaceEventFlyerHandler } from './eventFlyer.js';

const router = express.Router();

// Apply input validation middleware
router.use(validateInput);

// Query parameter types
interface EventsQuery {
  page?: string;
  limit?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  semester?: string;
  sort?: string;
}

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: express.NextFunction): void => {
  const errors: Result<ValidationError> = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array(),
      },
    });
    return;
  }
  next();
};

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

// @desc    Get all events with pagination and filtering
// @route   GET /v1/events
// @access  Public
router.get(
  '/',
  optionalAdminRead(createAdminListHandler('events')),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Search query cannot be empty'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO 8601 date'),
    query('semester')
      .optional()
      .trim()
      .matches(/^[FS]\d{2}$/)
      .withMessage('semester must be in format [F|S]YY'),
    query('sort')
      .optional()
      .matches(/^startTime:(asc|desc)$/)
      .withMessage('sort must be one of startTime:asc or startTime:desc'),
  ] as ValidationChain[],
  handleValidationErrors,
  asyncHandler(async (req: Request<object, object, object, EventsQuery>, res: Response) => {
    const { page = '1', limit = '10', search, startDate, endDate, semester, sort } = req.query;

    const result = await Event.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      startDate,
      endDate,
      semester,
      sort: sort as 'startTime:asc' | 'startTime:desc' | undefined,
    });

    res.status(200).json({
      success: true,
      count: result.events.length,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1,
      },
      data: result.events,
    });
  })
);

// @desc    Create event
// @route   POST /v1/events
// @access  Admin
router.post('/', requireAdminUser, createAdminCreateHandler('events'));

// @desc    Get upcoming events
// @route   GET /v1/events/upcoming
// @access  Public
router.get(
  '/upcoming',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ] as ValidationChain[],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 5;

    const events = await Event.findUpcoming(limit);

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  })
);

// @desc    Replace an event's full-size flyer and thumbnail
// @route   PUT /v1/events/:id/flyer
// @access  Admin
router.put(
  '/:id/flyer',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  asyncHandler(replaceEventFlyerHandler)
);

// @desc    Get single event
// @route   GET /v1/events/:id
// @access  Public
router.get(
  '/:id',
  optionalAdminRead(createAdminGetHandler('events')),
  [param('id').isUUID().withMessage('Invalid event ID')] as ValidationChain[],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const event = await Event.findById(req.params.id as string);

    if (!event) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Event not found',
          code: 'EVENT_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  })
);

// @desc    Update event
// @route   PUT /v1/events/:id
// @access  Admin
router.put(
  '/:id',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminUpdateHandler('events')
);

// @desc    Delete event
// @route   DELETE /v1/events/:id
// @access  Admin
router.delete(
  '/:id',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminDeleteHandler('events')
);

export default router;
