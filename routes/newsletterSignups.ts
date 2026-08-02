import express from 'express';
import { requireAdminUser, validateInput } from '../middleware/index.js';
import {
  adminIdValidation,
  createAdminCreateHandler,
  createAdminDeleteHandler,
  createAdminGetHandler,
  createAdminListHandler,
  createAdminUpdateHandler,
  handleAdminValidationErrors,
} from './adminResource.js';

const router = express.Router();

router.use(validateInput);
router.use(requireAdminUser);

router.get('/', createAdminListHandler('newsletter-signups'));
router.post('/', createAdminCreateHandler('newsletter-signups'));
router.get(
  '/:id',
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminGetHandler('newsletter-signups')
);
router.put(
  '/:id',
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminUpdateHandler('newsletter-signups')
);
router.delete(
  '/:id',
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminDeleteHandler('newsletter-signups')
);

export default router;
