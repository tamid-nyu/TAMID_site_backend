import { describeSupabaseError, getSupabase } from '../config/supabase.js';
import type { MemberRow } from '../types/index.js';

class Member {
  id: string;
  firstName: string;
  lastName: string;
  semester: string;
  email: string | null;

  constructor(data: MemberRow) {
    this.id = data.id;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.semester = data.semester;
    this.email = data.email;
  }

  static fromDatabase(row: MemberRow | null): Member | null {
    if (!row) return null;
    return new Member(row);
  }

  static toJSON(apiMember: MemberRow) {
    return {
      id: apiMember.id,
      firstName: apiMember.first_name,
      lastName: apiMember.last_name,
      semester: apiMember.semester,
      email: apiMember.email,
    };
  }

  toDatabase(): MemberRow {
    return {
      id: this.id,
      first_name: this.firstName,
      last_name: this.lastName,
      semester: this.semester,
      email: this.email,
    };
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.firstName || this.firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (this.firstName && this.firstName.length > 100) {
      errors.push('First name cannot exceed 100 characters');
    }

    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    if (this.lastName && this.lastName.length > 100) {
      errors.push('Last name cannot exceed 100 characters');
    }

    if (!this.semester || this.semester.trim().length === 0) {
      errors.push('Semester is required');
    }

    return errors;
  }

  static async findAll(): Promise<Member[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch members: ${describeSupabaseError(error)}`);
    }

    return (data as MemberRow[]).map((row) => Member.fromDatabase(row)!);
  }

  static async create(memberData: Omit<MemberRow, 'id'>): Promise<Member | null> {
    const member = new Member({ id: '', ...memberData });
    const errors = member.validate();

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const supabase = getSupabase();

    // Verify the semester exists
    const { data: semesterData, error: semesterError } = await supabase
      .from('semesters')
      .select('semester_name')
      .eq('semester_name', memberData.semester)
      .single();

    if (semesterError) {
      // PGRST116: no rows returned - treat as "semester does not exist"
      if ((semesterError as { code?: string }).code === 'PGRST116') {
        throw new Error(
          `Invalid semester: '${memberData.semester}' does not exist. Please provide a valid semester name.`
        );
      }

      // Any other error means we failed to verify the semester, not that it is invalid
      throw new Error(
        `Failed to verify semester '${memberData.semester}': ${describeSupabaseError(semesterError)}`
      );
    }

    // No error but no data is an unexpected state; treat as verification failure
    if (!semesterData) {
      throw new Error(
        `Failed to verify semester '${memberData.semester}': lookup returned no data without an error.`
      );
    }

    const { data, error } = await supabase
      .from('members')
      .insert({
        first_name: memberData.first_name,
        last_name: memberData.last_name,
        semester: memberData.semester,
        email: memberData.email,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create member: ${describeSupabaseError(error)}`);
    }

    return Member.fromDatabase(data as MemberRow);
  }
}

export default Member;
