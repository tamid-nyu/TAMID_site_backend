import { jest } from '@jest/globals';

export interface SupabaseQueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export interface SupabaseQueryMock extends PromiseLike<SupabaseQueryResult> {
  select: jest.Mock<(columns?: string, options?: unknown) => SupabaseQueryMock>;
  eq: jest.Mock<(column: string, value: unknown) => SupabaseQueryMock>;
  gte: jest.Mock<(column: string, value: unknown) => SupabaseQueryMock>;
  lte: jest.Mock<(column: string, value: unknown) => SupabaseQueryMock>;
  in: jest.Mock<(column: string, values: unknown[]) => SupabaseQueryMock>;
  or: jest.Mock<(filter: string) => SupabaseQueryMock>;
  order: jest.Mock<(column: string, options?: unknown) => SupabaseQueryMock>;
  range: jest.Mock<(from: number, to: number) => SupabaseQueryMock>;
  limit: jest.Mock<(count: number) => SupabaseQueryMock>;
  single: jest.Mock<() => Promise<SupabaseQueryResult>>;
  insert: jest.Mock<(payload: unknown) => SupabaseQueryMock>;
  update: jest.Mock<(payload: unknown) => SupabaseQueryMock>;
  delete: jest.Mock<() => SupabaseQueryMock>;
}

export const createSupabaseQueryMock = (
  result: SupabaseQueryResult | Promise<SupabaseQueryResult> = { data: [], error: null }
): SupabaseQueryMock => {
  const resolveResult = () => Promise.resolve(result);
  const query = {
    then: <TResult1 = SupabaseQueryResult, TResult2 = never>(
      onfulfilled?: ((value: SupabaseQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => resolveResult().then(onfulfilled, onrejected),
    select: jest.fn<() => SupabaseQueryMock>(),
    eq: jest.fn<() => SupabaseQueryMock>(),
    gte: jest.fn<() => SupabaseQueryMock>(),
    lte: jest.fn<() => SupabaseQueryMock>(),
    in: jest.fn<() => SupabaseQueryMock>(),
    or: jest.fn<() => SupabaseQueryMock>(),
    order: jest.fn<() => SupabaseQueryMock>(),
    range: jest.fn<() => SupabaseQueryMock>(),
    limit: jest.fn<() => SupabaseQueryMock>(),
    single: jest.fn<() => Promise<SupabaseQueryResult>>(),
    insert: jest.fn<() => SupabaseQueryMock>(),
    update: jest.fn<() => SupabaseQueryMock>(),
    delete: jest.fn<() => SupabaseQueryMock>(),
  } as unknown as SupabaseQueryMock;

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.single.mockImplementation(resolveResult);

  return query;
};

export const createSupabaseClientMock = (queries: Record<string, SupabaseQueryMock>) => ({
  from: jest.fn((table: string) => {
    if (!Object.prototype.hasOwnProperty.call(queries, table)) {
      throw new Error(`Missing Supabase query mock for table: ${table}`);
    }
    return queries[table];
  }),
});
