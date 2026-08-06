import { describeSupabaseError, getSupabase, getSupabaseAdmin } from '../config/supabase.js';
import type { MemberRow } from '../types/index.js';

export interface BulkMemberInput {
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  semester?: unknown;
}

export interface BulkCreateSummary {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

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

  /**
   * Bulk-create members from a parsed roster.
   *
   * Semester handling: any referenced semester that does not yet exist in
   * public.semesters is created automatically (service_role) BEFORE inserting
   * members, so a fresh roster for a new term "just works" without an FK failure.
   *
   * Invalid rows (missing required fields, bad email) are reported in `errors`
   * and do not fail the batch. Rows that duplicate an existing member
   * (same first+last+email+semester) or duplicate another row in the same
   * payload are skipped. Valid, deduped rows are inserted in a single insert.
   */
  static async bulkCreate(rows: BulkMemberInput[]): Promise<BulkCreateSummary> {
    const summary: BulkCreateSummary = { created: 0, skipped: 0, errors: [] };

    const asTrimmedString = (value: unknown): string => {
      if (typeof value === 'string') {
        return value.trim();
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value).trim();
      }
      return '';
    };

    // 1. Normalize + validate each row.
    interface Candidate {
      row: number;
      first_name: string;
      last_name: string;
      email: string | null;
      semester: string;
    }
    const candidates: Candidate[] = [];

    rows.forEach((raw, index) => {
      const rowNumber = index + 1;
      const firstName = asTrimmedString(raw.first_name);
      const lastName = asTrimmedString(raw.last_name);
      const semester = asTrimmedString(raw.semester);
      const emailRaw = asTrimmedString(raw.email);
      const email = emailRaw.length > 0 ? emailRaw : null;

      const member = new Member({
        id: '',
        first_name: firstName,
        last_name: lastName,
        semester,
        email,
      });
      const errors = member.validate();

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format');
      }

      if (errors.length > 0) {
        summary.errors.push({ row: rowNumber, message: errors.join(', ') });
        return;
      }

      candidates.push({
        row: rowNumber,
        first_name: firstName,
        last_name: lastName,
        email,
        semester,
      });
    });

    if (candidates.length === 0) {
      return summary;
    }

    const supabase = getSupabaseAdmin();

    // 2. Ensure every referenced semester exists (create missing ones).
    const referencedSemesters = Array.from(new Set(candidates.map((c) => c.semester)));

    const { data: existingSemesterRows, error: semesterLookupError } = await supabase
      .from('semesters')
      .select('semester_name')
      .in('semester_name', referencedSemesters);

    if (semesterLookupError) {
      throw new Error(`Failed to verify semesters: ${describeSupabaseError(semesterLookupError)}`);
    }

    const existingSemesters = new Set(
      ((existingSemesterRows ?? []) as Array<{ semester_name: string }>).map((r) => r.semester_name)
    );
    const missingSemesters = referencedSemesters.filter((s) => !existingSemesters.has(s));

    if (missingSemesters.length > 0) {
      const { error: insertSemesterError } = await supabase
        .from('semesters')
        .insert(missingSemesters.map((semester_name) => ({ semester_name })));

      if (insertSemesterError) {
        throw new Error(
          `Failed to create semesters: ${describeSupabaseError(insertSemesterError)}`
        );
      }
    }

    // 3. Fetch existing members for the referenced semesters to detect duplicates.
    const { data: existingMemberRows, error: memberLookupError } = await supabase
      .from('members')
      .select('first_name, last_name, email, semester')
      .in('semester', referencedSemesters);

    if (memberLookupError) {
      throw new Error(
        `Failed to check existing members: ${describeSupabaseError(memberLookupError)}`
      );
    }

    const dedupKey = (c: {
      first_name: string;
      last_name: string;
      email: string | null;
      semester: string;
    }): string =>
      [
        c.first_name.toLowerCase(),
        c.last_name.toLowerCase(),
        (c.email ?? '').toLowerCase(),
        c.semester.toLowerCase(),
      ].join('|');

    const seen = new Set<string>(
      (
        (existingMemberRows ?? []) as Array<{
          first_name: string;
          last_name: string;
          email: string | null;
          semester: string;
        }>
      ).map(dedupKey)
    );

    // 4. Dedup within the payload + against existing members.
    const toInsert: Candidate[] = [];
    for (const candidate of candidates) {
      const key = dedupKey(candidate);
      if (seen.has(key)) {
        summary.skipped += 1;
        continue;
      }
      seen.add(key);
      toInsert.push(candidate);
    }

    if (toInsert.length === 0) {
      return summary;
    }

    // 5. Single insert for the valid, deduped set.
    const { data: inserted, error: insertError } = await supabase
      .from('members')
      .insert(
        toInsert.map((c) => ({
          first_name: c.first_name,
          last_name: c.last_name,
          semester: c.semester,
          email: c.email,
        }))
      )
      .select();

    if (insertError) {
      throw new Error(`Failed to insert members: ${describeSupabaseError(insertError)}`);
    }

    summary.created = (inserted as MemberRow[] | null)?.length ?? toInsert.length;

    return summary;
  }
}

export default Member;
