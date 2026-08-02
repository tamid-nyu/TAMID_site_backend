# Supabase Development

This backend repo owns TAMID Supabase configuration, migrations, local setup, storage buckets, and cloud snapshots. The frontend and admin dashboard should talk to the backend API; they should not own database migrations or privileged Supabase keys.

## Public And Admin Access Model

The public frontend uses the backend API and may also use Supabase public media URLs. Direct frontend/database access is intentionally narrow:

- Public-read tables: `board_members`, `events`, `members`, `semesters`, `site_config`
- Public insert-only tables: `contact_requests`, `newsletter_signups`
- Frontend users must not read `contact_requests` or `newsletter_signups`
- Frontend users must not update or delete any application table rows
- Public storage buckets `board-headshots` and `event-flyers` are read-only for end users

Admin writes go through authenticated backend resource endpoints, such as `POST /v1/events` and `PUT /v1/events/{id}`, that use `SUPABASE_SECRET_KEY` server-side after admin-token verification. Private admin collections are available at `/v1/contact-requests` and `/v1/newsletter-signups`. Admin bucket management is available at `/v1/storage/buckets` and `/v1/storage/buckets/{bucketId}/objects` for bucket listing, object upload, object replacement, rename/move, and deletion. Do not expose a Supabase secret key to the frontend or admin browser bundle.

Supabase Storage folders are virtual path prefixes, not standalone empty folder records. The admin panel should create folders by uploading objects under a prefix, and should use recursive move/delete only when it intentionally wants to affect every object below that prefix.

## Docs

- [Local Supabase setup and cloud mirror](./supabase/docs/supabase-local.md)
- [Supabase migrations and production drift](./supabase/docs/supabase-migrations.md)

## Production Migration Deploys

Production schema changes are deployed by GitHub Actions from committed migration files. Create and test migrations locally, commit them, open a PR, and merge to `main`; `.github/workflows/supabase-migrations.yml` runs `supabase db push` against the production Supabase project.

The workflow requires these GitHub Actions secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

## Official References

- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Supabase CLI Getting Started](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Backup and Restore with the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
