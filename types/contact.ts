export interface ContactSubmissionRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  message: string;
  created_at: string;
}

export interface ContactFormJSON {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  message: string;
  createdAt: string;
}
