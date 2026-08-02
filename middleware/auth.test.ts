import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

const getUser = jest.fn<(token: string) => Promise<unknown>>();

jest.unstable_mockModule('../config/supabase.js', () => ({
  getSupabase: () => ({
    auth: {
      getUser,
    },
  }),
}));

jest.unstable_mockModule('../logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const createResponse = () => {
  const response = {
    status: jest.fn<(status: number) => Response>(),
    json: jest.fn<(body: unknown) => Response>(),
  } as unknown as Response & {
    status: jest.Mock<(status: number) => Response>;
    json: jest.Mock<(body: unknown) => Response>;
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
};

const createRequest = () =>
  ({
    get: jest.fn((header: string) => (header === 'Authorization' ? 'Bearer token' : undefined)),
    originalUrl: '/v1/events',
  }) as unknown as Request;

describe('requireAdminUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows users with an admin role in app_metadata', async () => {
    const { requireAdminUser } = await import('./auth.js');
    getUser.mockResolvedValue({
      data: { user: { id: 'user-id', app_metadata: { role: 'admin' }, user_metadata: {} } },
      error: null,
    });
    const next = jest.fn();

    await requireAdminUser(createRequest(), createResponse(), next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects users who only claim admin in user_metadata', async () => {
    const { requireAdminUser } = await import('./auth.js');
    getUser.mockResolvedValue({
      data: { user: { id: 'user-id', app_metadata: {}, user_metadata: { role: 'admin' } } },
      error: null,
    });
    const response = createResponse();

    await requireAdminUser(createRequest(), response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED',
      },
    });
  });
});
