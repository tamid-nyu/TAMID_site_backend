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

router.get('/', createAdminListHandler('contact-requests'));
router.post('/', createAdminCreateHandler('contact-requests'));
router.get(
  '/:id',
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminGetHandler('contact-requests')
);
router.put(
  '/:id',
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminUpdateHandler('contact-requests')
);
router.delete(
  '/:id',
  adminIdValidation,
  handleAdminValidationErrors,
  createAdminDeleteHandler('contact-requests')
);

export default router;
