import { describe, expect, it } from '@jest/globals';
import { describeSupabaseConnectionError, getSupabaseEnvironment } from './supabase.js';

describe('getSupabaseEnvironment', () => {
  it('classifies localhost Supabase URLs as local', () => {
    expect(getSupabaseEnvironment('http://127.0.0.1:54321')).toBe('local');
    expect(getSupabaseEnvironment('http://localhost:54321')).toBe('local');
  });

  it('classifies Supabase platform URLs as production', () => {
    expect(getSupabaseEnvironment('https://abc123.supabase.co')).toBe('production');
  });

  it('classifies invalid or custom URLs as unknown', () => {
    expect(getSupabaseEnvironment('not a url')).toBe('unknown');
    expect(getSupabaseEnvironment('https://supabase.internal.example')).toBe('unknown');
  });
});

describe('describeSupabaseConnectionError', () => {
  it('explains local fetch failures as likely local Supabase downtime', () => {
    const diagnostic = describeSupabaseConnectionError(
      new TypeError('fetch failed'),
      'http://127.0.0.1:54321'
    );

    expect(diagnostic.message).toBe(
      'Could not connect to local Supabase at http://127.0.0.1:54321. Is Supabase running? Start it with `npm run supabase:start` and confirm SUPABASE_URL points to the local Project URL.'
    );
    expect(diagnostic.code).toBe('SUPABASE_CONNECTION_FAILED');
    expect(diagnostic.environment).toBe('local');
    expect(diagnostic.cause).toBe('fetch failed');
  });

  it('explains production fetch failures as remote Supabase connectivity issues', () => {
    const diagnostic = describeSupabaseConnectionError(
      new TypeError('fetch failed'),
      'https://abc123.supabase.co'
    );

    expect(diagnostic.message).toBe(
      'Could not connect to production Supabase at https://abc123.supabase.co. Check network/DNS/TLS access from this runtime and verify SUPABASE_URL.'
    );
    expect(diagnostic.environment).toBe('production');
  });

  it('explains abort errors as Supabase timeouts', () => {
    const error = new Error('This operation was aborted');
    error.name = 'AbortError';

    const diagnostic = describeSupabaseConnectionError(error, 'https://abc123.supabase.co');

    expect(diagnostic.message).toBe(
      'Timed out connecting to production Supabase at https://abc123.supabase.co after 5000ms. Check Supabase availability and network latency from this runtime.'
    );
    expect(diagnostic.code).toBe('SUPABASE_CONNECTION_TIMEOUT');
  });
});
