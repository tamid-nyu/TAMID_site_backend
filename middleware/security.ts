import type { Request, Response, NextFunction, RequestHandler } from 'express';

const validateReferer: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  // Skip referer validation for development
  if (process.env.NODE_ENV === 'development') {
    next();
    return;
  }

  const referer = req.get('Referer') || req.get('Origin');

  // Allow requests with no referer (like curl, direct API calls, etc.)
  if (!referer) {
    next();
    return;
  }

  const allowedDomains = [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(
    Boolean
  ) as string[];

  // If no allowed domains are configured, allow all requests
  if (allowedDomains.length === 0) {
    next();
    return;
  }

  const isAllowed = allowedDomains.some((domain) => {
    return referer.includes(domain);
  });

  if (!isAllowed) {
    res.status(403).json({
      success: false,
      error: {
        message: 'Forbidden - Invalid referer',
        code: 'INVALID_REFERER',
      },
    });
    return;
  }

  next();
};

type SanitizedValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SanitizedObject
  | SanitizedValue[];

interface SanitizedObject {
  [key: string]: SanitizedValue;
}

const validateInput: RequestHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const sanitizeString = (str: string): string => {
    return str.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  };

  const sanitizeObject = (obj: unknown): SanitizedValue => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj !== null && typeof obj === 'object') {
      const sanitized: SanitizedObject = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    } else if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    return obj as SanitizedValue;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query) as typeof req.query;
  }

  next();
};

export { validateReferer, validateInput };
