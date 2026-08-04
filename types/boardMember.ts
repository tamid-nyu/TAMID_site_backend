export interface BoardMemberRow {
  id: string;
  position: string;
  full_name: string;
  bio: string | null;
  major: string | null;
  year: string | null;
  hometown: string | null;
  linkedin_url: string | null;
  email: string;
  headshot_file: string | null;
  headshot_updated_at: string;
  order_index: number;
}
