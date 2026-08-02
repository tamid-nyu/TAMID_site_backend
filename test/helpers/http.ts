import { jest } from '@jest/globals';
import type { Application } from 'express';
import { createSupabaseQueryMock } from './supabase.js';

interface ImportFreshAppOptions {
  enableRateLimit?: boolean;
  supabaseUrl?: string | null;
}

interface FreshServerModule {
  default: Application;
  getStartupLogMetadata: (port: string | number) => Record<string, unknown>;
}

export const importFreshServerModule = async ({
  enableRateLimit = false,
  supabaseUrl,
}: ImportFreshAppOptions = {}): Promise<FreshServerModule> => {
  jest.resetModules();
  process.env.NODE_ENV = 'test';
  process.env.VERCEL = '1';
  process.env.SKIP_STARTUP_CONNECTION_TESTS = 'true';
  process.env.ENABLE_RATE_LIMIT = enableRateLimit ? 'true' : 'false';
  if (supabaseUrl === null) {
    process.env.SUPABASE_URL = '';
  } else {
    process.env.SUPABASE_URL = supabaseUrl ?? 'http://127.0.0.1:54321';
  }

  const healthQuery = createSupabaseQueryMock({ data: [{ id: 'event-id' }], error: null });

  jest.unstable_mockModule('../../logger.js', () => ({
    logger: {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    },
    httpLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
  }));

  jest.unstable_mockModule('../../config/supabase.js', () => ({
    describeSupabaseError: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
    initializeSupabase: jest.fn(),
    testConnection: jest.fn(),
    getSupabase: jest.fn(() => ({
      from: jest.fn(() => healthQuery),
    })),
    getSupabaseAdmin: jest.fn(() => ({
      from: jest.fn(() => healthQuery),
      storage: {
        listBuckets: jest.fn(),
        from: jest.fn(() => ({})),
      },
    })),
  }));

  jest.unstable_mockModule('../../config/email.js', () => ({
    initializeEmailTransporter: jest.fn(),
    isEmailEnabled: jest.fn(() => false),
    isEmailSendingDisabled: jest.fn(() => true),
    sendEmail: jest.fn(() => Promise.resolve(true)),
  }));

  jest.unstable_mockModule('../../config/mailchimp.js', () => ({
    addSubscriber: jest.fn(),
    initializeMailchimp: jest.fn(),
    removeSubscriber: jest.fn(),
    testMailchimpConnection: jest.fn(),
  }));

  return (await import('../../server.js')) as FreshServerModule;
};

export const importFreshApp = async (options: ImportFreshAppOptions = {}): Promise<Application> => {
  const { default: app } = await importFreshServerModule(options);
  return app;
};
