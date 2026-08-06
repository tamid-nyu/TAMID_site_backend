import { beforeEach, describe, expect, it, jest } from '@jest/globals';

interface Row {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  semester?: string;
  semester_name?: string;
}

// A minimal chainable Supabase query builder whose behavior is driven per-table.
const makeAdmin = (opts: {
  existingSemesters: string[];
  existingMembers: Row[];
  onInsertMembers: (rows: Row[]) => void;
  onInsertSemesters: (rows: Row[]) => void;
}) => {
  const from = jest.fn((table: string) => {
    if (table === 'semesters') {
      const builder: Record<string, unknown> = {};
      builder.select = jest.fn(() => builder);
      builder.in = jest.fn(() =>
        Promise.resolve({
          data: opts.existingSemesters.map((s) => ({ semester_name: s })),
          error: null,
        })
      );
      builder.insert = jest.fn((rows: Row[]) => {
        opts.onInsertSemesters(rows);
        return Promise.resolve({ data: rows, error: null });
      });
      return builder;
    }
    if (table === 'members') {
      const builder: Record<string, unknown> = {};
      builder.select = jest.fn(() => builder);
      builder.in = jest.fn(() => Promise.resolve({ data: opts.existingMembers, error: null }));
      builder.insert = jest.fn((rows: Row[]) => {
        opts.onInsertMembers(rows);
        return {
          select: jest.fn(() => Promise.resolve({ data: rows, error: null })),
        };
      });
      return builder;
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from };
};

describe('Member.bulkCreate', () => {
  let insertedMembers: Row[] = [];
  let insertedSemesters: Row[] = [];

  const loadModel = async (admin: unknown) => {
    jest.unstable_mockModule('../logger.js', () => ({
      logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
    }));
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (e: unknown) => String(e),
      getSupabase: jest.fn(),
      getSupabaseAdmin: jest.fn(() => admin),
    }));
    const mod = await import('./Member.js');
    return mod.default;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    insertedMembers = [];
    insertedSemesters = [];
  });

  it('inserts valid rows, reports invalid rows, and skips duplicates', async () => {
    const admin = makeAdmin({
      existingSemesters: ['F26'],
      existingMembers: [
        { first_name: 'Existing', last_name: 'Member', email: 'e@nyu.edu', semester: 'F26' },
      ],
      onInsertMembers: (rows) => insertedMembers.push(...rows),
      onInsertSemesters: (rows) => insertedSemesters.push(...rows),
    });
    const Member = await loadModel(admin);

    const summary = await Member.bulkCreate([
      { first_name: 'Jane', last_name: 'Doe', email: 'jane@nyu.edu', semester: 'F26' }, // valid
      { first_name: '', last_name: 'NoFirst', semester: 'F26' }, // invalid: missing first
      { first_name: 'Existing', last_name: 'Member', email: 'e@nyu.edu', semester: 'F26' }, // dup of existing
      { first_name: 'Bad', last_name: 'Email', email: 'not-an-email', semester: 'F26' }, // invalid email
    ]);

    expect(summary.created).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.errors).toHaveLength(2);
    expect(summary.errors[0].row).toBe(2);
    expect(summary.errors[1].row).toBe(4);
    expect(insertedMembers).toHaveLength(1);
    expect(insertedMembers[0].first_name).toBe('Jane');
  });

  it('auto-creates a missing semester before inserting members', async () => {
    const admin = makeAdmin({
      existingSemesters: [], // S27 does not exist yet
      existingMembers: [],
      onInsertMembers: (rows) => insertedMembers.push(...rows),
      onInsertSemesters: (rows) => insertedSemesters.push(...rows),
    });
    const Member = await loadModel(admin);

    const summary = await Member.bulkCreate([
      { first_name: 'New', last_name: 'Term', semester: 'S27' },
    ]);

    expect(summary.created).toBe(1);
    expect(insertedSemesters).toEqual([{ semester_name: 'S27' }]);
  });

  it('dedups rows within the same payload', async () => {
    const admin = makeAdmin({
      existingSemesters: ['F26'],
      existingMembers: [],
      onInsertMembers: (rows) => insertedMembers.push(...rows),
      onInsertSemesters: (rows) => insertedSemesters.push(...rows),
    });
    const Member = await loadModel(admin);

    const summary = await Member.bulkCreate([
      { first_name: 'Dup', last_name: 'Row', email: 'd@nyu.edu', semester: 'F26' },
      { first_name: 'Dup', last_name: 'Row', email: 'd@nyu.edu', semester: 'F26' },
    ]);

    expect(summary.created).toBe(1);
    expect(summary.skipped).toBe(1);
  });
});
