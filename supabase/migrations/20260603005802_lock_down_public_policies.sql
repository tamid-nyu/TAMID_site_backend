-- Lock down direct Supabase Data API access for frontend users.
--
-- Desired public model:
-- - board_members, visible events, members, semesters, and site_config are readable.
-- - hidden events are admin-only through backend service_role routes.
-- - contact_requests and newsletter_signups are insert-only.
-- - frontend roles cannot update, delete, truncate, or upload/delete storage objects.
-- - service_role remains the privileged path for backend/admin workflows.

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT n.nspname, c.relname, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (n.nspname, c.relname) IN (
      ('public', 'board_members'),
      ('public', 'contact_requests'),
      ('public', 'events'),
      ('public', 'members'),
      ('public', 'newsletter_signups'),
      ('public', 'semesters'),
      ('public', 'site_config')
    )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.polname,
      policy_record.nspname,
      policy_record.relname
    );
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.board_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.contact_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.events FROM anon, authenticated;
REVOKE ALL ON TABLE public.members FROM anon, authenticated;
REVOKE ALL ON TABLE public.newsletter_signups FROM anon, authenticated;
REVOKE ALL ON TABLE public.semesters FROM anon, authenticated;
REVOKE ALL ON TABLE public.site_config FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE public.board_members TO anon, authenticated;
GRANT SELECT ON TABLE public.events TO anon, authenticated;
GRANT SELECT ON TABLE public.members TO anon, authenticated;
GRANT SELECT ON TABLE public.semesters TO anon, authenticated;
GRANT SELECT ON TABLE public.site_config TO anon, authenticated;

GRANT INSERT ON TABLE public.contact_requests TO anon, authenticated;
GRANT INSERT ON TABLE public.newsletter_signups TO anon, authenticated;

GRANT ALL ON TABLE public.board_members TO service_role;
GRANT ALL ON TABLE public.contact_requests TO service_role;
GRANT ALL ON TABLE public.events TO service_role;
GRANT ALL ON TABLE public.members TO service_role;
GRANT ALL ON TABLE public.newsletter_signups TO service_role;
GRANT ALL ON TABLE public.semesters TO service_role;
GRANT ALL ON TABLE public.site_config TO service_role;

CREATE POLICY "Public can read board members"
  ON public.board_members
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can create contact requests"
  ON public.contact_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(btrim(first_name)) > 0
    AND length(first_name) <= 100
    AND length(btrim(last_name)) > 0
    AND length(last_name) <= 100
    AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    AND (company IS NULL OR length(company) <= 255)
    AND length(btrim(message)) > 0
    AND length(message) <= 5000
  );

CREATE POLICY "Public can read events"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (is_visible = true);

CREATE POLICY "Public can read members"
  ON public.members
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can create newsletter signups"
  ON public.newsletter_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email ~* '^[A-Z0-9._%+-]+@([A-Z0-9-]+\.)?nyu\.edu$'
    AND length(btrim(first_name)) > 0
    AND length(first_name) <= 50
    AND length(btrim(last_name)) > 0
    AND length(last_name) <= 50
  );

CREATE POLICY "Public can read semesters"
  ON public.semesters
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read site config"
  ON public.site_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT n.nspname, c.relname, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.polname,
      policy_record.nspname,
      policy_record.relname
    );
  END LOOP;
END $$;

REVOKE ALL PRIVILEGES ON TABLE storage.objects FROM anon, authenticated, public;
GRANT SELECT ON TABLE storage.objects TO anon, authenticated;

CREATE POLICY "Public can read board headshots"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'board-headshots');

CREATE POLICY "Public can read event flyers"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'event-flyers');
