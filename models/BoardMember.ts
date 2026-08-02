import { describeSupabaseError, getSupabase } from '../config/supabase.js';
import type { BoardMemberRow } from '../types/index.js';

class BoardMember {
  id: string;
  fullName: string;
  position: string;
  bio: string;
  major: string;
  year: string;
  hometown: string;
  linkedinUrl: string | null;
  email: string;
  headshotFile: string | null;
  headshotUpdatedAt: string;
  orderIndex: number;

  constructor(data: BoardMemberRow) {
    this.id = data.id;
    this.fullName = data.full_name;
    this.position = data.position;
    this.bio = data.bio;
    this.major = data.major;
    this.year = data.year;
    this.hometown = data.hometown;
    this.linkedinUrl = data.linkedin_url;
    this.email = data.email;
    this.headshotFile = data.headshot_file;
    this.headshotUpdatedAt = data.headshot_updated_at;
    this.orderIndex = data.order_index;
  }

  static fromDatabase(row: BoardMemberRow | null): BoardMember | null {
    if (!row) return null;
    return new BoardMember(row);
  }

  static toJSON(apiMember: BoardMemberRow) {
    return {
      id: apiMember.id,
      position: apiMember.position,
      fullName: apiMember.full_name,
      bio: apiMember.bio.replace(/\\n/g, '\n'), // convert escaped newlines to actual newlines
      major: apiMember.major,
      year: apiMember.year,
      hometown: apiMember.hometown,
      linkedinUrl: apiMember.linkedin_url,
      email: apiMember.email,
      headshotFile: apiMember.headshot_file,
      headshotUpdatedAt: apiMember.headshot_updated_at,
      orderIndex: apiMember.order_index,
    };
  }

  toDatabase(): BoardMemberRow {
    return {
      id: this.id,
      full_name: this.fullName,
      position: this.position,
      bio: this.bio,
      major: this.major,
      year: this.year,
      hometown: this.hometown,
      linkedin_url: this.linkedinUrl,
      email: this.email,
      headshot_file: this.headshotFile,
      headshot_updated_at: this.headshotUpdatedAt,
      order_index: this.orderIndex,
    };
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.fullName || this.fullName.trim().length === 0) {
      errors.push('Name is required');
    }

    if (this.fullName && this.fullName.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }

    if (!this.position || this.position.trim().length === 0) {
      errors.push('Position is required');
    }
    if (this.position && this.position.length > 100) {
      errors.push('Position cannot exceed 100 characters');
    }

    if (this.email) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(this.email)) {
        errors.push('Please enter a valid email');
      }
    }

    if (this.major && this.major.length > 100) {
      errors.push('Major cannot exceed 100 characters');
    }

    if (this.orderIndex < 0) {
      errors.push('Order index must be greater than or equal to 0');
    }

    return errors;
  }

  static async findAll(): Promise<BoardMember[]> {
    const supabase = getSupabase();

    const query = supabase
      .from('board_members')
      .select('*')
      .order('order_index', { ascending: true })
      .order('full_name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch board members: ${describeSupabaseError(error)}`);
    }

    return (data as BoardMemberRow[]).map((row) => BoardMember.fromDatabase(row)!);
  }

  static async findById(id: string): Promise<BoardMember | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase.from('board_members').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch board member: ${describeSupabaseError(error)}`);
    }

    return BoardMember.fromDatabase(data as BoardMemberRow);
  }

  static async create(memberData: BoardMemberRow): Promise<BoardMember | null> {
    const member = new BoardMember(memberData);
    const errors = member.validate();

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('board_members')
      .insert(member.toDatabase())
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create board member: ${describeSupabaseError(error)}`);
    }

    return BoardMember.fromDatabase(data as BoardMemberRow);
  }

  async save(): Promise<BoardMember> {
    // Validate
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const supabase = getSupabase();

    if (this.id) {
      // Update existing
      const { data, error } = await supabase
        .from('board_members')
        .update(this.toDatabase())
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update board member: ${describeSupabaseError(error)}`);
      }

      // Update instance with returned data
      const updated = BoardMember.fromDatabase(data as BoardMemberRow);
      if (updated) {
        Object.assign(this, updated);
      }
    } else {
      // Create new
      const { data, error } = await supabase
        .from('board_members')
        .insert(this.toDatabase())
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create board member: ${describeSupabaseError(error)}`);
      }

      // Update instance with returned data
      const created = BoardMember.fromDatabase(data as BoardMemberRow);
      if (created) {
        Object.assign(this, created);
      }
    }

    return this;
  }

  async delete(): Promise<boolean> {
    if (!this.id) {
      throw new Error('Cannot delete board member without ID');
    }

    const supabase = getSupabase();

    const { error } = await supabase.from('board_members').delete().eq('id', this.id);

    if (error) {
      throw new Error(`Failed to delete board member: ${describeSupabaseError(error)}`);
    }

    return true;
  }

  static async count(): Promise<number> {
    const supabase = getSupabase();

    const { count, error } = await supabase
      .from('board_members')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Failed to count board members: ${describeSupabaseError(error)}`);
    }

    return count ?? 0;
  }
}

export default BoardMember;
