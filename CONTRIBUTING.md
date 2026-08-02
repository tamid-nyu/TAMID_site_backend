# Contributing

## Local Development

### Prerequisites

- Node.js (v24.x)
- npm
- Git
- Docker Desktop or another Docker-compatible container runtime
- Supabase CLI
- `psql`

Production provider accounts/keys for Supabase, Resend, and Mailchimp are not required for ordinary local development. Keep the local safety switches in `.env` enabled unless intentionally testing those integrations.

### Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/tamid-nyu/TAMID_site_backend.git
   cd TAMID_site_backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

   **Local safety switches:**
   - `SKIP_STARTUP_CONNECTION_TESTS=true`
   - `DISABLE_EMAIL_SENDING=true`
   - `DISABLE_MAILCHIMP_SYNC=true`

   Start local Supabase and copy only the backend values from the `supabase start` output:

   ```bash
   npm run supabase:start
   ```

   - `Project URL` -> `SUPABASE_URL`
   - `Publishable` -> `SUPABASE_PUBLISHABLE_KEY`
   - `Secret` -> `SUPABASE_SECRET_KEY` for backend-only admin routes

4. **Reset local Supabase and apply downloaded cloud data (see [SUPABASE.md](./SUPABASE.md))**

   ```bash
   npm run supabase:reset
   npm run supabase:cloud:apply
   ```

5. **Start development server**

   ```bash
   npm run dev
   ```

   By default, the API will be available at `http://localhost:3000`

### Local URLs

- API: `http://localhost:3000`
- Swagger docs: `http://localhost:3000/docs`
- Local Supabase API: `http://127.0.0.1:54321`
- Local Supabase Studio: `http://127.0.0.1:54323`

### Supabase Workflows

For Supabase workflows, see [SUPABASE.md](./SUPABASE.md). For the full local setup and cloud mirror sequence, go directly to [supabase/docs/supabase-local.md](./supabase/docs/supabase-local.md).

Production Supabase migrations are deployed by GitHub Actions after migration files are merged to `main`; see [supabase/docs/supabase-migrations.md](./supabase/docs/supabase-migrations.md).

Cloud snapshots replace the old sample seed script. They may contain production rows and media, so `supabase/.cloud-snapshot/` is gitignored and must stay local.

### API Documentation

| URL                                                 | Description              |
| --------------------------------------------------- | ------------------------ |
| [`/docs`](https://api.nyu-tamid.org/docs)           | Swagger UI               |
| [`/docs.json`](https://api.nyu-tamid.org/docs.json) | Raw JSON spec for agents |

Locally: `http://localhost:3000/docs`

`GET /v1/events` supports explicit event-time sorting via `sort=startTime:asc` or `sort=startTime:desc`. The default is `startTime:asc`; see `/docs` for the full pagination and filtering contract.

### Available Scripts

- `npm run dev` - Start development server with hot reload (tsx watch)
- `npm start` - Start production server
- `npm run build` - Compile TypeScript
- `npm run build:check` - Type-check without emitting
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without writing
- `npm test` - Run Jest tests
- `npm run test:watch` - Run Jest in watch mode
- `npm run test:coverage` - Run Jest with coverage locally
- `npm run test:ci` - Run the CI test command
- `npm run supabase:start` - Start local Supabase
- `npm run supabase:stop` - Stop local Supabase
- `npm run supabase:reset` - Reset local Supabase database to migrations
- `npm run supabase:status` - Show local Supabase service status
- `npm run supabase:cloud:download -- --yes` - Download a gitignored production cloud snapshot
- `npm run supabase:cloud:apply` - Apply the downloaded cloud snapshot to local Supabase

### Pre-commit Checks

This repo uses Husky and lint-staged. After `npm install`, the `prepare` script installs the Git hooks. On commit, staged TypeScript and JavaScript files are linted, and staged TypeScript, JavaScript, JSON, Markdown, YAML, and YML files are formatted. If the hook rewrites a file, review and re-stage it before committing again.

### Testing

This project uses Jest with Supertest for backend API tests.

- Test files use `*.test.ts` and usually live next to the code they cover.
- Use Supertest for route, middleware, status-code, and response-shape coverage.
- Use unit tests for models, config helpers, validators, scripts, and data mapping.
- Mock Supabase, Resend, and Mailchimp. The default suite must not require Docker, local Supabase, or provider keys.
- Prefer concrete status, response, query-call, and side-effect assertions over snapshots.

Common commands:

```bash
npm test
npm run test:watch
npm run test:coverage
npm run test:ci
```

Before opening a PR, run `npm run build:check` and `npm run test:ci`. Add or update tests when route behavior, middleware, request/response shapes, model mapping, provider behavior, or meaningful error handling changes.

### Environment Notes

- In `NODE_ENV=development`, rate limiting is disabled by default.
- Set `ENABLE_RATE_LIMIT=true` to force rate limiting on locally when you want to test `429` handling.
- Set `SKIP_STARTUP_CONNECTION_TESTS=true` to skip the startup Mailchimp and Supabase connectivity checks.
- Set `DISABLE_EMAIL_SENDING=true` to let contact form flows work locally without sending outbound email.
- Set `DISABLE_MAILCHIMP_SYNC=true` to let newsletter signups work locally without touching Mailchimp.
- Set `LOG_LEVEL=silent` or `LOG_LEVEL=debug` to reduce or increase local logging verbosity.

## Contributions

### Code ownership

Code ownership is controlled by TAMID's Director of Technology.

To propose a change, create a new Git branch based on `main`:

```bash
git switch -c your-name/title-of-change-or-addition
```

A code owner will review and merge your changes in a timely manner.

Contact the Director of Technology with any questions.
