export interface NewsletterSignupRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export interface NewsletterSignupData {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  created_at?: string;
}

export interface NewsletterSignupJSON {
  id: string | undefined;
  email: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  createdAt: string;
}

export interface NewsletterFindAllOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface NewsletterStats {
  total: number | null;
  recentSignups: number | null;
}
