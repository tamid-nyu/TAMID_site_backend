import express, { type Request, type Response } from 'express';
import {
  param,
  validationResult,
  type ValidationChain,
  type Result,
  type ValidationError,
} from 'express-validator';
import { BoardMember } from '../models/index.js';
import { asyncHandler, requireAdminUser, validateInput } from '../middleware/index.js';
import {
  adminIdValidation,
  createAdminCreateHandler,
  createAdminDeleteHandler,
  createAdminUpdateHandler,
  handleAdminValidationErrors,
} from './adminResource.js';
import { replaceBoardMemberHeadshotHandler } from './boardMemberHeadshot.js';

const router = express.Router();

// Apply input validation middleware
router.use(validateInput);

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

/*
  @desc    Get all board members
  @route   GET /v1/board-members
  @access  Public
*/
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const boardMembers = await BoardMember.findAll();

    res.status(200).json({
      success: true,
      count: boardMembers.length,
      data: boardMembers.map((member) => BoardMember.toJSON(member.toDatabase())),
    });
  })
);

/*
  @desc    Create board member
  @route   POST /v1/board-members
  @access  Admin
*/
router.post('/', requireAdminUser, createAdminCreateHandler('board-members'));

/*
  @desc    Replace a board member's full-size headshot and thumbnail
  @route   PUT /v1/board-members/:id/headshot
  @access  Admin
*/
router.put(
  '/:id/headshot',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  asyncHandler(replaceBoardMemberHeadshotHandler)
);

/*
  @desc    Get single board member
  @route   GET /v1/board-members/:id
  @access  Public
*/
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid board member ID')] as ValidationChain[],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const boardMember = await BoardMember.findById(req.params.id as string);

    if (!boardMember) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Board member not found',
          code: 'BOARD_MEMBER_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: BoardMember.toJSON(boardMember.toDatabase()),
    });
  })
);

/*
  @desc    Update board member
  @route   PUT /v1/board-members/:id
  @access  Admin
*/
router.put(
  '/:id',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminUpdateHandler('board-members')
);

/*
  @desc    Delete board member
  @route   DELETE /v1/board-members/:id
  @access  Admin
*/
router.delete(
  '/:id',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminDeleteHandler('board-members')
);

export default router;
