import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createSupabaseQueryMock } from '../test/helpers/supabase.js';
import type { EventRow } from '../types/index.js';

const eventRow: EventRow = {
  id: '11111111-1111-4111-8111-111111111111',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  title: 'Career Panel',
  company: 'TAMID',
  start_time: '2026-03-01T17:00:00.000Z',
  end_time: '2026-03-01T18:00:00.000Z',
  location: 'KMC',
  flyer_file: 'panel.png',
  rsvp_link: 'https://nyu-tamid.org/rsvp',
  description: 'Panel description',
  is_visible: true,
  semester: 'S26',
};

describe('Event model', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('maps database rows to API-facing event objects', async () => {
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(),
    }));
    const { default: Event } = await import('./Event.js');

    const event = Event.fromDatabase(eventRow);

    expect(event).toMatchObject({
      id: eventRow.id,
      createdAt: eventRow.created_at,
      updatedAt: eventRow.updated_at,
      title: eventRow.title,
      startTime: eventRow.start_time,
      isVisible: true,
    });
    expect(event?.toDatabase()).toEqual(eventRow);
    expect(Event.toJSON(eventRow)).toMatchObject({
      id: eventRow.id,
      createdAt: eventRow.created_at,
      startTime: eventRow.start_time,
    });
  });

  it('builds filtered, sorted, paginated queries for public event lists', async () => {
    const countQuery = createSupabaseQueryMock({ count: 12, error: null });
    const dataQuery = createSupabaseQueryMock({ data: [eventRow], error: null });
    const from = jest.fn(() => (from.mock.calls.length === 1 ? dataQuery : countQuery));

    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(() => ({ from })),
    }));
    const { default: Event } = await import('./Event.js');

    const result = await Event.findAll({
      page: 2,
      limit: 5,
      search: 'panel',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      semester: 'S26',
      sort: 'startTime:desc',
    });

    expect(result).toMatchObject({
      total: 12,
      page: 2,
      limit: 5,
      totalPages: 3,
    });
    expect(result.events[0]).toMatchObject({ id: eventRow.id, title: eventRow.title });
    expect(countQuery.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(countQuery.eq).toHaveBeenCalledWith('is_visible', true);
    expect(countQuery.or).toHaveBeenCalledWith('title.ilike.%panel%,description.ilike.%panel%');
    expect(countQuery.gte).toHaveBeenCalledWith('start_time', '2026-01-01T00:00:00.000Z');
    expect(countQuery.lte).toHaveBeenCalledWith('start_time', '2026-12-31T00:00:00.000Z');
    expect(countQuery.eq).toHaveBeenCalledWith('semester', 'S26');
    expect(dataQuery.order).toHaveBeenCalledWith('start_time', { ascending: false });
    expect(dataQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(dataQuery.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(dataQuery.range).toHaveBeenCalledWith(5, 9);
  });

  it('returns null for missing public event IDs and fetches upcoming visible events', async () => {
    const missingQuery = createSupabaseQueryMock({ data: null, error: { code: 'PGRST116' } });
    const upcomingQuery = createSupabaseQueryMock({ data: [eventRow], error: null });
    const from = jest.fn(() => (from.mock.calls.length === 1 ? missingQuery : upcomingQuery));

    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(() => ({ from })),
    }));
    const { default: Event } = await import('./Event.js');

    await expect(Event.findById(eventRow.id)).resolves.toBeNull();
    const upcoming = await Event.findUpcoming(3);

    expect(upcoming).toHaveLength(1);
    expect(missingQuery.eq).toHaveBeenCalledWith('id', eventRow.id);
    expect(missingQuery.eq).toHaveBeenCalledWith('is_visible', true);
    expect(upcomingQuery.gte).toHaveBeenCalledWith('start_time', expect.any(String));
    expect(upcomingQuery.eq).toHaveBeenCalledWith('is_visible', true);
    expect(upcomingQuery.order).toHaveBeenCalledWith('start_time', { ascending: true });
    expect(upcomingQuery.limit).toHaveBeenCalledWith(3);
  });
});
