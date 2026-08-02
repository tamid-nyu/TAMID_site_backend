export interface BoardMemberRow {
  id: string;
  position: string;
  full_name: string;
  bio: string;
  major: string;
  year: string;
  hometown: string;
  linkedin_url: string | null;
  email: string;
  headshot_file: string | null;
  headshot_updated_at: string;
  order_index: number;
}
