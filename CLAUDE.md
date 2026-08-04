# CLAUDE.md — TAMID_site_backend

## What it is

- Node.js/Express + TypeScript backend API for the **TAMID Group at NYU** website (`api.nyu-tamid.org`, placeholder).
- Datastore: **Supabase (Postgres)** via `@supabase/supabase-js`; Swagger UI docs served at **`/docs`** (spec at `/docs.json`).
- Adapted from the open-source **SJBA backend template (MIT)**, rebranded to TAMID. Model/route/schema shape is unchanged; only branding strings differ.
- Node **24** (`engines.node: 24.x`), ESM (`"type": "module"`).

## Commands

- `npm install` — install deps.
- `npm run dev` — `tsx watch server.ts` (hot reload).
- `npm run build` — `tsc` (emits `dist/`); `npm run build:check` — `tsc --noEmit` typecheck.
- `npm test` — Jest + supertest (`test:watch`, `test:coverage`, `test:ci`).
- `npm run lint` / `lint:fix` — ESLint; `npm run format` / `format:check` — Prettier. Husky + lint-staged on commit.
- Supabase: `supabase:start|stop|reset|status` (local stack); `supabase:cloud:download` / `supabase:cloud:apply` (`scripts/supabase-cloud.ts` snapshot workflow).

## Structure

- `server.ts` — Express app bootstrap + branded Swagger HTML at `/docs`.
- `routes/*` — public + admin endpoints (boardMembers, events, members, newsletter, contact, semesters, siteConfig, storage/image uploads).
- `models/*` — `BoardMember`, `Event`, `Member`, `NewsletterSignup`, `ContactForm`, `Semester`.
- `middleware/*` — `security.ts` (helmet/cors/rate-limit, referer/origin validation), `auth.ts`, `errorHandler.ts`.
- `config/*` — `swagger.ts` (OpenAPI spec, branded "TAMID Group at NYU API"), `email.ts`, `mailchimp.ts`, `supabase.ts`.
- `api/*`, `supabase/*` (config.toml + `migrations/`), `test/*`, `logger.ts`. Email via **Mailchimp** (list sync) + **Resend** (contact notifications).

## Config / security

- CORS + referer/origin allow-list read from env (`FRONTEND_URL` / `ADMIN_URL`); requests with no referer (curl/direct API) are allowed.
- Newsletter signup is **intentionally gated to `@nyu.edu`** addresses (`routes/newsletter.ts`).
- Local safety switches in env: `SKIP_STARTUP_CONNECTION_TESTS`, `DISABLE_EMAIL_SENDING`, `DISABLE_MAILCHIMP_SYNC` (default `true` locally).

## Brand

- Navy `#18274B` / Sky Blue `#41B5E8`. `/docs` uses a light TAMID theme + inline SVG favicon. See **STYLE.md**.

## Deploy

- GitHub org: **github.com/tamid-nyu** (public); remote `git@github.com:tamid-nyu/TAMID_site_backend.git`.
- Push via **SSH** (HTTPS token lacks `workflow` scope). Hosted on **Vercel** (`vercel.json`); `api.nyu-tamid.org` is a placeholder.

## CRITICAL — secrets

- `.env` is **never committed** (gitignored). `.env.example` must contain **PLACEHOLDERS only**.
- The SJBA template had leaked a real Supabase URL + publishable key; these were scrubbed. **Never re-introduce real creds.**
- The live Supabase project is **`ggpcovdlthmysfouulpq`** ("TAMID Website"). Baseline migration applied; storage buckets `board-headshots` + `event-flyers` created (public). The publishable key + URL are public; the **secret/service_role key stays in `.env` / Vercel only** — never commit it. Do **not** import SJBA data.

## Gotchas

- Keep migration ids short; run `git log --all -- .env*` before pushing.
- Models/schema shape is stable — only branding strings changed from the SJBA original.

## Human TODOs

- Real domain / email / socials.
- Supabase project `ggpcovdlthmysfouulpq` provisioned (schema + buckets done). Still TODO: set `SUPABASE_URL` / publishable / secret keys in **Vercel** env, and the migration-workflow GitHub Actions secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF=ggpcovdlthmysfouulpq`, `SUPABASE_DB_PASSWORD`).
- Real Mailchimp (`MAILCHIMP_*`) and Resend (`RESEND_API_KEY`) keys.
