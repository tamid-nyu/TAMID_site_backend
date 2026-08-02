import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const ORIGINAL_ENV = process.env;

const loadSupabaseConfig = async () => {
  jest.resetModules();
  return import('./supabase.js');
};

describe('Supabase API key environment configuration', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.SUPABASE_URL = 'https://abc123.supabase.co';
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('requires SUPABASE_PUBLISHABLE_KEY for the default client', async () => {
    process.env.SUPABASE_ANON_KEY = 'legacy-anon-key';

    const { initializeSupabase } = await loadSupabaseConfig();

    expect(() => initializeSupabase()).toThrow(
      'SUPABASE_PUBLISHABLE_KEY is required but not provided'
    );
  });

  it('requires SUPABASE_SECRET_KEY for admin database operations', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role-key';

    const { getSupabaseAdmin } = await loadSupabaseConfig();

    expect(() => getSupabaseAdmin()).toThrow(
      'SUPABASE_SECRET_KEY is required for admin database operations'
    );
  });
});
