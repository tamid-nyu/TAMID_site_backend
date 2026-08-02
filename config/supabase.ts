import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger.js';

let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;
const SUPABASE_FETCH_TIMEOUT_MS = 5000;

export type SupabaseEnvironment = 'local' | 'production' | 'unknown';

export interface SupabaseConnectionDiagnostic {
  code: 'SUPABASE_CONNECTION_FAILED' | 'SUPABASE_CONNECTION_TIMEOUT';
  message: string;
  environment: SupabaseEnvironment;
  url: string;
  cause: string;
}

const getErrorName = (error: unknown): string | undefined => {
  return error instanceof Error ? error.name : undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return String(error);
};

export const getSupabaseEnvironment = (supabaseUrl: string): SupabaseEnvironment => {
  try {
    const parsedUrl = new URL(supabaseUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return 'local';
    }

    if (hostname.endsWith('.supabase.co')) {
      return 'production';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
};

export const isSupabaseConnectionError = (error: unknown): boolean => {
  const errorName = getErrorName(error);
  const errorMessage = getErrorMessage(error).toLowerCase();

  return (
    errorName === 'AbortError' ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out')
  );
};

export const describeSupabaseConnectionError = (
  error: unknown,
  supabaseUrl = process.env.SUPABASE_URL || 'unknown'
): SupabaseConnectionDiagnostic => {
  const environment = getSupabaseEnvironment(supabaseUrl);
  const errorName = getErrorName(error);
  const cause = getErrorMessage(error);
  const isTimeout =
    errorName === 'AbortError' ||
    cause.toLowerCase().includes('timeout') ||
    cause.toLowerCase().includes('timed out');

  if (isTimeout) {
    return {
      code: 'SUPABASE_CONNECTION_TIMEOUT',
      message: `Timed out connecting to ${environment} Supabase at ${supabaseUrl} after ${SUPABASE_FETCH_TIMEOUT_MS}ms. Check Supabase availability and network latency from this runtime.`,
      environment,
      url: supabaseUrl,
      cause,
    };
  }

  const localGuidance =
    'Is Supabase running? Start it with `npm run supabase:start` and confirm SUPABASE_URL points to the local Project URL.';
  const remoteGuidance = 'Check network/DNS/TLS access from this runtime and verify SUPABASE_URL.';
  const guidance = environment === 'local' ? localGuidance : remoteGuidance;

  return {
    code: 'SUPABASE_CONNECTION_FAILED',
    message: `Could not connect to ${environment} Supabase at ${supabaseUrl}. ${guidance}`,
    environment,
    url: supabaseUrl,
    cause,
  };
};

export const describeSupabaseError = (error: unknown): string => {
  if (!isSupabaseConnectionError(error)) {
    return getErrorMessage(error);
  }

  const diagnostic = describeSupabaseConnectionError(error);
  return `${diagnostic.message} Cause: ${diagnostic.cause}`;
};

export const initializeSupabase = (): SupabaseClient => {
  if (!process.env.SUPABASE_URL) {
    const error = new Error('SUPABASE_URL is required but not provided');
    logger.error({
      message: 'Missing Supabase configuration',
      error: error.message,
    });
    throw error;
  }

  if (!process.env.SUPABASE_PUBLISHABLE_KEY) {
    const error = new Error('SUPABASE_PUBLISHABLE_KEY is required but not provided');
    logger.error({
      message: 'Missing Supabase configuration',
      error: error.message,
    });
    throw error;
  }

  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false, // Server-side doesn't need session persistence
      },
      global: {
        fetch: (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
          // Add timeout for serverless environments
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);

          return fetch(input, {
            ...init,
            signal: controller.signal,
          }).finally(() => clearTimeout(timeoutId));
        },
      },
    });

    const supabaseEnvironment = getSupabaseEnvironment(process.env.SUPABASE_URL);

    logger.info({
      message: `Supabase client initialized successfully (${supabaseEnvironment} Supabase)`,
      supabaseEnvironment,
      url: process.env.SUPABASE_URL,
    });
    return supabase;
  } catch (error) {
    const err = error as Error;
    logger.error({
      message: 'Failed to initialize Supabase client',
      error: err.message,
    });
    throw error;
  }
};

export const getSupabase = (): SupabaseClient => {
  if (!supabase) {
    return initializeSupabase();
  }
  return supabase;
};

export const getSupabaseAdmin = (): SupabaseClient => {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required but not provided');
  }

  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_SECRET_KEY is required for admin database operations');
  }

  supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);

        return fetch(input, {
          ...init,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
      },
    },
  });

  logger.info({
    message: 'Supabase admin client initialized successfully',
    supabaseEnvironment: getSupabaseEnvironment(process.env.SUPABASE_URL),
  });

  return supabaseAdmin;
};

// Test the connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = getSupabase();

    const { error } = await client.from('board_members').select('*').limit(1);

    if (error && !error.message.includes('relation "board_members" does not exist')) {
      throw error;
    }

    logger.info({
      message: 'Supabase connection test successful',
    });
    return true;
  } catch (error) {
    const err = error as Error & { name: string };
    // Check if it's a network/timeout error vs configuration error
    if (isSupabaseConnectionError(error)) {
      const diagnostic = describeSupabaseConnectionError(error);
      logger.warn({
        message: 'Supabase connection test failed due to network/timeout',
        diagnostic: diagnostic.message,
        cause: diagnostic.cause,
        code: diagnostic.code,
        supabaseEnvironment: diagnostic.environment,
        supabaseUrl: diagnostic.url,
      });
    } else {
      logger.error({
        message: 'Supabase connection test failed',
        error: err.message,
        errorType: err.name,
      });
    }
    throw error;
  }
};
