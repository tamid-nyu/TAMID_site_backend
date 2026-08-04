import express, { type Request, type Response, type NextFunction, type Application } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import compression from 'compression';
import http from 'http';

import dotenv from 'dotenv';

import { initializeSupabase, testConnection, getSupabase } from './config/supabase.js';
import { getSupabaseTargetMetadata } from './config/supabaseTarget.js';
import { initializeEmailTransporter } from './config/email.js';
import { initializeMailchimp, testMailchimpConnection } from './config/mailchimp.js';
import { errorHandler, notFound, validateReferer } from './middleware/index.js';

import {
  boardMembersRoutes,
  newsletterRoutes,
  newsletterSignupsRoutes,
  eventsRoutes,
  contactRoutes,
  contactRequestsRoutes,
  membersRoutes,
  semestersRoutes,
  siteConfigRoutes,
  storageRoutes,
} from './routes/index.js';

import { logger, httpLogger } from './logger.js';
import swaggerSpec from './config/swagger.js';

dotenv.config();
// PUBLIC production defaults, compiled into the bundle so the deployed
// serverless function has config even when the host sets no env (a plain
// .env file is NOT bundled by Vercel). These are client-public values
// (project URL + publishable/anon key + browser caller origins); RLS
// protects the data. `||=` means any real host env / local .env still wins.
// The SECRET/service_role key is intentionally NOT defaulted - admin writes
// require it from the environment.
process.env.SUPABASE_URL ||= 'https://ggpcovdlthmysfouulpq.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY ||= 'sb_publishable_xxEeeefJc2vejMZirUA0RA_9VKUs4RX';
process.env.FRONTEND_URL ||= 'https://tamid-site.vercel.app';
process.env.ADMIN_URL ||= 'https://tamid-site-internal.vercel.app';
process.env.DISABLE_EMAIL_SENDING ||= 'true';
process.env.DISABLE_MAILCHIMP_SYNC ||= 'true';
process.env.SKIP_STARTUP_CONNECTION_TESTS ||= 'true';

const app: Application = express();
const PORT = process.env.PORT || 3000;
const skipStartupConnectionTests = process.env.SKIP_STARTUP_CONNECTION_TESTS === 'true';

// Trust proxy when deployed (Vercel)
if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
  app.set('trust proxy', 1);
}

initializeSupabase();
initializeEmailTransporter();
initializeMailchimp();
if (skipStartupConnectionTests) {
  logger.info({
    message: 'Skipping startup connection tests via SKIP_STARTUP_CONNECTION_TESTS',
  });
} else {
  testMailchimpConnection().catch((error: Error) => {
    logger.error({
      message: 'Failed to connect to Mailchimp during startup - will retry on first request',
      error: error.message,
    });
    // Don't exit the process - let the server start and handle errors per-request
  });

  testConnection().catch((error: Error) => {
    logger.error({
      message: 'Failed to connect to Supabase during startup - will retry on first request',
      error: error.message,
    });
    // Don't exit the process - let the server start and handle errors per-request
  });
}

// Note: Security headers are configured in vercel.json for edge-level performance

// API Documentation (CDNs used for Vercel serverless compatibility)
const createSwaggerHtml = (specUrl: string, title: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%2318274B'/%3E%3Ctext x='16' y='22' font-family='Roboto,sans-serif' font-size='16' font-weight='800' text-anchor='middle' fill='%2341B5E8'%3ET%3C/text%3E%3C/svg%3E" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css" />
  <style>
    /* TAMID Group at NYU brand — see STYLE.md (Navy #18274B, Sky Blue #41B5E8) */
    body { margin: 0; padding: 0; }
    #swagger-ui { height: 100vh; }
    .swagger-ui .topbar { background-color: #18274B; }
    .swagger-ui .topbar .download-url-wrapper .download-url-button { background-color: #41B5E8; border-color: #41B5E8; }
    .swagger-ui .info .title { color: #18274B; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
      });
    };
  </script>
</body>
</html>`;

app.get('/docs', (_req: Request, res: Response): void => {
  res.send(createSwaggerHtml('/docs.json', 'TAMID Group at NYU API — Documentation'));
});

app.get('/docs.json', (_req: Request, res: Response): void => {
  res.json(swaggerSpec);
});

// Rate limiting
const forceEnableRateLimit = process.env.ENABLE_RATE_LIMIT === 'true';
const shouldEnableRateLimit = process.env.NODE_ENV !== 'development' || forceEnableRateLimit;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

if (shouldEnableRateLimit) {
  logger.info({
    message: forceEnableRateLimit
      ? 'Rate limiting enabled via ENABLE_RATE_LIMIT'
      : 'Rate limiting enabled',
  });
  app.use('/v1', limiter);
} else {
  logger.info({
    message: 'Rate limiting disabled in development mode',
  });
}

// CORS configuration
interface CorsCallback {
  (err: Error | null, allow?: boolean): void;
}

const allowedOrigins = [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(
  Boolean
);

const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: CorsCallback): void {
    // Allow requests with no origin (like curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // In development, allow all localhost origins regardless of port
    const isLocalhost =
      process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin);

    if (isLocalhost || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({
        message: 'CORS blocked request',
        origin: origin,
        allowedOrigins: allowedOrigins,
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Cache-Control',
    'Accept',
    'Accept-Language',
    'Accept-Encoding',
  ],
};

app.use(cors(corsOptions));

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(httpLogger);

app.use('/v1', validateReferer);

// Root route for Vercel health checks and screenshots
app.get('/', (_req: Request, res: Response): void => {
  res.json({
    name: 'TAMID API',
    version: '1.0.0',
    status: 'running',
    description: 'Backend API for TAMID Group at NYU website',
    endpoints: {
      health: '/health',
      dbHealth: '/db-health',
      api: '/v1',
      docs: '/docs',
      openapi: '/docs.json',
    },
  });
});

app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    supabase: getSupabaseTargetMetadata(),
  });
});

app.get('/db-health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('events').select('id').limit(1);

    if (error) {
      throw error;
    }

    res.status(200).json({
      status: 'ok',
      message: 'Database connection is healthy',
    });
  } catch (error) {
    const err = error as Error;
    logger.error({
      message: 'Database health check failed',
      error: err.message,
    });
    res.status(503).json({
      status: 'error',
      message: 'DB_CONNECTION_ERROR',
      details: err.message,
    });
  }
});

// Handle favicon requests to prevent 404 errors
app.get('/favicon.ico', (_req: Request, res: Response): void => {
  res.status(204).end();
});

app.get('/favicon.png', (_req: Request, res: Response): void => {
  res.status(204).end();
});

// API Routes
app.use('/v1/board-members', boardMembersRoutes);
app.use('/v1/newsletter-sign-ups', newsletterRoutes);
app.use('/v1/newsletter-signups', newsletterSignupsRoutes);
app.use('/v1/events', eventsRoutes);
app.use('/v1/contact', contactRoutes);
app.use('/v1/contact-requests', contactRequestsRoutes);
app.use('/v1/members', membersRoutes);
app.use('/v1/semesters', semestersRoutes);
app.use('/v1/site-config', siteConfigRoutes);
app.use('/v1/storage', storageRoutes);

// API version info endpoint
app.get('/v1', (_req: Request, res: Response): void => {
  res.json({
    version: '1.0.0',
    documentation: '/docs',
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler as (err: Error, req: Request, res: Response, next: NextFunction) => void);

let server: http.Server | undefined;

export const getStartupLogMetadata = (port: string | number): Record<string, unknown> => {
  const supabaseTarget = getSupabaseTargetMetadata();

  return {
    message: `TAMID Backend server running on port ${port}`,
    environment: process.env.NODE_ENV || 'development',
    database: 'Supabase PostgreSQL',
    dbEnvironment: supabaseTarget.environment,
    healthCheck: `http://localhost:${port}/health`,
    apiInfo: `http://localhost:${port}/v1`,
    docs: `http://localhost:${port}/docs`,
    openapi: `http://localhost:${port}/docs.json`,
  };
};

// Graceful shutdown
const gracefulShutdown = (signal: string): void => {
  logger.info({
    message: `Received ${signal}, shutting down gracefully...`,
  });
  if (server) {
    server.close((err?: Error) => {
      if (err) {
        logger.error({
          message: `Error shutting down server`,
          error: err,
        });
        process.exit(1);
      }

      logger.info({
        message: 'Server shut down gracefully',
      });
      process.exit(0);
    });
  } else {
    logger.info({
      message: 'No server to close, shutting down gracefully',
    });
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err: Error) => {
  logger.error({
    message: 'Uncaught exception',
    error: err,
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error({
    message: 'Unhandled rejection',
    reason: reason,
    promise: promise,
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Only start server if not in Vercel (serverless) environment
if (process.env.VERCEL !== '1') {
  server = app.listen(PORT, () => {
    logger.info(getStartupLogMetadata(PORT));
  });
}

export default app;
