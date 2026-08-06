import express, { type Request, type Response } from 'express';
import { Member, type BulkMemberInput } from '../models/index.js';
import { asyncHandler, requireAdminUser, validateInput } from '../middleware/index.js';
import {
  adminIdValidation,
  createAdminCreateHandler,
  createAdminDeleteHandler,
  createAdminUpdateHandler,
  handleAdminValidationErrors,
} from './adminResource.js';

const router = express.Router();

// Apply input validation middleware
router.use(validateInput);

/*
  @desc    Get all members
  @route   GET /v1/members
  @access  Public
*/
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const members = await Member.findAll();

    res.status(200).json({
      success: true,
      count: members.length,
      data: members.map((member) => Member.toJSON(member.toDatabase())),
    });
  })
);

/*
  @desc    Create member
  @route   POST /v1/members
  @access  Admin
*/
router.post('/', requireAdminUser, createAdminCreateHandler('members'));

/*
  @desc    Bulk-create members from a parsed roster
  @route   POST /v1/members/bulk
  @access  Admin
*/
router.post(
  '/bulk',
  requireAdminUser,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { members?: unknown };

    if (!Array.isArray(body.members)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Request body must include a "members" array',
          code: 'VALIDATION_ERROR',
        },
      });
      return;
    }

    if (body.members.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'The "members" array must not be empty',
          code: 'VALIDATION_ERROR',
        },
      });
      return;
    }

    const summary = await Member.bulkCreate(body.members as BulkMemberInput[]);

    res.status(200).json({
      success: true,
      data: summary,
    });
  })
);

/*
  @desc    Update member
  @route   PUT /v1/members/:id
  @access  Admin
*/
router.put(
  '/:id',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminUpdateHandler('members')
);

/*
  @desc    Delete member
  @route   DELETE /v1/members/:id
  @access  Admin
*/
router.delete(
  '/:id',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminDeleteHandler('members')
);

export default router;
