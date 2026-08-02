import pino from 'pino';
import pinoHttp from 'pino-http';

interface LoggerConfig {
  level: string;
  transport?: {
    target: string;
    options?: {
      colorize: boolean;
      singleLine: boolean;
      translateTime: string;
      ignore: string;
      messageKey: string;
      customColors?: string;
    };
  };
}

// Configure logger based on environment
const loggerConfig: LoggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
};

// Use pino-pretty unless in production
if (process.env.NODE_ENV !== 'production') {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      singleLine: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname,req,res,responseTime',
      messageKey: 'message',
    },
  };
}

export const logger = pino(loggerConfig);

// HTTP request logging middleware
// Note: pinoHttp types are complex; using type assertion for compatibility
export const httpLogger = (pinoHttp as unknown as typeof pinoHttp.default)({
  logger,
  autoLogging: {
    ignore: (req: { url?: string }) =>
      req.url === '/health' || req.url === '/db-health' || req.url === '/favicon.ico',
  },
  // Clean one-line summaries instead of dumping req/res objects
  customSuccessMessage: (
    req: { method?: string; url?: string; originalUrl?: string },
    res: { statusCode?: number }
  ): string => {
    return `${req.method} ${req.originalUrl || req.url} → ${res.statusCode}`;
  },
  customErrorMessage: (
    req: { method?: string; url?: string; originalUrl?: string },
    res: { statusCode?: number },
    error: Error
  ): string => {
    return `${req.method} ${req.originalUrl || req.url} → ${res.statusCode} (${error.message})`;
  },
  // Strip verbose req/res objects from the log output
  serializers: {
    req: (req: { method?: string; url?: string }) => ({
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode?: number }) => ({
      statusCode: res.statusCode,
    }),
  },
});
