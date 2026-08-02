# AGENTS.md

## Project Overview

- TypeScript/Express backend for the TAMID Group at NYU site
- It serves the public API and publishes a hand-maintained OpenAPI spec
- The backend integrates with Supabase, Resend, and Mailchimp
- A fair amount of behavior is defined centrally in `server.ts`, middleware, and config modules rather than inside individual route files, so changes in one place often need matching updates elsewhere
- This backend is deployed using Vercel serverless functions: `https://api.nyu-tamid.org`
- The frontend is deployed using vercel: `https://nyu-tamid.org`

## API Contract

- The OpenAPI spec is maintained by hand in `config/swagger.ts`.
- If you change route behavior, middleware behavior, request or response shapes, or status codes, update the spec in the same change.
- Shared `/v1` behavior lives in `server.ts` and middleware. In particular, referer validation and rate limiting apply broadly, so endpoint docs should reflect shared `403` and `429` responses when relevant.
- Do not document in-progress or placeholder endpoints in the public spec unless they are intended to be part of the public API contract.

## Docs And Developer Setup

- If you add, rename, or change environment variables, update `.env.example`.
- If you change setup steps, local development behavior, scripts, or notable runtime behavior, keep it discoverable from `README.md`; update the detailed linked docs when they are the better home for the content.
- Supabase docs start at `SUPABASE.md`. Local setup and cloud snapshot workflow belongs in `supabase/docs/supabase-local.md`; migration and production drift workflow belongs in `supabase/docs/supabase-migrations.md`.
- Prefer keeping local-development affordances discoverable. If you add a dev flag or bypass, document it in `.env.example` and in the relevant setup docs linked from `README.md`.

## Complete Local Supabase Mirror

Use this sequence when setting up a complete local Supabase that mirrors cloud schema, rows, policies, and the project media buckets.

1. Install prerequisites: Node `24.x`, Supabase CLI, and Docker Desktop or another Docker-compatible runtime.
2. Copy `.env.example` to `.env`.
3. Start local Supabase:
   ```bash
   npm run supabase:start
   ```
4. Map only the values this backend actually reads from the `supabase start` output into `.env`:
   - `Project URL` -> `SUPABASE_URL`
   - `Publishable` -> `SUPABASE_PUBLISHABLE_KEY`
   - `Secret` -> `SUPABASE_SECRET_KEY` for backend-only admin routes
5. Do not add the CLI Studio, Mailpit, MCP, or S3 values to `.env` unless code is added that reads them.
6. Keep local safety switches enabled unless intentionally testing external providers:
   ```env
   SKIP_STARTUP_CONNECTION_TESTS=true
   DISABLE_EMAIL_SENDING=true
   DISABLE_MAILCHIMP_SYNC=true
   ```
7. Reset the local database to repo migrations:
   ```bash
   npm run supabase:reset
   ```
8. Link the repo to the cloud Supabase project if it is not already linked:
   ```bash
   supabase link --project-ref <project-ref>
   ```
9. Download the cloud snapshot into the gitignored local snapshot directory:
   ```bash
   npm run supabase:cloud:download -- --yes
   ```
   The script must invoke Supabase storage copy commands with `--experimental`; current Supabase CLI versions require that flag for `storage cp`.
10. Apply the downloaded rows and storage objects locally:
    ```bash
    npm run supabase:cloud:apply
    ```
11. Start the backend:
    ```bash
    npm run dev
    ```
12. Confirm the startup INFO log says `local Supabase`. If it says `production Supabase`, stop and fix `SUPABASE_URL` before making local test writes.

Cloud snapshot data lives under `supabase/.cloud-snapshot/`, may contain production rows/media, and must remain gitignored. The apply step does not contact production; only the download step does.

## Architecture Notes

- Route handlers live under `routes/`, but external-service setup and shared behavior are spread across `config/`, `middleware/`, `models/`, and `server.ts`.
- Before changing endpoint docs, check whether the behavior actually comes from shared middleware or a central integration module.
- Supabase migrations must be created with `supabase migration new <name>` rather than hand-invented timestamped filenames.
- Cloud snapshots live under `supabase/.cloud-snapshot/`, may contain production rows/media, and must remain gitignored.

## Before finishing

- Run `npm run build:check`.
- For Supabase workflow changes, also run the relevant dry-run script such as `npm run supabase:cloud:download -- --dry-run --yes`.
- Review the diff for docs/config drift, especially `README.md`, `SUPABASE.md`, `supabase/docs/supabase-local.md`, `supabase/docs/supabase-migrations.md`, `.env.example`, `supabase/config.toml`, migrations, and `config/swagger.ts`.
