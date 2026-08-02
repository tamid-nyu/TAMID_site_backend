import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../logger.js';

interface AppError extends Error {
  status?: number;
  code?: string;
}

interface ErrorResponse {
  message: string;
  status?: number;
  code?: string;
}

const isInternalServerError = (status: number): boolean => status >= 500;

// Express error handlers must have 4 parameters for Express to recognize them
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler = (err: AppError, req: Request, res: Response, _next: NextFunction): void => {
  const status = err.status || (res.statusCode >= 400 ? res.statusCode : 500);
  let error: ErrorResponse = { message: err.message, status, code: err.code };

  // Log error
  logger.error({
    message: `Error: ${err.message}`,
    err: {
      type: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      status,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
    },
  });

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    error = {
      message: 'CORS policy violation',
      status: 403,
      code: 'CORS_ERROR',
    };
  }

  // Rate limit error
  if (err.message && err.message.includes('Too many requests')) {
    error = {
      message: 'Rate limit exceeded',
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
    };
  }

  if (isInternalServerError(error.status || status)) {
    error = {
      message: 'Internal server error',
      status,
      code: 'INTERNAL_SERVER_ERROR',
    };
  }

  res.status(error.status || 500).json({
    success: false,
    error: {
      message: error.message || 'Server Error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
    },
  });
};

const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new Error(`Not found - ${req.originalUrl}`) as AppError;
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
};

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export { errorHandler, notFound, asyncHandler };
