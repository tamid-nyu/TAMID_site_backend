import { describeSupabaseError, getSupabase } from '../config/supabase.js';
import {
  DEFAULT_EVENT_SORT,
  type EventPaginatedResult,
  type EventRow,
  type EventSort,
  type EventsQueryParams,
} from '../types/index.js';

class Event {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  company: string;
  startTime: string;
  endTime: string;
  location: string;
  flyerFile: string | null;
  rsvpLink: string | null;
  description: string | null;
  isVisible: boolean;
  semester: string;

  constructor(data: EventRow) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.title = data.title;
    this.company = data.company;
    this.startTime = data.start_time;
    this.endTime = data.end_time;
    this.location = data.location;
    this.flyerFile = data.flyer_file;
    this.rsvpLink = data.rsvp_link;
    this.description = data.description;
    this.isVisible = data.is_visible;
    this.semester = data.semester;
  }

  static fromDatabase(row: EventRow | null): Event | null {
    if (!row) return null;
    return new Event(row);
  }

  static toJSON(apiEvent: EventRow) {
    return {
      id: apiEvent.id,
      createdAt: apiEvent.created_at,
      updatedAt: apiEvent.updated_at,
      title: apiEvent.title,
      company: apiEvent.company,
      startTime: apiEvent.start_time,
      endTime: apiEvent.end_time,
      location: apiEvent.location,
      flyerFile: apiEvent.flyer_file,
      rsvpLink: apiEvent.rsvp_link,
      description: apiEvent.description,
      isVisible: apiEvent.is_visible,
      semester: apiEvent.semester,
    };
  }

  toDatabase(): EventRow {
    return {
      id: this.id,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      title: this.title,
      company: this.company,
      start_time: this.startTime,
      end_time: this.endTime,
      location: this.location,
      flyer_file: this.flyerFile,
      rsvp_link: this.rsvpLink,
      description: this.description,
      is_visible: this.isVisible,
      semester: this.semester,
    };
  }

  /**
   * Find all events with pagination and filtering
   */
  static async findAll(options: EventsQueryParams = {}): Promise<EventPaginatedResult<Event>> {
    const supabase = getSupabase();
    const { page = 1, limit = 10, search, startDate, endDate, semester } = options;
    const sort: EventSort = options.sort ?? DEFAULT_EVENT_SORT;
    const ascending = sort === 'startTime:asc';

    let query = supabase.from('events').select('*').eq('is_visible', true);

    let countQuery = supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('is_visible', true);

    // Search filter (searches in title and description)
    if (search) {
      const searchFilter = `title.ilike.%${search}%,description.ilike.%${search}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter);
    }

    // Date range filters
    if (startDate) {
      query = query.gte('start_time', startDate);
      countQuery = countQuery.gte('start_time', startDate);
    }

    if (endDate) {
      query = query.lte('start_time', endDate);
      countQuery = countQuery.lte('start_time', endDate);
    }

    if (semester) {
      query = query.eq('semester', semester);
      countQuery = countQuery.eq('semester', semester);
    }

    const [countResult, eventsResult] = await Promise.all([
      countQuery,
      query
        // Sorting is applied before pagination so page boundaries match the requested order.
        .order('start_time', { ascending })
        .order('created_at', { ascending })
        .order('id', { ascending: true })
        .range((page - 1) * limit, page * limit - 1),
    ]);

    if (countResult.error) {
      throw new Error(`Failed to count events: ${describeSupabaseError(countResult.error)}`);
    }

    if (eventsResult.error) {
      throw new Error(`Failed to fetch events: ${describeSupabaseError(eventsResult.error)}`);
    }

    const total = countResult.count ?? 0;
    const events = (eventsResult.data as EventRow[]).map((row) => Event.fromDatabase(row)!);

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single event by ID
   */
  static async findById(id: string): Promise<Event | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('is_visible', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch event: ${describeSupabaseError(error)}`);
    }

    return Event.fromDatabase(data as EventRow);
  }

  /**
   * Find upcoming events (start_time >= now)
   */
  static async findUpcoming(limit: number = 5): Promise<Event[]> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('start_time', now)
      .eq('is_visible', true)
      .order('start_time', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch upcoming events: ${describeSupabaseError(error)}`);
    }

    return (data as EventRow[]).map((row) => Event.fromDatabase(row)!);
  }
}

export default Event;
