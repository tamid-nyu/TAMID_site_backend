import express, { type Request, type Response } from 'express';
import { Member } from '../models/index.js';
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
