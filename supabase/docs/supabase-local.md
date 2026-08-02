# Local Supabase

Use this for a complete local Supabase setup that mirrors cloud schema, rows, policies, and TAMID media buckets.

## Prerequisites

- Node `24.x`
- npm, included with Node
- Git
- Docker Desktop or another Docker-compatible runtime
- Supabase CLI
- `psql`, required for applying downloaded cloud row dumps locally

## Start Local Supabase

```bash
npm run supabase:start
```

Copy only these values from `supabase start` into `.env`:

- `Project URL` -> `SUPABASE_URL`
- `Publishable` -> `SUPABASE_PUBLISHABLE_KEY`
- `Secret` -> `SUPABASE_SECRET_KEY` for backend-only admin routes

The local `SUPABASE_URL` default is:

```text
http://127.0.0.1:54321
```

The default local database URL used by the cloud snapshot apply script is:

```text
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

The CLI also prints database URL, Studio, Mailpit, MCP, and S3 values. Do not add them to `.env` for the current backend; this repo does not read them.

Keep local safety switches enabled unless intentionally testing external providers:

```env
SKIP_STARTUP_CONNECTION_TESTS=true
DISABLE_EMAIL_SENDING=true
DISABLE_MAILCHIMP_SYNC=true
```

## Local Commands

```bash
npm run supabase:status
npm run supabase:reset
npm run supabase:stop
```

`npm run supabase:reset` applies repo migrations to the local database. Run it before `npm run supabase:cloud:apply`; the cloud snapshot import is data/media only and expects the application tables, policies, and storage buckets to already exist from migrations and `supabase/config.toml`.

## Cloud Snapshot Mirror

Cloud snapshots download production configuration and data into `supabase/.cloud-snapshot/latest/`, which is gitignored. Snapshots may include production rows from `members`, `newsletter_signups`, and `contact_requests`, so treat the directory as sensitive local data.

Link the repo to cloud Supabase if needed:

```bash
supabase link --project-ref <project-ref>
```

Download the snapshot:

```bash
npm run supabase:cloud:download -- --yes
```

The script passes `--experimental` to Supabase storage copy commands because `supabase storage cp` is still experimental in the CLI.
Before each bucket download, the script removes only that bucket's existing destination under `storage/` and then copies into the parent `storage/` directory. This accounts for the CLI preserving the source bucket directory and makes repeated downloads idempotent.

Dry-run without contacting production or downloading files:

```bash
npm run supabase:cloud:download -- --dry-run --yes
```

The download writes:

- `roles.sql`
- `schema.sql` for `public,storage`
- `data.sql` for all `public` application rows
- `storage/board-headshots/`
- `storage/event-flyers/`
- `manifest.json`

Auth internals such as `auth.users` are not downloaded.

While Supabase is running (`npm run supabase:start`), apply the downloaded snapshot locally:

```bash
npm run supabase:reset
npm run supabase:cloud:apply
```

The reset step is required because it creates the local schema from `supabase/migrations/` before rows are imported. The apply step imports `data.sql` into local Supabase with `psql` because the dump uses PostgreSQL `COPY ... FROM stdin` format. It then uploads downloaded objects into local Storage with the Supabase CLI. It does not contact production.

Storage upload paths are calculated relative to each bucket directory's contents. A snapshot containing a duplicated bucket directory such as `storage/event-flyers/event-flyers/` is rejected rather than uploaded with the bucket name embedded in its object paths.

Optional overrides:

```bash
SUPABASE_CLOUD_SNAPSHOT_DIR=supabase/.cloud-snapshot/latest
SUPABASE_DOWNLOAD_BUCKETS=board-headshots,event-flyers
SUPABASE_LOCAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Storage URLs

Local storage buckets are declared in `supabase/config.toml` and reinforced by migrations:

- `board-headshots`
- `event-flyers`

Both buckets are public-read media buckets. Anonymous writes are not granted.

Frontend/admin local media base URLs:

```text
http://127.0.0.1:54321/storage/v1/object/public/board-headshots/
http://127.0.0.1:54321/storage/v1/object/public/event-flyers/
```

## Backend Check

Start the backend:

```bash
npm run dev
```

Confirm the startup INFO log says `local Supabase`. If it says `production Supabase`, stop and fix `SUPABASE_URL` before making local test writes.
