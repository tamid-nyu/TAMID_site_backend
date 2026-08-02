import { describeSupabaseError, getSupabase } from '../config/supabase.js';
import type { SemesterRow } from '../types/index.js';

class Semester {
  id: string;
  semesterName: string;

  constructor(data: SemesterRow) {
    this.id = data.id;
    this.semesterName = data.semester_name;
  }

  static fromDatabase(row: SemesterRow | null): Semester | null {
    if (!row) return null;
    return new Semester(row);
  }

  static toJSON(apiSemester: SemesterRow) {
    return {
      id: apiSemester.id,
      semesterName: apiSemester.semester_name,
    };
  }

  toDatabase(): SemesterRow {
    return {
      id: this.id,
      semester_name: this.semesterName,
    };
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.semesterName || this.semesterName.trim().length === 0) {
      errors.push('Semester name is required');
    }

    if (this.semesterName && !/^[FS]\d{2}$/.test(this.semesterName)) {
      errors.push('Semester name must be in format [F|S]YY');
    }

    return errors;
  }

  static async findAll(): Promise<Semester[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('semesters')
      .select('*')
      .order('semester_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch semesters: ${describeSupabaseError(error)}`);
    }

    return (data as SemesterRow[]).map((row) => Semester.fromDatabase(row)!);
  }

  static async create(semesterData: Omit<SemesterRow, 'id'>): Promise<Semester | null> {
    const semester = new Semester({ id: '', ...semesterData });
    const errors = semester.validate();

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const supabase = getSupabase();

    // Check if semester already exists
    const { data: existing, error: existingError } = await supabase
      .from('semesters')
      .select('semester_name')
      .eq('semester_name', semesterData.semester_name)
      .single();

    // PGRST116 is the "Results contain 0 rows" / not-found case; treat other errors as failures.
    if (existingError && existingError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing semester: ${describeSupabaseError(existingError)}`);
    }
    if (existing) {
      throw new Error(`Semester '${semesterData.semester_name}' already exists.`);
    }

    const { data, error } = await supabase
      .from('semesters')
      .insert({
        semester_name: semesterData.semester_name,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create semester: ${describeSupabaseError(error)}`);
    }

    return Semester.fromDatabase(data as SemesterRow);
  }
}

export default Semester;
