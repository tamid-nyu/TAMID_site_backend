import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { errorHandler } from './errorHandler.js';

const createResponse = () => {
  const response = {
    statusCode: 200,
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

describe('errorHandler', () => {
  it('hides internal 500 details from client responses', () => {
    const request = {
      method: 'GET',
      originalUrl: '/v1/board-members',
      body: { internal: 'input' },
    } as Request;
    const response = createResponse();

    errorHandler(
      new Error('Failed to fetch board members: Could not connect to local Supabase'),
      request,
      response,
      jest.fn()
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  });

  it('keeps explicit client-safe 4xx errors descriptive', () => {
    const request = {
      method: 'GET',
      originalUrl: '/missing',
      body: {},
    } as Request;
    const response = createResponse();
    const error = new Error('Not found - /missing') as Error & { status: number; code: string };
    error.status = 404;
    error.code = 'NOT_FOUND';

    errorHandler(error, request, response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Not found - /missing',
        code: 'NOT_FOUND',
      },
    });
  });
});
