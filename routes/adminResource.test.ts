import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { createSupabaseQueryMock, type SupabaseQueryMock } from '../test/helpers/supabase.js';

jest.unstable_mockModule('../config/supabase.js', () => ({
  describeSupabaseError: (error: unknown) => String(error),
  getSupabase: jest.fn(),
  getSupabaseAdmin: jest.fn(),
}));

jest.unstable_mockModule('../middleware/index.js', () => ({
  asyncHandler: (handler: unknown) => handler,
  requireAdminUser: function requireAdminUser() {
    return undefined;
  },
  validateInput: function validateInput() {
    return undefined;
  },
}));

const getRouteSurface = (router: unknown): Array<{ path: string; methods: string[] }> => {
  const stack = (
    router as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }
  ).stack;

  return stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route!.path,
      methods: Object.entries(layer.route!.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => method),
    }));
};

describe('resource admin methods', () => {
  it.each([
    ['board members', './boardMembers.js'],
    ['events', './events.js'],
    ['members', './members.js'],
    ['semesters', './semesters.js'],
    ['contact requests', './contactRequests.js'],
    ['newsletter signups', './newsletterSignups.js'],
    ['site config', './siteConfig.js'],
  ])(
    '%s router exposes admin write methods on the resource endpoint',
    async (_label, modulePath) => {
      const { default: router } = (await import(modulePath)) as { default: unknown };
      const routeSurface = getRouteSurface(router);

      expect(routeSurface).toEqual(
        expect.arrayContaining([
          { path: '/', methods: ['post'] },
          { path: '/:id', methods: ['put'] },
          { path: '/:id', methods: ['delete'] },
        ])
      );
    }
  );
});

describe('site config admin resource', () => {
  it('updates site configuration values by key without changing the key column', async () => {
    const siteConfigQuery = createSupabaseQueryMock({
      data: {
        key: 'heroTitle',
        value: 'New title',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
      error: null,
    });
    const from = jest.fn<(table: string) => SupabaseQueryMock>(() => siteConfigQuery);
    const { getSupabaseAdmin } = (await import('../config/supabase.js')) as unknown as {
      getSupabaseAdmin: jest.Mock<() => { from: typeof from }>;
    };
    getSupabaseAdmin.mockReturnValue({ from });

    const { createAdminUpdateHandler } = await import('./adminResource.js');
    const handler = createAdminUpdateHandler('site-config') as unknown as (
      req: Request,
      res: Response
    ) => Promise<void>;
    const req = {
      body: { key: 'ignoredKey', value: 'New title' },
      params: { id: 'heroTitle' },
    } as unknown as Request;
    const status = jest.fn<(statusCode: number) => Response>().mockReturnThis();
    const json = jest.fn<(body: unknown) => Response>().mockReturnThis();
    const res = {
      status,
      json,
    } as unknown as Response;

    await handler(req, res);

    expect(from).toHaveBeenCalledWith('site_config');
    expect(siteConfigQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'New title', updated_at: expect.any(String) })
    );
    expect(siteConfigQuery.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.anything() })
    );
    expect(siteConfigQuery.eq).toHaveBeenCalledWith('key', 'heroTitle');
    expect(status).toHaveBeenCalledWith(200);
  });
});

describe('board member admin resource', () => {
  it('advances the headshot version when the headshot field is saved', async () => {
    const boardMemberQuery = createSupabaseQueryMock({
      data: {
        id: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9',
        headshot_file: 'ada.jpg',
        headshot_updated_at: '2026-07-23T00:00:00.000Z',
      },
      error: null,
    });
    const from = jest.fn<(table: string) => SupabaseQueryMock>(() => boardMemberQuery);
    const { getSupabaseAdmin } = (await import('../config/supabase.js')) as unknown as {
      getSupabaseAdmin: jest.Mock<() => { from: typeof from }>;
    };
    getSupabaseAdmin.mockReturnValue({ from });

    const { createAdminUpdateHandler } = await import('./adminResource.js');
    const handler = createAdminUpdateHandler('board-members') as unknown as (
      req: Request,
      res: Response
    ) => Promise<void>;
    const req = {
      body: { headshotFile: 'ada.jpg' },
      params: { id: 'dbc59546-fdd5-48f5-81ff-c1ec6e5efde9' },
    } as unknown as Request;
    const status = jest.fn<(statusCode: number) => Response>().mockReturnThis();
    const json = jest.fn<(body: unknown) => Response>().mockReturnThis();
    const res = { status, json } as unknown as Response;

    await handler(req, res);

    expect(from).toHaveBeenCalledWith('board_members');
    expect(boardMemberQuery.update).toHaveBeenCalledWith({
      headshot_file: 'ada.jpg',
      headshot_updated_at: expect.any(String),
    });
    expect(status).toHaveBeenCalledWith(200);
  });
});

describe('semester admin resource', () => {
  it('returns a conflict instead of an internal error when the semester is still referenced', async () => {
    const semesterQuery = createSupabaseQueryMock({
      data: null,
      error: { code: '23503', message: 'foreign key violation' },
    });
    const from = jest.fn<(table: string) => SupabaseQueryMock>(() => semesterQuery);
    const { getSupabaseAdmin } = (await import('../config/supabase.js')) as unknown as {
      getSupabaseAdmin: jest.Mock<() => { from: typeof from }>;
    };
    getSupabaseAdmin.mockReturnValue({ from });

    const { createAdminDeleteHandler } = await import('./adminResource.js');
    const handler = createAdminDeleteHandler('semesters') as unknown as (
      req: Request,
      res: Response
    ) => Promise<void>;
    const req = { params: { id: 'semester-1' } } as unknown as Request;
    const status = jest.fn<(statusCode: number) => Response>().mockReturnThis();
    const json = jest.fn<(body: unknown) => Response>().mockReturnThis();
    const res = { status, json } as unknown as Response;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        message:
          'This semester is still assigned to one or more events or members. Reassign those records before deleting it.',
        code: 'SEMESTER_IN_USE',
      },
    });
  });
});
