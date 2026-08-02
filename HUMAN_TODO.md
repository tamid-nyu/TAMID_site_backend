# TAMID Backend — Human-Owned Steps

This document enumerates every credential, domain, and external-service configuration step that the TAMID backend rebrand deliberately did NOT automate. These are **human-owned tasks** that must be completed before the application can go live.

---

## T1. Domain Registration & DNS Pointing

**Status**: PLACEHOLDER (not implemented; human-owned)

The backend currently references the placeholder domain `nyu-tamid.org` and its subdomains in configuration and documentation:

- `api.nyu-tamid.org` (API backend)
- `admin.nyu-tamid.org` (Admin frontend)
- `status.nyu-tamid.org` (Status page, if used)
- `bot.nyu-tamid.org` (Resend transactional email sending domain)

**Action Required**:

1. Confirm that `nyu-tamid.org` is the domain TAMID Group at NYU will use, or select a different domain.
2. If using a different domain, **replace ALL occurrences** of `nyu-tamid.org` in:
   - `README.md` (live URL block)
   - `.env.example` (FRONTEND_URL/ADMIN_URL comments and test values)
   - `config/swagger.ts` (servers[].url, example contact, documentation)
   - `config/email.ts` (from-address domain `contact@bot.<domain>`)
   - `models/ContactForm.ts` (fallback recipient email, if using a different contact domain)
3. Register the domain and configure DNS:
   - A/AAAA records for `api.<domain>` → Vercel deployment IP
   - A/AAAA records for `admin.<domain>` → Vercel frontend deployment IP
   - CNAME or A record for `status.<domain>` (if deploying a status page)
   - CNAME for `bot.<domain>` → Resend verification (see T3)

---

## T2. Supabase Project Creation & Migrations

**Status**: NOT AUTOMATED (human-owned)

The backend is designed to work with an empty, brand-new Supabase Postgres project. **Do NOT import SJBA data.**

**Action Required**:

1. Create a new empty Supabase organization or project:
   - Go to https://supabase.com → sign in or create an account
   - Create a new project under TAMID Group at NYU's organization
   - Choose a project reference name (e.g., `tamid-nyu` or similar)
   - Note the **project reference** (used in URLs like `<ref>.supabase.co`)

2. Set Supabase environment variables in Vercel (see the Vercel project settings for this backend):
   - `SUPABASE_URL`: `https://<your-project-ref>.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY`: Copy from Supabase project settings → API → "anon" key
   - `SUPABASE_SECRET_KEY`: Copy from Supabase project settings → API → "service_role" key

3. Run migrations against the new project:

   ```bash
   # From the repo root (locally or via a deployment step):
   npx supabase migration up --project-ref <your-project-ref>
   # OR: use the Supabase dashboard SQL editor to run the .sql files from supabase/migrations/
   ```

4. Create storage buckets:
   - In the Supabase dashboard, go to Storage → Create new bucket
   - Create bucket `board-headshots` (for board member profile images):
     - **Public**: yes (or set RLS policies; RLS is already defined in migrations)
     - **File size limit**: 10 MB (recommended for headshots)
   - Create bucket `event-flyers` (for event promotional images):
     - **Public**: yes (or set RLS policies; RLS is already defined in migrations)
     - **File size limit**: 50 MB (recommended for high-res flyers)

5. Verify RLS policies (these are already created by migrations):
   - All RLS policies defined in `supabase/migrations/*_add_storage_policies.sql` and `*_lock_down_public_policies.sql` are automatically applied
   - Confirm in Supabase dashboard → Storage → each bucket → Policies tab

**Outcome**: The database schema (tables, columns, indexes, RLS) and storage buckets are ready.

---

## T3. Email Service Setup — Resend

**Status**: PLACEHOLDER (human-owned)

The backend sends transactional emails (contact form submissions, notification emails) via **Resend**.

**Action Required**:

1. Create a Resend account if not already done:
   - Go to https://resend.com → sign up
   - Create a new API key for the TAMID project (do NOT use a shared key with other organizations)
   - Copy the API key

2. Verify the sending domain:
   - In Resend dashboard, go to Domains
   - Add domain: `bot.<your-domain>` (e.g., `bot.nyu-tamid.org`)
   - Follow Resend's DNS verification steps (they will provide SPF/DKIM records to add to your DNS)
   - Ensure the domain shows "Verified" status before sending emails

3. Set the Resend API key in Vercel:
   - Vercel project settings → Environment Variables
   - Add: `RESEND_API_KEY` = `<your-resend-api-key>`

4. Update the from-address if not using the placeholder domain:
   - The backend currently sends from `contact@bot.nyu-tamid.org`
   - If your domain differs, edit `config/email.ts`:
     ```typescript
     from: 'contact@bot.<your-domain>'; // e.g., 'contact@bot.tamid.org'
     ```

**Outcome**: Transactional emails (contact form submissions) are routed through a verified Resend domain.

**Note**: The contact notification recipient email is set to `tamid@nyu.edu` (see config/email.ts and models/ContactForm.ts). Ensure this address exists and is monitored.

---

## T4. Mailchimp Newsletter Setup

**Status**: PLACEHOLDER (human-owned)

The backend integrates with **Mailchimp** to manage newsletter subscribers.

**Action Required**:

1. Create or log into a Mailchimp account:
   - Go to https://mailchimp.com → sign in or sign up
   - Create a workspace for TAMID Group at NYU (if not already done)

2. Create a new Mailchimp **audience** (mailing list):
   - Mailchimp → Audiences → Create Audience
   - Set a name like "TAMID Group at NYU Newsletter" or "TAMID Newsletter Subscribers"
   - Configure required fields: Email, FNAME (first name), LNAME (last name)
   - (Optional) Add MMERGE6 for any additional demographic data the org wants to track
   - Save and note the **Audience/List ID** (visible in Audience settings)

3. Set Mailchimp credentials in Vercel environment:
   - `MAILCHIMP_API_KEY`: Copy from Mailchimp account settings → Extras → API keys → Create new key
   - `MAILCHIMP_SERVER_PREFIX`: Visible in the API key details (e.g., `us1`, `us5`, etc.)
   - `MAILCHIMP_LIST_ID`: Copy from Audience settings (the list/audience ID)

**Outcome**: Newsletter subscribers are added/removed from the TAMID Mailchimp audience automatically via the backend's `/v1/newsletter/subscribe` and `/v1/newsletter/unsubscribe` endpoints.

**Note**: The backend enforces a `@nyu.edu` email gate for newsletter signup (see `routes/newsletter.ts`). Only NYU-affiliated users can subscribe.

---

## T5. CORS & Referer Security Configuration

**Status**: PLACEHOLDER (human-owned)

The backend enforces CORS and Referer validation to prevent unauthorized requests from mismatched origins.

**Action Required**:

1. Deploy the TAMID frontend and admin SPA:
   - Frontend (public): note its deployed origin (e.g., `https://www.nyu-tamid.org` or `https://tamid.nyu.edu`)
   - Admin panel: note its deployed origin (e.g., `https://admin.nyu-tamid.org`)

2. Set CORS allowed origins in Vercel environment:
   - `FRONTEND_URL`: Set to the deployed frontend origin (the origin that serves the public website)
   - `ADMIN_URL`: Set to the deployed admin panel origin (the origin that serves the admin SPA)

   Example:

   ```
   FRONTEND_URL=https://www.nyu-tamid.org
   ADMIN_URL=https://admin.nyu-tamid.org
   ```

3. Verify CORS + Referer validation:
   - The backend's `middleware/security.ts` validates that incoming requests have:
     - Origin header matching FRONTEND_URL or ADMIN_URL (CORS enforcement)
     - Referer header matching the allowed origins (Referer validation, INV3)
   - Test that the frontend can make requests; non-matching origins will receive 403 Forbidden

**Outcome**: Only authorized frontend/admin origins can call the API.

**CRITICAL**: This is a **go-live blocker**. CORS + Referer must be correctly configured before the frontend is deployed to production.

---

## T6. Social Media Handles (Verify/Replace)

**Status**: PLACEHOLDER (defensive scan; likely no-op in this repo)

The TAMID organization may have social media presence that should be referenced in documentation or frontend (out of scope for this backend).

**Action Required** (if adding social links to backend-served content, e.g., site_config or docs):

1. Confirm the official social media handles:
   - **LinkedIn**: Company page handle (currently placeholder: `company/tamidgroup`)
   - **Instagram**: Account handle (currently placeholder: `nyutamid`)

2. If social links appear in this backend's code/docs/Swagger, replace the placeholders:
   - Search the repo for `tamidgroup` and `nyutamid` to confirm no hardcoded links
   - If found, update to match the actual social accounts

**Note**: This repo's business logic does NOT embed social links; social presence is typically managed in the frontend/admin and on external platforms. This step is defensive.

---

## T7. GitHub Repository & Access Control

**Status**: PLACEHOLDER (human-owned git operation)

The rebuilt TAMID backend is currently a **local git repository with no remote**. It must be pushed to a GitHub remote for collaboration and CI/CD.

**Action Required**:

1. Create a GitHub repository (if not already done):
   - Organization: `TAMID-Group-at-NYU` (create if needed on GitHub)
   - Repository name: `TAMID_site_backend`
   - Visibility: **Private** (recommended for internal tooling; can be made public if desired)
   - Do NOT initialize with README/license/gitignore (we already have them)

2. Add the remote to the local repo:

   ```bash
   cd /Users/aaron_7nh0yzm/tamid-nyu/TAMID_site_backend
   git remote add origin git@github.com:TAMID-Group-at-NYU/TAMID_site_backend.git
   ```

3. Push the initial commit:

   ```bash
   git branch -M main
   git push -u origin main
   ```

   (First push from a new local repo must create the branch on the remote.)

4. Configure branch protection (GitHub dashboard):
   - Go to Settings → Branches → Add rule
   - Pattern: `main`
   - Require pull request reviews before merging (optional, recommended)
   - Require status checks to pass before merging (recommended: GitHub Actions CI when set up)
   - Dismiss stale PR approvals when new commits are pushed (optional)

5. Add collaborators:
   - GitHub → Settings → Collaborators → Add people
   - Invite TAMID leadership (e.g., Director of Technology, engineering leads)

**Outcome**: The repo is backed up to GitHub, accessible to the team, and has CI/CD/protection configured.

---

## Summary of Placeholders Remaining

This backend rebrand uses the following placeholder values, all of which require human configuration:

| Item                    | Placeholder                         | Real Value                                                 | Where to Set                                                  |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Base domain             | `nyu-tamid.org`                     | (e.g., `tamid.nyu.edu`)                                    | DNS, README, .env.example, config/swagger.ts, config/email.ts |
| API subdomain           | `api.nyu-tamid.org`                 | (e.g., `api.tamid.nyu.edu`)                                | DNS, config/swagger.ts                                        |
| Admin subdomain         | `admin.nyu-tamid.org`               | (e.g., `admin.tamid.nyu.edu`)                              | DNS, .env.example                                             |
| Email sending domain    | `bot.nyu-tamid.org`                 | (e.g., `bot.tamid.nyu.edu`)                                | DNS, config/email.ts, Resend                                  |
| Supabase URL            | `https://<project-ref>.supabase.co` | (e.g., `https://tamid-nyu.supabase.co`)                    | Vercel env `SUPABASE_URL`                                     |
| Supabase keys           | (empty/placeholder)                 | From Supabase project                                      | Vercel env `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`  |
| Contact email           | `tamid@nyu.edu`                     | Confirm receipt address                                    | models/ContactForm.ts (verify inbox)                          |
| Resend API key          | (empty/placeholder)                 | From Resend dashboard                                      | Vercel env `RESEND_API_KEY`                                   |
| Mailchimp API key       | (empty/placeholder)                 | From Mailchimp account                                     | Vercel env `MAILCHIMP_API_KEY`                                |
| Mailchimp server prefix | (empty/placeholder)                 | From Mailchimp API key                                     | Vercel env `MAILCHIMP_SERVER_PREFIX`                          |
| Mailchimp list ID       | (empty/placeholder)                 | From Mailchimp audience                                    | Vercel env `MAILCHIMP_LIST_ID`                                |
| Frontend URL (CORS)     | `https://nyu-tamid.org`             | Real deployed frontend                                     | Vercel env `FRONTEND_URL`                                     |
| Admin URL (CORS)        | `https://admin.nyu-tamid.org`       | Real deployed admin                                        | Vercel env `ADMIN_URL`                                        |
| GitHub remote           | (no remote)                         | `git@github.com:TAMID-Group-at-NYU/TAMID_site_backend.git` | `git remote add origin ...`                                   |
| Social handles          | `tamidgroup`, `nyutamid`            | Actual social accounts                                     | Frontend/docs (backend does not embed)                        |

---

## Before Going Live

**Checklist** (perform these verification steps after completing all of the above):

- [ ] Domain `nyu-tamid.org` (or chosen) is registered and DNS is propagated
- [ ] Supabase project is created, migrations are applied, storage buckets exist
- [ ] Resend domain is verified and API key is set in Vercel
- [ ] Mailchimp audience is created and credentials are set in Vercel
- [ ] `FRONTEND_URL` and `ADMIN_URL` are set in Vercel (go-live blocker)
- [ ] GitHub repo is created, remote is added, and initial code is pushed
- [ ] Run `npm install && npm run build:check && npm test` locally to confirm no regressions
- [ ] Manually test:
  - [ ] `/docs` loads and shows "TAMID API"
  - [ ] `/` returns JSON with name "TAMID API"
  - [ ] Newsletter signup rejects non-@nyu.edu, accepts @nyu.edu
  - [ ] Contact form sends email to tamid@nyu.edu from verified Resend domain
  - [ ] CORS allows the real frontend/admin origins only

---

## Notes

- **No secrets in git**: This repository contains NO secrets. All credentials (API keys, URLs, etc.) are environment variables set in Vercel, NOT in code or .git history.
- **Attribution**: This backend is adapted from the open-source Stern Jewish Business Association backend template (MIT License). See `LICENSE` for the full attribution.
- **Branding is complete**: All SJBA → TAMID rebrand strings have been applied. The business logic, schema, and API contracts remain identical to the source template.

---

_Generated: 2026-08-02 as part of the TAMID Backend Rebrand Buildout Phase 6_
