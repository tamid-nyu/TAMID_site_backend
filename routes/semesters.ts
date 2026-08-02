import express, { type Request, type Response } from 'express';
import { Semester } from '../models/index.js';
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
  @desc    Get all semesters
  @route   GET /v1/semesters
  @access  Public
*/
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const semesters = await Semester.findAll();

    res.status(200).json({
      success: true,
      count: semesters.length,
      data: semesters.map((semester) => Semester.toJSON(semester.toDatabase())),
    });
  })
);

/*
  @desc    Create semester
  @route   POST /v1/semesters
  @access  Admin
*/
router.post('/', requireAdminUser, createAdminCreateHandler('semesters'));

/*
  @desc    Update semester
  @route   PUT /v1/semesters/:id
  @access  Admin
*/
router.put(
  '/:id',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminUpdateHandler('semesters')
);

/*
  @desc    Delete semester
  @route   DELETE /v1/semesters/:id
  @access  Admin
*/
router.delete(
  '/:id',
  requireAdminUser,
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminDeleteHandler('semesters')
);

export default router;
