import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createSupabaseQueryMock } from '../test/helpers/supabase.js';

describe('NewsletterSignup model', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('maps signup rows to JSON and database payloads', async () => {
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(),
    }));
    const { default: NewsletterSignup } = await import('./NewsletterSignup.js');
    const signup = new NewsletterSignup({
      id: 'signup-id',
      email: 'jdoe@stern.nyu.edu',
      first_name: 'John',
      last_name: 'Doe',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    expect(signup.toJSON()).toEqual({
      id: 'signup-id',
      email: 'jdoe@stern.nyu.edu',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(signup.toDatabase()).toEqual({
      email: 'jdoe@stern.nyu.edu',
      first_name: 'John',
      last_name: 'Doe',
      created_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('normalizes emails and translates duplicate inserts', async () => {
    const insertQuery = createSupabaseQueryMock({ error: { code: '23505' } });
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(() => ({
        from: jest.fn(() => insertQuery),
      })),
    }));
    const { default: NewsletterSignup } = await import('./NewsletterSignup.js');

    await expect(
      NewsletterSignup.create({
        email: ' JDOE@stern.nyu.edu ',
        first_name: 'John',
        last_name: 'Doe',
      })
    ).rejects.toThrow('Email is already subscribed to the newsletter');
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jdoe@stern.nyu.edu' })
    );
  });

  it('returns null when email lookup is not found', async () => {
    const lookupQuery = createSupabaseQueryMock({ data: null, error: { code: 'PGRST116' } });
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(() => ({
        from: jest.fn(() => lookupQuery),
      })),
    }));
    const { default: NewsletterSignup } = await import('./NewsletterSignup.js');

    await expect(NewsletterSignup.findByEmail('JDOE@stern.nyu.edu')).resolves.toBeNull();
    expect(lookupQuery.eq).toHaveBeenCalledWith('email', 'jdoe@stern.nyu.edu');
  });

  it('paginates newsletter signups and counts stats', async () => {
    const listQuery = createSupabaseQueryMock({
      data: [
        {
          id: 'signup-id',
          email: 'jdoe@stern.nyu.edu',
          first_name: 'John',
          last_name: 'Doe',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const totalQuery = createSupabaseQueryMock({ count: 10, error: null });
    const recentQuery = createSupabaseQueryMock({ count: 2, error: null });
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return listQuery;
      if (from.mock.calls.length === 2) return totalQuery;
      return recentQuery;
    });
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(() => ({ from })),
    }));
    const { default: NewsletterSignup } = await import('./NewsletterSignup.js');

    const signups = await NewsletterSignup.findAll({
      page: 2,
      limit: 10,
      orderBy: 'email',
      orderDirection: 'asc',
    });
    const stats = await NewsletterSignup.getStats();

    expect(signups).toHaveLength(1);
    expect(listQuery.order).toHaveBeenCalledWith('email', { ascending: true });
    expect(listQuery.range).toHaveBeenCalledWith(10, 19);
    expect(stats).toEqual({ total: 10, recentSignups: 2 });
    expect(recentQuery.gte).toHaveBeenCalledWith('created_at', expect.any(String));
  });
});
