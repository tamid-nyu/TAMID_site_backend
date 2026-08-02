import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { createSupabaseQueryMock } from '../test/helpers/supabase.js';

const getErrorCode = (body: unknown): unknown => (body as { error: { code: unknown } }).error.code;

const buildApp = async (routerModulePath: string, mountPath: string) => {
  const { default: router } = (await import(routerModulePath)) as { default: express.Router };
  const { errorHandler } = await import('../middleware/errorHandler.js');
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  app.use(errorHandler as (err: Error, req: Request, res: Response, next: NextFunction) => void);
  return app;
};

const mockLogger = () => {
  jest.unstable_mockModule('../logger.js', () => ({
    logger: {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    },
  }));
};

const mockMiddleware = () => {
  jest.unstable_mockModule('../middleware/index.js', () => ({
    asyncHandler:
      (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
      (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(handler(req, res, next)).catch(next);
      },
    requireAdminUser: (_req: Request, _res: Response, next: NextFunction) => next(),
    validateInput: (req: Request, _res: Response, next: NextFunction) => {
      const sanitize = (value: unknown): unknown => {
        if (typeof value === 'string') {
          return value.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
        if (Array.isArray(value)) {
          return value.map(sanitize);
        }
        if (value !== null && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
              key,
              sanitize(entry),
            ])
          );
        }
        return value;
      };
      req.body = sanitize(req.body);
      req.query = sanitize(req.query) as typeof req.query;
      next();
    },
  }));
};

describe('events routes', () => {
  const findAll = jest.fn<(options: unknown) => Promise<unknown>>();
  const findUpcoming = jest.fn<(limit: number) => Promise<unknown>>();
  const findById = jest.fn<(id: string) => Promise<unknown>>();
  const adminQuery = createSupabaseQueryMock({
    data: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Hidden Admin Event',
        company: 'TAMID',
        start_time: '2026-07-01T17:00:00.000Z',
        end_time: '2026-07-01T18:00:00.000Z',
        location: 'KMC',
        is_visible: false,
        semester: 'F26',
      },
    ],
    error: null,
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockLogger();
    mockMiddleware();
    jest.unstable_mockModule('../models/index.js', () => ({
      Event: { findAll, findUpcoming, findById },
    }));
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabaseAdmin: jest.fn(() => ({
        from: jest.fn(() => adminQuery),
      })),
    }));
  });

  it('returns paginated public events using default start-time sorting', async () => {
    findAll.mockResolvedValue({
      events: [{ id: 'event-1', title: 'Lunch' }],
      page: 2,
      limit: 5,
      total: 12,
      totalPages: 3,
    });
    const app = await buildApp('./events.js', '/v1/events');

    await request(app)
      .get(
        '/v1/events?page=2&limit=5&search=lunch&startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T00:00:00.000Z&semester=F26'
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          count: 1,
          pagination: {
            page: 2,
            limit: 5,
            total: 12,
            totalPages: 3,
            hasNext: true,
            hasPrev: true,
          },
          data: [{ id: 'event-1', title: 'Lunch' }],
        });
      });

    expect(findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      search: 'lunch',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      semester: 'F26',
      sort: undefined,
    });
  });

  it('rejects invalid event filters before calling the model', async () => {
    const app = await buildApp('./events.js', '/v1/events');

    await request(app)
      .get('/v1/events?limit=101&sort=createdAt:desc')
      .expect(400)
      .expect(({ body }) => {
        expect(getErrorCode(body)).toBe('VALIDATION_ERROR');
      });

    expect(findAll).not.toHaveBeenCalled();
  });

  it('returns upcoming events and validates upcoming limits', async () => {
    findUpcoming.mockResolvedValue([{ id: 'event-2', title: 'Panel' }]);
    const app = await buildApp('./events.js', '/v1/events');

    await request(app)
      .get('/v1/events/upcoming?limit=3')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          count: 1,
          data: [{ id: 'event-2', title: 'Panel' }],
        });
      });
    expect(findUpcoming).toHaveBeenCalledWith(3);

    await request(app).get('/v1/events/upcoming?limit=51').expect(400);
  });

  it('returns 400 for invalid event IDs and 404 for missing public events', async () => {
    const app = await buildApp('./events.js', '/v1/events');

    await request(app).get('/v1/events/not-a-uuid').expect(400);

    findById.mockResolvedValue(null);
    await request(app)
      .get('/v1/events/11111111-1111-4111-8111-111111111111')
      .expect(404)
      .expect(({ body }) => {
        expect(getErrorCode(body)).toBe('EVENT_NOT_FOUND');
      });
  });

  it('uses the admin read path when an authorization header is present', async () => {
    const app = await buildApp('./events.js', '/v1/events');

    await request(app)
      .get('/v1/events')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          count: 1,
          data: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Hidden Admin Event' }],
        });
      });

    expect(findAll).not.toHaveBeenCalled();
    expect(adminQuery.order).toHaveBeenCalledWith('start_time', { ascending: true });
  });
});

describe('contact route', () => {
  const sendNotificationEmail = jest.fn<() => Promise<boolean>>();
  const createContact = jest.fn<(payload: unknown) => Promise<unknown>>();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockLogger();
    mockMiddleware();
    jest.unstable_mockModule('../models/index.js', () => ({
      ContactForm: {
        create: createContact,
      },
    }));
  });

  it('validates required contact fields', async () => {
    const app = await buildApp('./contact.js', '/v1/contact');

    await request(app)
      .post('/v1/contact')
      .send({ email: 'bad-email' })
      .expect(400)
      .expect(({ body }) => {
        const error = body as { error: { code: unknown; details: unknown } };
        expect(error.error.code).toBe('VALIDATION_ERROR');
        expect(error.error.details).toEqual(
          expect.arrayContaining([
            { field: 'firstName', message: 'First name is required' },
            { field: 'lastName', message: 'Last name is required' },
            { field: 'message', message: 'Message is required' },
          ])
        );
      });

    expect(createContact).not.toHaveBeenCalled();
  });

  it('saves a contact request and sends notification email', async () => {
    sendNotificationEmail.mockResolvedValue(true);
    createContact.mockResolvedValue({
      id: 'contact-id',
      sendNotificationEmail,
    });
    const app = await buildApp('./contact.js', '/v1/contact');

    await request(app)
      .post('/v1/contact')
      .send({
        firstName: ' John ',
        lastName: ' Doe ',
        email: 'JDOE@stern.nyu.edu',
        company: '',
        message: ' Hello <script>alert(1)</script>',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: {
            success: true,
            message: 'Message sent successfully',
          },
        });
      });

    expect(createContact).toHaveBeenCalledWith({
      first_name: 'John',
      last_name: 'Doe',
      email: 'jdoe@stern.nyu.edu',
      company: null,
      message: 'Hello',
    });
    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it('returns explicit failures for save and email errors', async () => {
    const app = await buildApp('./contact.js', '/v1/contact');
    const payload = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'jdoe@stern.nyu.edu',
      message: 'Hello',
    };

    createContact.mockResolvedValueOnce(null);
    await request(app)
      .post('/v1/contact')
      .send(payload)
      .expect(500)
      .expect(({ body }) => {
        expect(getErrorCode(body)).toBe('SAVE_FAILED');
      });

    sendNotificationEmail.mockResolvedValueOnce(false);
    createContact.mockResolvedValueOnce({ id: 'contact-id', sendNotificationEmail });
    await request(app)
      .post('/v1/contact')
      .send(payload)
      .expect(500)
      .expect(({ body }) => {
        expect(getErrorCode(body)).toBe('EMAIL_SEND_FAILED');
      });
  });
});

describe('newsletter route', () => {
  const createSignup = jest.fn<(payload: unknown) => Promise<unknown>>();
  const addSubscriber =
    jest.fn<(email: string, firstName: string, lastName: string) => Promise<void>>();
  const removeSubscriber = jest.fn<(email: string) => Promise<void>>();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockLogger();
    mockMiddleware();
    jest.unstable_mockModule('../models/index.js', () => ({
      NewsletterSignup: {
        create: createSignup,
      },
    }));
    jest.unstable_mockModule('../config/index.js', () => ({
      addSubscriber,
      removeSubscriber,
    }));
  });

  it('requires an NYU email address', async () => {
    const app = await buildApp('./newsletter.js', '/v1/newsletter-sign-ups');

    await request(app)
      .post('/v1/newsletter-sign-ups')
      .send({ email: 'person@example.com', first_name: 'John', last_name: 'Doe' })
      .expect(400)
      .expect(({ body }) => {
        expect(getErrorCode(body)).toBe('VALIDATION_ERROR');
      });

    expect(addSubscriber).not.toHaveBeenCalled();
    expect(createSignup).not.toHaveBeenCalled();
  });

  it('does not write to the database when Mailchimp fails', async () => {
    addSubscriber.mockRejectedValue(new Error('mailchimp down'));
    const app = await buildApp('./newsletter.js', '/v1/newsletter-sign-ups');

    await request(app)
      .post('/v1/newsletter-sign-ups')
      .send({ email: 'jdoe@stern.nyu.edu', first_name: 'John', last_name: 'Doe' })
      .expect(500)
      .expect(({ body }) => {
        expect(getErrorCode(body)).toBe('MAILCHIMP_ERROR');
      });

    expect(createSignup).not.toHaveBeenCalled();
  });

  it('returns duplicate conflicts without Mailchimp rollback', async () => {
    addSubscriber.mockResolvedValue(undefined);
    createSignup.mockRejectedValue(new Error('Email is already subscribed to the newsletter'));
    const app = await buildApp('./newsletter.js', '/v1/newsletter-sign-ups');

    await request(app)
      .post('/v1/newsletter-sign-ups')
      .send({ email: 'jdoe@stern.nyu.edu', first_name: 'John', last_name: 'Doe' })
      .expect(409)
      .expect(({ body }) => {
        expect(getErrorCode(body)).toBe('NEWSLETTER_SIGNUP_DUPLICATE');
      });

    expect(removeSubscriber).not.toHaveBeenCalled();
  });

  it('rolls back Mailchimp when database creation fails after subscription', async () => {
    addSubscriber.mockResolvedValue(undefined);
    removeSubscriber.mockResolvedValue(undefined);
    createSignup.mockRejectedValue(new Error('database unavailable'));
    const app = await buildApp('./newsletter.js', '/v1/newsletter-sign-ups');

    await request(app)
      .post('/v1/newsletter-sign-ups')
      .send({ email: 'jdoe@stern.nyu.edu', first_name: 'John', last_name: 'Doe' })
      .expect(500)
      .expect(({ body }) => {
        expect(getErrorCode(body)).toBe('DATABASE_ERROR');
      });

    expect(removeSubscriber).toHaveBeenCalledWith('jdoe@stern.nyu.edu');
  });

  it('creates a signup after Mailchimp subscription succeeds', async () => {
    addSubscriber.mockResolvedValue(undefined);
    createSignup.mockResolvedValue({
      toJSON: () => ({
        email: 'jdoe@stern.nyu.edu',
        firstName: 'John',
        lastName: 'Doe',
      }),
    });
    const app = await buildApp('./newsletter.js', '/v1/newsletter-sign-ups');

    await request(app)
      .post('/v1/newsletter-sign-ups')
      .send({ email: 'JDOE@stern.nyu.edu', first_name: 'John', last_name: 'Doe' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: { email: 'jdoe@stern.nyu.edu' },
        });
      });

    expect(addSubscriber).toHaveBeenCalledWith('jdoe@stern.nyu.edu', 'John', 'Doe');
    expect(createSignup).toHaveBeenCalledWith({
      email: 'jdoe@stern.nyu.edu',
      first_name: 'John',
      last_name: 'Doe',
    });
  });
});

describe('site-config route', () => {
  const siteConfigQuery = createSupabaseQueryMock({
    data: [{ key: 'heroTitle', value: 'TAMID' }],
    error: null,
  });
  const siteConfigAdminQuery = createSupabaseQueryMock({
    data: [{ key: 'heroTitle', value: 'TAMID', updated_at: '2026-06-01T00:00:00.000Z' }],
    error: null,
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockMiddleware();
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(() => ({
        from: jest.fn(() => siteConfigQuery),
      })),
      getSupabaseAdmin: jest.fn(() => ({
        from: jest.fn(() => siteConfigAdminQuery),
      })),
    }));
  });

  it('requires non-empty keys', async () => {
    const app = await buildApp('./siteConfig.js', '/v1/site-config');

    await request(app).get('/v1/site-config').expect(400);
    await request(app).get('/v1/site-config?keys=,%20').expect(400);
  });

  it('returns requested site configuration values', async () => {
    const app = await buildApp('./siteConfig.js', '/v1/site-config');

    await request(app)
      .get('/v1/site-config?keys=heroTitle,footerText')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: true,
          data: [{ key: 'heroTitle', value: 'TAMID' }],
        });
      });

    expect(siteConfigQuery.in).toHaveBeenCalledWith('key', ['heroTitle', 'footerText']);
  });

  it('uses the admin list path when an authorization header is present', async () => {
    const app = await buildApp('./siteConfig.js', '/v1/site-config');

    await request(app)
      .get('/v1/site-config')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: true,
          count: 1,
          data: [
            {
              key: 'heroTitle',
              value: 'TAMID',
              updatedAt: '2026-06-01T00:00:00.000Z',
            },
          ],
        });
      });

    expect(siteConfigAdminQuery.order).toHaveBeenCalledWith('key', { ascending: true });
    expect(siteConfigQuery.in).not.toHaveBeenCalled();
  });
});
