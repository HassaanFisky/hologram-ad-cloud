# Getting Started — HoloLED Cloud Platform

## Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 22+ | Use `.node-version` via `fnm` or `nvm` |
| npm | 10.8+ | Comes with Node 22 |
| Docker | 24+ | For local infrastructure |
| Docker Compose | 2.20+ | Bundled with Docker Desktop |
| Git | 2.40+ | — |

---

## 1. Clone and Install

```bash
git clone https://github.com/your-org/hologram-ad-cloud.git
cd hologram-ad-cloud
npm install
```

---

## 2. Start Infrastructure

The platform requires Postgres, Redis, MinIO (S3-compatible), and EMQX (MQTT broker).

```bash
docker compose up -d
```

This starts:
- `postgres` on port `5432`
- `redis` on port `6379`
- `minio` on port `9000` (console on `9001`)
- `emqx` on port `1883` (dashboard on `18083`)

Wait about 15 seconds for all services to be healthy.

---

## 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

The `.env.example` contains working defaults for local Docker development. You should not need to change anything for local use.

Key variables:

```env
DATABASE_URL=postgresql://hololed:hololed@localhost:5432/hololed
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=<at-least-32-chars>
JWT_REFRESH_SECRET=<at-least-32-chars>
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=hololed-media
MQTT_URL=mqtt://localhost:1883
WEB_ORIGIN=http://localhost:3000
```

---

## 4. Generate Prisma Client

```bash
npm run db:generate
```

This reads `prisma/schema.prisma` and generates the typed Prisma client used by `apps/api`.

---

## 5. Run Database Migrations

```bash
npm run db:migrate
```

This runs all pending Prisma migrations and creates the database schema.

---

## 6. Start Development Servers

Start each service in a separate terminal:

```bash
# Terminal 1 — API
npm run dev:api          # http://localhost:4000

# Terminal 2 — Operator dashboard
npm run dev:web          # http://localhost:3000

# Terminal 3 — Admin panel (optional)
npm run dev:admin        # http://localhost:3001
```

---

## 7. Run CI Checks Locally

```bash
npm run lint        # TypeScript and ESLint checks across all packages
npm run build       # Build all packages and apps
npm test            # Run all tests
npm audit --audit-level=high    # Security audit
```

---

## 8. Create a Platform Admin

After the API starts, use the first-admin endpoint (only works if no admin exists):

```bash
curl -X POST http://localhost:4000/api/v1/auth/register-first-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hololed.dev","password":"change-me-now","name":"Platform Admin"}'
```

---

## Common Errors

### `DATABASE_URL connection refused`
Postgres is not running. Run `docker compose up -d` and wait 15 seconds.

### `prisma generate` fails
Run `npm install` again, then retry. If the schema is invalid, check `prisma/schema.prisma`.

### `JWT_ACCESS_SECRET must be at least 32 characters`
Your `.env` has a short or placeholder secret. Replace with a real random string.

### `npm audit` reports vulnerabilities
Run `npm audit --audit-level=high`. Moderate advisories from Next.js transitive dependencies (PostCSS) are upstream issues — see `CI_FIXES_COMPLETE.md`.

---

## How to Add a New API Module

1. Create a folder under `apps/api/src/<module>/`
2. Add `routes.ts` exporting an async Fastify plugin function
3. Register it in `apps/api/src/main.ts` with the appropriate prefix
4. Add Prisma models to `prisma/schema.prisma` if needed
5. Run `npm run db:migrate` to apply schema changes
6. Add tests under `apps/api/src/<module>/`

---

## How to Add a New Shared Package

1. Create a folder under `packages/<name>/`
2. Add `package.json` with name `@hololed/<name>`, `version: "1.0.0"`, and standard scripts
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Create `src/index.ts` as the package entry point
5. Add `@hololed/<name>: "1.0.0"` to the `dependencies` of any workspace that needs it
6. Run `npm install` to link the workspace package

---

## Directory Reference

```
apps/           Deployable services
packages/       Shared business and infrastructure packages
prisma/         Database schema and migrations
infrastructure/ Docker and Kubernetes assets
tests/          Integration and E2E tests
docs/           Engineering documentation
```
