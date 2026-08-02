import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { User } from '@supabase/supabase-js';

declare module 'express-serve-static-core' {
  interface Request {
    authToken?: string;
    authUser?: User;
  }
}

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export type ErrorRequestHandler = (
  err: Error & { status?: number; code?: string },
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export type { Request, Response, NextFunction, RequestHandler };
