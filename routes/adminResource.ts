import { type Request, type Response } from 'express';
import { param, validationResult, type ValidationChain } from 'express-validator';
import { describeSupabaseError, getSupabaseAdmin } from '../config/supabase.js';
import { asyncHandler } from '../middleware/index.js';

export type AdminResourceKey =
  | 'board-members'
  | 'events'
  | 'members'
  | 'semesters'
  | 'contact-requests'
  | 'newsletter-signups'
  | 'site-config';

interface AdminResourceConfig {
  table: string;
  fields: Record<string, string>;
  primaryKey?: string;
  updateTimestampColumn?: string;
  orderBy?: string[];
  notFoundMessage: string;
  notFoundCode: string;
}

interface AdminQueryResult {
  data: unknown;
  error: {
    code?: string;
  } | null;
}

const resources: Record<AdminResourceKey, AdminResourceConfig> = {
  'board-members': {
    table: 'board_members',
    fields: {
      id: 'id',
      position: 'position',
      fullName: 'full_name',
      full_name: 'full_name',
      bio: 'bio',
      major: 'major',
      year: 'year',
      hometown: 'hometown',
      linkedinUrl: 'linkedin_url',
      linkedin_url: 'linkedin_url',
      email: 'email',
      headshotFile: 'headshot_file',
      headshot_file: 'headshot_file',
      headshotUpdatedAt: 'headshot_updated_at',
      headshot_updated_at: 'headshot_updated_at',
      orderIndex: 'order_index',
      order_index: 'order_index',
    },
    orderBy: ['order_index', 'full_name'],
    notFoundMessage: 'Board member not found',
    notFoundCode: 'BOARD_MEMBER_NOT_FOUND',
  },
  events: {
    table: 'events',
    fields: {
      id: 'id',
      createdAt: 'created_at',
      created_at: 'created_at',
      updatedAt: 'updated_at',
      updated_at: 'updated_at',
      title: 'title',
      company: 'company',
      startTime: 'start_time',
      start_time: 'start_time',
      endTime: 'end_time',
      end_time: 'end_time',
      location: 'location',
      flyerFile: 'flyer_file',
      flyer_file: 'flyer_file',
      rsvpLink: 'rsvp_link',
      rsvp_link: 'rsvp_link',
      description: 'description',
      isVisible: 'is_visible',
      is_visible: 'is_visible',
      semester: 'semester',
    },
    orderBy: ['start_time', 'created_at'],
    notFoundMessage: 'Event not found',
    notFoundCode: 'EVENT_NOT_FOUND',
  },
  members: {
    table: 'members',
    fields: {
      id: 'id',
      firstName: 'first_name',
      first_name: 'first_name',
      lastName: 'last_name',
      last_name: 'last_name',
      semester: 'semester',
      email: 'email',
    },
    orderBy: ['last_name', 'first_name'],
    notFoundMessage: 'Member not found',
    notFoundCode: 'MEMBER_NOT_FOUND',
  },
  semesters: {
    table: 'semesters',
    fields: {
      id: 'id',
      semesterName: 'semester_name',
      semester_name: 'semester_name',
    },
    orderBy: ['semester_name'],
    notFoundMessage: 'Semester not found',
    notFoundCode: 'SEMESTER_NOT_FOUND',
  },
  'contact-requests': {
    table: 'contact_requests',
    fields: {
      id: 'id',
      createdAt: 'created_at',
      created_at: 'created_at',
      firstName: 'first_name',
      first_name: 'first_name',
      lastName: 'last_name',
      last_name: 'last_name',
      email: 'email',
      company: 'company',
      message: 'message',
    },
    orderBy: ['created_at'],
    notFoundMessage: 'Contact request not found',
    notFoundCode: 'CONTACT_REQUEST_NOT_FOUND',
  },
  'newsletter-signups': {
    table: 'newsletter_signups',
    fields: {
      id: 'id',
      createdAt: 'created_at',
      created_at: 'created_at',
      firstName: 'first_name',
      first_name: 'first_name',
      lastName: 'last_name',
      last_name: 'last_name',
      email: 'email',
    },
    orderBy: ['created_at'],
    notFoundMessage: 'Newsletter signup not found',
    notFoundCode: 'NEWSLETTER_SIGNUP_NOT_FOUND',
  },
  'site-config': {
    table: 'site_config',
    primaryKey: 'key',
    updateTimestampColumn: 'updated_at',
    fields: {
      key: 'key',
      value: 'value',
      updatedAt: 'updated_at',
      updated_at: 'updated_at',
    },
    orderBy: ['key'],
    notFoundMessage: 'Site configuration item not found',
    notFoundCode: 'SITE_CONFIG_NOT_FOUND',
  },
};

export const adminIdValidation = [
  param('id').isUUID().withMessage('Invalid resource ID'),
] as ValidationChain[];

export const adminSiteConfigKeyValidation = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Invalid site configuration key')
    .matches(/^[A-Za-z0-9_.:-]+$/)
    .withMessage('Invalid site configuration key'),
] as ValidationChain[];

export const handleAdminValidationErrors = (
  req: Request,
  res: Response,
  next: import('express').NextFunction
): void => {
  const errors = validationResult(req);
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

const getResource = (resourceKey: AdminResourceKey): AdminResourceConfig => resources[resourceKey];

const sendNotFound = (res: Response, resource: AdminResourceConfig): void => {
  res.status(404).json({
    success: false,
    error: {
      message: resource.notFoundMessage,
      code: resource.notFoundCode,
    },
  });
};

const toDatabasePayload = (
  resource: AdminResourceConfig,
  body: Record<string, unknown>,
  mode: 'create' | 'update'
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  for (const [requestField, column] of Object.entries(resource.fields)) {
    if (requestField === 'id' || (mode === 'update' && column === (resource.primaryKey ?? 'id'))) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(body, requestField)) {
      payload[column] = body[requestField];
    }
  }

  if (resource.table === 'events') {
    const now = new Date().toISOString();
    if (mode === 'create') {
      payload.created_at ??= now;
    }
    payload.updated_at ??= now;
  }

  if (resource.table === 'board_members' && payload.headshot_file !== undefined) {
    payload.headshot_updated_at = new Date().toISOString();
  }

  if (resource.updateTimestampColumn) {
    payload[resource.updateTimestampColumn] ??= new Date().toISOString();
  }

  return payload;
};

const toApiPayload = (
  resource: AdminResourceConfig,
  row: Record<string, unknown>
): Record<string, unknown> => {
  const apiPayload: Record<string, unknown> = {};
  const seenColumns = new Set<string>();

  for (const [requestField, column] of Object.entries(resource.fields)) {
    if (requestField.includes('_') && requestField !== column) {
      continue;
    }
    if (!seenColumns.has(column) && Object.prototype.hasOwnProperty.call(row, column)) {
      apiPayload[requestField] = row[column];
      seenColumns.add(column);
    }
  }

  return apiPayload;
};

export const createAdminListHandler = (resourceKey: AdminResourceKey) =>
  asyncHandler(async (_req: Request, res: Response) => {
    const resource = getResource(resourceKey);
    const supabase = getSupabaseAdmin();
    let query = supabase.from(resource.table).select('*');

    for (const column of resource.orderBy ?? []) {
      query = query.order(column, { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list ${resource.table}: ${describeSupabaseError(error)}`);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((row) => toApiPayload(resource, row)),
    });
  });

export const createAdminGetHandler = (resourceKey: AdminResourceKey) =>
  asyncHandler(async (req: Request, res: Response) => {
    const resource = getResource(resourceKey);
    const supabase = getSupabaseAdmin();
    const primaryKey = resource.primaryKey ?? 'id';
    const result = (await supabase
      .from(resource.table)
      .select('*')
      .eq(primaryKey, req.params.id as string)
      .single()) as AdminQueryResult;

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        sendNotFound(res, resource);
        return;
      }
      throw new Error(`Failed to fetch ${resource.table}: ${describeSupabaseError(result.error)}`);
    }

    res.status(200).json({
      success: true,
      data: toApiPayload(resource, result.data as Record<string, unknown>),
    });
  });

export const createAdminCreateHandler = (resourceKey: AdminResourceKey) =>
  asyncHandler(async (req: Request, res: Response) => {
    const resource = getResource(resourceKey);
    const payload = toDatabasePayload(resource, req.body as Record<string, unknown>, 'create');
    const supabase = getSupabaseAdmin();
    const result = (await supabase
      .from(resource.table)
      .insert(payload)
      .select('*')
      .single()) as AdminQueryResult;

    if (result.error) {
      throw new Error(`Failed to create ${resource.table}: ${describeSupabaseError(result.error)}`);
    }

    res.status(201).json({
      success: true,
      data: toApiPayload(resource, result.data as Record<string, unknown>),
    });
  });

export const createAdminUpdateHandler = (resourceKey: AdminResourceKey) =>
  asyncHandler(async (req: Request, res: Response) => {
    const resource = getResource(resourceKey);
    const payload = toDatabasePayload(resource, req.body as Record<string, unknown>, 'update');
    if (Object.keys(payload).length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'At least one updatable field is required',
          code: 'ADMIN_EMPTY_UPDATE',
        },
      });
      return;
    }

    const supabase = getSupabaseAdmin();
    const primaryKey = resource.primaryKey ?? 'id';
    const result = (await supabase
      .from(resource.table)
      .update(payload)
      .eq(primaryKey, req.params.id as string)
      .select('*')
      .single()) as AdminQueryResult;

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        sendNotFound(res, resource);
        return;
      }
      throw new Error(`Failed to update ${resource.table}: ${describeSupabaseError(result.error)}`);
    }

    res.status(200).json({
      success: true,
      data: toApiPayload(resource, result.data as Record<string, unknown>),
    });
  });

export const createAdminDeleteHandler = (resourceKey: AdminResourceKey) =>
  asyncHandler(async (req: Request, res: Response) => {
    const resource = getResource(resourceKey);
    const supabase = getSupabaseAdmin();
    const primaryKey = resource.primaryKey ?? 'id';
    const result = (await supabase
      .from(resource.table)
      .delete()
      .eq(primaryKey, req.params.id as string)
      .select('*')
      .single()) as AdminQueryResult;

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        sendNotFound(res, resource);
        return;
      }
      if (resourceKey === 'semesters' && result.error.code === '23503') {
        res.status(409).json({
          success: false,
          error: {
            message:
              'This semester is still assigned to one or more events or members. Reassign those records before deleting it.',
            code: 'SEMESTER_IN_USE',
          },
        });
        return;
      }
      throw new Error(`Failed to delete ${resource.table}: ${describeSupabaseError(result.error)}`);
    }

    res.status(200).json({
      success: true,
      data: toApiPayload(resource, result.data as Record<string, unknown>),
    });
  });
