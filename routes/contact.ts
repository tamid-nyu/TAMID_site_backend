import express, { type Request, type Response } from 'express';
import {
  body,
  validationResult,
  type ValidationChain,
  type Result,
  type ValidationError,
} from 'express-validator';
import { ContactForm } from '../models/index.js';
import { asyncHandler, validateInput } from '../middleware/index.js';
import { logger } from '../logger.js';

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
        details: errors.array().map((err) => ({
          field: 'path' in err ? err.path : undefined,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          message: err.msg,
        })),
      },
    });
    return;
  }
  next();
};

/*
  @desc    Submit contact form
  @route   POST /v1/contact
  @access  Public
*/

router.post(
  '/',
  [
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .trim()
      .isLength({ max: 100 })
      .withMessage('First name must be less than 100 characters'),
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .trim()
      .isLength({ max: 100 })
      .withMessage('Last name must be less than 100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
    body('company')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Company must be less than 255 characters'),
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Message must be less than 5000 characters'),
  ] as ValidationChain[],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { firstName, lastName, email, company, message } = req.body as {
      firstName: string;
      lastName: string;
      email: string;
      company?: string;
      message: string;
    };

    // Create the contact submission
    const contactData = {
      first_name: firstName,
      last_name: lastName,
      email,
      company: company || null,
      message,
    };

    const contactSubmission = await ContactForm.create(contactData);

    if (!contactSubmission) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to save contact submission',
          code: 'SAVE_FAILED',
        },
      });
      return;
    }

    // Send notification email - must await in serverless environment
    // to ensure email completes before function context is frozen
    try {
      const emailSent = await contactSubmission.sendNotificationEmail();
      if (!emailSent) {
        throw new Error('Email sending returned false');
      }
    } catch (error) {
      logger.error({
        message: 'Failed to send contact notification email',
        error: error instanceof Error ? error.message : 'Unknown error',
        submissionId: contactSubmission.id,
      });
      res.status(500).json({
        success: false,
        error: {
          message:
            'Failed to send notification email. Please try again later or contact us directly at tamid@nyu.edu.',
          code: 'EMAIL_SEND_FAILED',
        },
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Thank you for your message. We will get back to you soon!',
      data: {
        success: true,
        message: 'Message sent successfully',
      },
    });
  })
);

export default router;
