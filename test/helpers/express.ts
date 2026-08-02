import { jest } from '@jest/globals';
import type { Request, Response } from 'express';

export const createMockResponse = () => {
  const response = {
    statusCode: 200,
    status: jest.fn<(status: number) => Response>(),
    json: jest.fn<(body: unknown) => Response>(),
    send: jest.fn<(body: unknown) => Response>(),
    end: jest.fn<() => Response>(),
  } as unknown as Response & {
    status: jest.Mock<(status: number) => Response>;
    json: jest.Mock<(body: unknown) => Response>;
    send: jest.Mock<(body: unknown) => Response>;
    end: jest.Mock<() => Response>;
  };

  response.status.mockImplementation((status: number) => {
    response.statusCode = status;
    return response;
  });
  response.json.mockReturnValue(response);
  response.send.mockReturnValue(response);
  response.end.mockReturnValue(response);

  return response;
};

export const createMockRequest = ({
  body = {},
  params = {},
  query = {},
  headers = {},
  method = 'GET',
  originalUrl = '/',
}: {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  method?: string;
  originalUrl?: string;
} = {}) =>
  ({
    body,
    params,
    query,
    method,
    originalUrl,
    get: jest.fn((header: string) => headers[header] ?? headers[header.toLowerCase()]),
  }) as unknown as Request;
