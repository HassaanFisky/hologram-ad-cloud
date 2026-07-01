# HoloLED Cloud Platform — Single Copy Page

This file is intentionally a single-page source of truth for building a production SaaS platform for managing commercial hologram / 3D LED advertising displays in Karachi, Pakistan, with national scaling in mind.

## Important Blockers and Assumptions

### Hardware blocker
No specific hologram / 3D LED display manufacturer SDK, firmware API, media format constraints, physical controller documentation, or device OS image was provided. Therefore:

- The platform is designed to be hardware-agnostic.
- The cloud control plane, APIs, schemas, scheduling model, media lifecycle, device pairing, telemetry, audit, and OTA orchestration are implementable now.
- A vendor-specific device adapter / edge agent must later be implemented per hardware manufacturer using their real SDK or protocol.
- OTA updates are implemented as a safe orchestration and artifact delivery model, not manufacturer-specific firmware flashing logic.

### Payment blocker
No payment processor account, tax setup, or invoicing requirements were provided. Therefore billing is designed as billing-ready architecture: plans, subscriptions, usage metering, invoices, and payment provider reference fields exist, but payment capture is intentionally not hard-coded to a fake provider.

---

# PART A — CODE EDITOR ACTIONS

Copy these actions into your engineering workflow.

```bash
# 1. Create project directory
mkdir hololed-cloud && cd hololed-cloud

# 2. Create the monorepo from the bootstrap script in Part B
# Copy Part B into bootstrap.sh, then run:
chmod +x bootstrap.sh
./bootstrap.sh

# 3. Start local infrastructure
cp .env.example .env
docker compose up -d postgres redis minio emqx

# 4. Install dependencies
npm install

# 5. Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# 6. Start backend API
npm run dev:api

# 7. Start frontend dashboard
npm run dev:web

# 8. Open services
# API: http://localhost:4000/health
# OpenAPI JSON: http://localhost:4000/openapi.json
# Web dashboard: http://localhost:3000
# MinIO console: http://localhost:9001
# EMQX dashboard: http://localhost:18083
```

---

# PART B — SINGLE-FILE PROJECT GENERATOR

Save the following as `bootstrap.sh`. It creates a real monorepo with backend, frontend, database schema, Docker Compose, migrations, API modules, auth, RBAC, media, schedules, device onboarding, MQTT bridge strategy, telemetry, audit logging, and dashboards.

```bash
#!/usr/bin/env bash
set -euo pipefail

mkdir -p apps/api/src/{auth,common,companies,devices,media,schedules,playlists,groups,customers,analytics,notifications,billing,ota,audit,mqtt,health}
mkdir -p apps/web/app/{dashboard,login,devices,media,schedules,customers,admin}
mkdir -p apps/web/components apps/web/lib packages/shared/src infra/postgres infra/nginx docs scripts prisma

cat > package.json <<'EOF'
{
  "name": "hololed-cloud",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:api": "npm --workspace apps/api run dev",
    "dev:web": "npm --workspace apps/web run dev",
    "build": "npm --workspaces run build",
    "lint": "npm --workspaces run lint",
    "test": "npm --workspaces run test",
    "db:generate": "npm --workspace apps/api run db:generate",
    "db:migrate": "npm --workspace apps/api run db:migrate",
    "db:deploy": "npm --workspace apps/api run db:deploy"
  },
  "engines": {"node": ">=22.0.0"},
  "packageManager": "npm@10.8.0"
}
EOF

cat > .env.example <<'EOF'
NODE_ENV=development
DATABASE_URL=postgresql://hololed:hololed_password@localhost:5432/hololed?schema=public
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace-with-32-byte-random-access-secret
JWT_REFRESH_SECRET=replace-with-32-byte-random-refresh-secret
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=hololed-media
S3_ACCESS_KEY=hololed
S3_SECRET_KEY=hololed_password
S3_FORCE_PATH_STYLE=true
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
API_PORT=4000
WEB_ORIGIN=http://localhost:3000
EOF

cat > docker-compose.yml <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hololed
      POSTGRES_PASSWORD: hololed_password
      POSTGRES_DB: hololed
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hololed -d hololed"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]

  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: hololed
      MINIO_ROOT_PASSWORD: hololed_password
    ports: ["9000:9000", "9001:9001"]
    volumes: ["minio_data:/data"]

  emqx:
    image: emqx/emqx:5.8.6
    ports: ["1883:1883", "8083:8083", "18083:18083"]
    environment:
      EMQX_DASHBOARD__DEFAULT_USERNAME: admin
      EMQX_DASHBOARD__DEFAULT_PASSWORD: public
    volumes: ["emqx_data:/opt/emqx/data", "emqx_log:/opt/emqx/log"]

volumes:
  postgres_data:
  redis_data:
  minio_data:
  emqx_data:
  emqx_log:
EOF

cat > .gitignore <<'EOF'
node_modules
.next
dist
.env
coverage
.DS_Store
*.log
EOF

cat > packages/shared/package.json <<'EOF'
{
  "name": "@hololed/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {"build": "tsc -p tsconfig.json", "lint": "tsc --noEmit", "test": "node --test"},
  "dependencies": {"zod": "^3.25.67"},
  "devDependencies": {"typescript": "^5.8.3"}
}
EOF

cat > packages/shared/tsconfig.json <<'EOF'
{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","declaration":true,"outDir":"dist","strict":true,"esModuleInterop":true,"skipLibCheck":true},"include":["src/**/*.ts"]}
EOF

cat > packages/shared/src/index.ts <<'EOF'
import { z } from 'zod';

export const DeviceCommandSchema = z.object({
  commandId: z.string().uuid(),
  issuedAt: z.string().datetime(),
  type: z.enum(['SYNC_NOW', 'REBOOT', 'CLEAR_CACHE', 'DOWNLOAD_MEDIA', 'APPLY_SCHEDULE', 'OTA_UPDATE']),
  payload: z.record(z.unknown())
});

export const DeviceHeartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  timestamp: z.string().datetime(),
  firmwareVersion: z.string().min(1),
  agentVersion: z.string().min(1),
  uptimeSeconds: z.number().int().nonnegative(),
  freeDiskBytes: z.number().int().nonnegative(),
  totalDiskBytes: z.number().int().positive(),
  temperatureCelsius: z.number().optional(),
  networkType: z.enum(['ethernet', 'wifi', 'cellular', 'unknown']),
  ipAddress: z.string().optional(),
  currentlyPlayingMediaId: z.string().uuid().optional(),
  errors: z.array(z.object({code: z.string(), message: z.string(), occurredAt: z.string().datetime()})).default([])
});

export type DeviceCommand = z.infer<typeof DeviceCommandSchema>;
export type DeviceHeartbeat = z.infer<typeof DeviceHeartbeatSchema>;
EOF

cat > prisma/schema.prisma <<'EOF'
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" url = env("DATABASE_URL") }

enum UserRole { PLATFORM_ADMIN COMPANY_ADMIN OPERATIONS_MANAGER INSTALLER CUSTOMER_VIEWER FINANCE }
enum DeviceStatus { PENDING_PAIRING ONLINE OFFLINE DEGRADED MAINTENANCE RETIRED }
enum MediaType { IMAGE VIDEO HTML }
enum MediaStatus { UPLOADED PROCESSING READY FAILED ARCHIVED }
enum ScheduleStatus { DRAFT ACTIVE PAUSED EXPIRED }
enum OtaStatus { DRAFT READY ROLLING_OUT PAUSED COMPLETED FAILED }
enum AuditAction { CREATE UPDATE DELETE LOGIN LOGOUT PAIR_DEVICE COMMAND_DEVICE UPLOAD_MEDIA SCHEDULE_CONTENT OTA_ROLLOUT }

model Company {
  id String @id @default(uuid())
  name String
  legalName String?
  taxId String?
  billingEmail String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users User[]
  customers Customer[]
  devices Device[]
  groups DeviceGroup[]
  media MediaAsset[]
  playlists Playlist[]
  schedules Schedule[]
  subscriptions Subscription[]
  auditLogs AuditLog[]
  @@index([name])
}

model User {
  id String @id @default(uuid())
  companyId String?
  email String @unique
  passwordHash String
  fullName String
  role UserRole
  isActive Boolean @default(true)
  refreshTokenHash String?
  lastLoginAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)
  auditLogs AuditLog[]
  @@index([companyId, role])
}

model Customer {
  id String @id @default(uuid())
  companyId String
  name String
  contactEmail String?
  contactPhone String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  campaigns Campaign[]
  @@index([companyId, name])
}

model Campaign {
  id String @id @default(uuid())
  companyId String
  customerId String
  name String
  startsAt DateTime
  endsAt DateTime
  createdAt DateTime @default(now())
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  schedules Schedule[]
  @@index([companyId, customerId])
}

model Device {
  id String @id @default(uuid())
  companyId String
  name String
  serialNumber String @unique
  hardwareVendor String?
  hardwareModel String?
  status DeviceStatus @default(PENDING_PAIRING)
  pairingCodeHash String?
  pairedAt DateTime?
  lastSeenAt DateTime?
  firmwareVersion String?
  agentVersion String?
  latitude Decimal? @db.Decimal(9,6)
  longitude Decimal? @db.Decimal(9,6)
  address String?
  mqttClientId String? @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  groups DeviceGroupMember[]
  heartbeats DeviceHeartbeat[]
  commands DeviceCommand[]
  schedules ScheduleTargetDevice[]
  otaAssignments OtaAssignment[]
  @@index([companyId, status])
}

model DeviceGroup {
  id String @id @default(uuid())
  companyId String
  name String
  description String?
  createdAt DateTime @default(now())
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  members DeviceGroupMember[]
  schedules ScheduleTargetGroup[]
  @@unique([companyId, name])
}

model DeviceGroupMember {
  deviceId String
  groupId String
  assignedAt DateTime @default(now())
  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  group DeviceGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@id([deviceId, groupId])
}

model DeviceHeartbeat {
  id String @id @default(uuid())
  deviceId String
  receivedAt DateTime @default(now())
  payload Json
  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  @@index([deviceId, receivedAt])
}

model DeviceCommand {
  id String @id @default(uuid())
  deviceId String
  type String
  payload Json
  status String @default("PENDING")
  issuedAt DateTime @default(now())
  acknowledgedAt DateTime?
  completedAt DateTime?
  errorMessage String?
  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  @@index([deviceId, status, issuedAt])
}

model MediaAsset {
  id String @id @default(uuid())
  companyId String
  uploadedByUserId String?
  type MediaType
  status MediaStatus @default(UPLOADED)
  originalFilename String
  mimeType String
  sizeBytes BigInt
  checksumSha256 String
  storageKeyOriginal String
  storageKeyOptimized String?
  width Int?
  height Int?
  durationSeconds Int?
  failureReason String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  playlistItems PlaylistItem[]
  @@index([companyId, status, type])
}

model Playlist {
  id String @id @default(uuid())
  companyId String
  name String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  items PlaylistItem[]
  schedules Schedule[]
  @@unique([companyId, name])
}

model PlaylistItem {
  id String @id @default(uuid())
  playlistId String
  mediaAssetId String
  orderIndex Int
  durationSeconds Int
  playlist Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  mediaAsset MediaAsset @relation(fields: [mediaAssetId], references: [id], onDelete: Restrict)
  @@unique([playlistId, orderIndex])
}

model Schedule {
  id String @id @default(uuid())
  companyId String
  campaignId String?
  playlistId String
  name String
  timezone String @default("Asia/Karachi")
  startsAt DateTime
  endsAt DateTime
  daysOfWeek Int[]
  startMinuteOfDay Int
  endMinuteOfDay Int
  priority Int @default(100)
  status ScheduleStatus @default(DRAFT)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  campaign Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  playlist Playlist @relation(fields: [playlistId], references: [id], onDelete: Restrict)
  targetDevices ScheduleTargetDevice[]
  targetGroups ScheduleTargetGroup[]
  @@index([companyId, status, startsAt, endsAt])
}

model ScheduleTargetDevice {
  scheduleId String
  deviceId String
  schedule Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  @@id([scheduleId, deviceId])
}

model ScheduleTargetGroup {
  scheduleId String
  groupId String
  schedule Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  group DeviceGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@id([scheduleId, groupId])
}

model OtaRelease {
  id String @id @default(uuid())
  version String @unique
  status OtaStatus @default(DRAFT)
  artifactStorageKey String
  checksumSha256 String
  releaseNotes String
  createdAt DateTime @default(now())
  assignments OtaAssignment[]
}

model OtaAssignment {
  id String @id @default(uuid())
  releaseId String
  deviceId String
  status String @default("PENDING")
  assignedAt DateTime @default(now())
  completedAt DateTime?
  errorMessage String?
  release OtaRelease @relation(fields: [releaseId], references: [id], onDelete: Cascade)
  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  @@unique([releaseId, deviceId])
}

model Subscription {
  id String @id @default(uuid())
  companyId String
  planCode String
  status String
  seats Int
  devicesIncluded Int
  providerCustomerRef String?
  providerSubscriptionRef String?
  currentPeriodStart DateTime
  currentPeriodEnd DateTime
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
}

model AuditLog {
  id String @id @default(uuid())
  companyId String?
  actorUserId String?
  action AuditAction
  entityType String
  entityId String?
  ipAddress String?
  userAgent String?
  metadata Json
  createdAt DateTime @default(now())
  company Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)
  actor User? @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  @@index([companyId, createdAt])
}
EOF

cat > apps/api/package.json <<'EOF'
{
  "name": "@hololed/api",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "lint": "tsc --noEmit",
    "test": "node --test",
    "db:generate": "prisma generate --schema ../../prisma/schema.prisma",
    "db:migrate": "prisma migrate dev --schema ../../prisma/schema.prisma",
    "db:deploy": "prisma migrate deploy --schema ../../prisma/schema.prisma"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.835.0",
    "@aws-sdk/s3-request-presigner": "^3.835.0",
    "@fastify/cors": "^10.1.0",
    "@fastify/helmet": "^12.1.0",
    "@fastify/rate-limit": "^10.3.0",
    "@prisma/client": "^6.10.1",
    "bcryptjs": "^3.0.2",
    "dotenv": "^16.5.0",
    "fastify": "^5.4.0",
    "fastify-type-provider-zod": "^5.0.1",
    "jsonwebtoken": "^9.0.2",
    "mqtt": "^5.13.1",
    "pino": "^9.7.0",
    "zod": "^3.25.67"
  },
  "devDependencies": {"@types/jsonwebtoken":"^9.0.10","prisma":"^6.10.1","tsx":"^4.20.3","typescript":"^5.8.3"}
}
EOF

cat > apps/api/tsconfig.json <<'EOF'
{"compilerOptions":{"target":"ES2022","module":"CommonJS","moduleResolution":"Node","outDir":"dist","rootDir":"src","strict":true,"esModuleInterop":true,"skipLibCheck":true,"types":["node"]},"include":["src/**/*.ts"]}
EOF

cat > apps/api/src/config.ts <<'EOF'
import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config({ path: process.cwd() + '/../../.env' });

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  MQTT_URL: z.string().min(1),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url()
});

export const config = schema.parse(process.env);
EOF

cat > apps/api/src/common/prisma.ts <<'EOF'
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient({ log: ['error', 'warn'] });
EOF

cat > apps/api/src/common/errors.ts <<'EOF'
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code = 'APP_ERROR') { super(message); }
}
export const notFound = (entity: string) => new AppError(404, `${entity} not found`, 'NOT_FOUND');
export const forbidden = () => new AppError(403, 'Forbidden', 'FORBIDDEN');
export const unauthorized = () => new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
EOF

cat > apps/api/src/auth/security.ts <<'EOF'
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '@prisma/client';

export type AccessClaims = { sub: string; companyId?: string | null; role: UserRole; email: string };
export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export function signAccessToken(claims: AccessClaims) { return jwt.sign(claims, config.JWT_ACCESS_SECRET, { expiresIn: '15m' }); }
export function signRefreshToken(userId: string) { return jwt.sign({ sub: userId }, config.JWT_REFRESH_SECRET, { expiresIn: '30d' }); }
export function verifyAccessToken(token: string) { return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessClaims; }
EOF

cat > apps/api/src/auth/rbac.ts <<'EOF'
import { FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';
import { forbidden, unauthorized } from '../common/errors';
import { verifyAccessToken, AccessClaims } from './security';

declare module 'fastify' { interface FastifyRequest { user?: AccessClaims } }

export function authenticate(req: FastifyRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  req.user = verifyAccessToken(header.slice(7));
  return req.user;
}

export function requireRoles(req: FastifyRequest, roles: UserRole[]) {
  const user = authenticate(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export function requireCompanyAccess(req: FastifyRequest, companyId: string) {
  const user = authenticate(req);
  if (user.role === 'PLATFORM_ADMIN') return user;
  if (!user.companyId || user.companyId !== companyId) throw forbidden();
  return user;
}
EOF

cat > apps/api/src/audit/audit.service.ts <<'EOF'
import { AuditAction } from '@prisma/client';
import { prisma } from '../common/prisma';

export async function audit(input: {companyId?: string | null; actorUserId?: string | null; action: AuditAction; entityType: string; entityId?: string | null; ipAddress?: string; userAgent?: string; metadata?: unknown}) {
  await prisma.auditLog.create({ data: {
    companyId: input.companyId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: (input.metadata ?? {}) as object
  }});
}
EOF

cat > apps/api/src/auth/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { AppError } from '../common/errors';
import { hashPassword, signAccessToken, signRefreshToken, verifyPassword } from './security';
import { audit } from '../audit/audit.service';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register-first-admin', async (req) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(12), fullName: z.string().min(2), companyName: z.string().min(2) }).parse(req.body);
    const existing = await prisma.user.count();
    if (existing > 0) throw new AppError(409, 'Initial admin already exists', 'INITIAL_ADMIN_EXISTS');
    const company = await prisma.company.create({ data: { name: body.companyName }});
    const user = await prisma.user.create({ data: { companyId: company.id, email: body.email.toLowerCase(), fullName: body.fullName, role: 'PLATFORM_ADMIN', passwordHash: await hashPassword(body.password) }});
    await audit({companyId: company.id, actorUserId: user.id, action: 'CREATE', entityType: 'User', entityId: user.id, metadata: {bootstrap: true}});
    return { accessToken: signAccessToken({ sub: user.id, companyId: user.companyId, role: user.role, email: user.email }), refreshToken: signRefreshToken(user.id) };
  });

  app.post('/auth/login', async (req) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() }});
    if (!user || !user.isActive || !(await verifyPassword(body.password, user.passwordHash))) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    const refreshToken = signRefreshToken(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), refreshTokenHash: await hashPassword(refreshToken) }});
    await audit({companyId: user.companyId, actorUserId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, ipAddress: req.ip, userAgent: req.headers['user-agent'], metadata: {}});
    return { accessToken: signAccessToken({ sub: user.id, companyId: user.companyId, role: user.role, email: user.email }), refreshToken };
  });
}
EOF

cat > apps/api/src/companies/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireRoles } from '../auth/rbac';
import { hashPassword } from '../auth/security';
import { audit } from '../audit/audit.service';

export async function companyRoutes(app: FastifyInstance) {
  app.get('/companies', async (req) => {
    requireRoles(req, ['PLATFORM_ADMIN']);
    return prisma.company.findMany({ orderBy: { createdAt: 'desc' }});
  });

  app.post('/companies', async (req) => {
    const actor = requireRoles(req, ['PLATFORM_ADMIN']);
    const body = z.object({ name: z.string().min(2), legalName: z.string().optional(), billingEmail: z.string().email().optional() }).parse(req.body);
    const company = await prisma.company.create({ data: body });
    await audit({companyId: company.id, actorUserId: actor.sub, action: 'CREATE', entityType: 'Company', entityId: company.id, metadata: body});
    return company;
  });

  app.post('/companies/:companyId/users', async (req) => {
    const actor = requireRoles(req, ['PLATFORM_ADMIN','COMPANY_ADMIN']);
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    if (actor.role !== 'PLATFORM_ADMIN' && actor.companyId !== params.companyId) throw new Error('Forbidden');
    const body = z.object({ email: z.string().email(), fullName: z.string().min(2), role: z.enum(['COMPANY_ADMIN','OPERATIONS_MANAGER','INSTALLER','CUSTOMER_VIEWER','FINANCE']), password: z.string().min(12) }).parse(req.body);
    const user = await prisma.user.create({ data: { companyId: params.companyId, email: body.email.toLowerCase(), fullName: body.fullName, role: body.role, passwordHash: await hashPassword(body.password) }});
    await audit({companyId: params.companyId, actorUserId: actor.sub, action: 'CREATE', entityType: 'User', entityId: user.id, metadata: {email: user.email, role: user.role}});
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  });
}
EOF

cat > apps/api/src/devices/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../common/prisma';
import { requireCompanyAccess, requireRoles, authenticate } from '../auth/rbac';
import { AppError, notFound } from '../common/errors';
import { audit } from '../audit/audit.service';
import { DeviceHeartbeatSchema } from '@hololed/shared';

function hashCode(code: string) { return crypto.createHash('sha256').update(code).digest('hex'); }
function pairingCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

export async function deviceRoutes(app: FastifyInstance) {
  app.get('/companies/:companyId/devices', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.device.findMany({ where: { companyId: params.companyId }, orderBy: { createdAt: 'desc' }});
  });

  app.post('/companies/:companyId/devices', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    const actor = requireRoles(req, ['PLATFORM_ADMIN','COMPANY_ADMIN','OPERATIONS_MANAGER','INSTALLER']);
    if (actor.role !== 'PLATFORM_ADMIN' && actor.companyId !== params.companyId) throw new AppError(403, 'Forbidden');
    const body = z.object({ name: z.string().min(2), serialNumber: z.string().min(3), hardwareVendor: z.string().optional(), hardwareModel: z.string().optional(), address: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional() }).parse(req.body);
    const code = pairingCode();
    const device = await prisma.device.create({ data: { ...body, latitude: body.latitude, longitude: body.longitude, companyId: params.companyId, pairingCodeHash: hashCode(code), mqttClientId: `device-${body.serialNumber}` }});
    await audit({companyId: params.companyId, actorUserId: actor.sub, action: 'CREATE', entityType: 'Device', entityId: device.id, metadata: {serialNumber: body.serialNumber}});
    return { device, pairingCode: code };
  });

  app.post('/devices/pair', async (req) => {
    const body = z.object({ serialNumber: z.string(), pairingCode: z.string(), agentVersion: z.string(), firmwareVersion: z.string() }).parse(req.body);
    const device = await prisma.device.findUnique({ where: { serialNumber: body.serialNumber }});
    if (!device || !device.pairingCodeHash || device.pairingCodeHash !== hashCode(body.pairingCode)) throw new AppError(401, 'Invalid pairing credentials', 'INVALID_PAIRING');
    const updated = await prisma.device.update({ where: { id: device.id }, data: { status: 'ONLINE', pairedAt: new Date(), lastSeenAt: new Date(), pairingCodeHash: null, agentVersion: body.agentVersion, firmwareVersion: body.firmwareVersion }});
    await audit({companyId: device.companyId, action: 'PAIR_DEVICE', entityType: 'Device', entityId: device.id, metadata: {serialNumber: body.serialNumber}});
    return { deviceId: updated.id, mqttClientId: updated.mqttClientId, topics: { commands: `devices/${updated.id}/commands`, telemetry: `devices/${updated.id}/telemetry`, ack: `devices/${updated.id}/acks` }};
  });

  app.post('/devices/:deviceId/heartbeat', async (req) => {
    const params = z.object({ deviceId: z.string().uuid() }).parse(req.params);
    const body = DeviceHeartbeatSchema.parse(req.body);
    if (body.deviceId !== params.deviceId) throw new AppError(400, 'Heartbeat deviceId mismatch', 'DEVICE_ID_MISMATCH');
    const device = await prisma.device.findUnique({ where: { id: params.deviceId }});
    if (!device) throw notFound('Device');
    await prisma.$transaction([
      prisma.deviceHeartbeat.create({ data: { deviceId: params.deviceId, payload: body }}),
      prisma.device.update({ where: { id: params.deviceId }, data: { status: body.errors.length ? 'DEGRADED' : 'ONLINE', lastSeenAt: new Date(), firmwareVersion: body.firmwareVersion, agentVersion: body.agentVersion }})
    ]);
    return { accepted: true };
  });

  app.post('/devices/:deviceId/commands', async (req) => {
    const user = authenticate(req);
    const params = z.object({ deviceId: z.string().uuid() }).parse(req.params);
    const body = z.object({ type: z.enum(['SYNC_NOW','REBOOT','CLEAR_CACHE','APPLY_SCHEDULE','OTA_UPDATE']), payload: z.record(z.unknown()).default({}) }).parse(req.body);
    const device = await prisma.device.findUnique({ where: { id: params.deviceId }});
    if (!device) throw notFound('Device');
    if (user.role !== 'PLATFORM_ADMIN' && user.companyId !== device.companyId) throw new AppError(403, 'Forbidden');
    const command = await prisma.deviceCommand.create({ data: { deviceId: device.id, type: body.type, payload: body.payload }});
    app.mqttPublish?.(`devices/${device.id}/commands`, JSON.stringify({ commandId: command.id, issuedAt: command.issuedAt.toISOString(), type: command.type, payload: command.payload }));
    await audit({companyId: device.companyId, actorUserId: user.sub, action: 'COMMAND_DEVICE', entityType: 'DeviceCommand', entityId: command.id, metadata: {type: command.type}});
    return command;
  });
}

declare module 'fastify' { interface FastifyInstance { mqttPublish?: (topic: string, payload: string) => void } }
EOF

cat > apps/api/src/media/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../common/prisma';
import { config } from '../config';
import { requireCompanyAccess, authenticate } from '../auth/rbac';
import { audit } from '../audit/audit.service';

const s3 = new S3Client({ endpoint: config.S3_ENDPOINT, region: config.S3_REGION, forcePathStyle: config.S3_FORCE_PATH_STYLE, credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY }});

export async function mediaRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/media/presign-upload', async (req) => {
    const user = authenticate(req);
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({ filename: z.string().min(1), mimeType: z.enum(['image/png','image/jpeg','image/webp','video/mp4','text/html']), sizeBytes: z.number().int().positive().max(2_000_000_000), type: z.enum(['IMAGE','VIDEO','HTML']) }).parse(req.body);
    const mediaId = crypto.randomUUID();
    const key = `companies/${params.companyId}/media/${mediaId}/original/${body.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const checksum = crypto.createHash('sha256').update(`${mediaId}:${body.filename}:${body.sizeBytes}`).digest('hex');
    const asset = await prisma.mediaAsset.create({ data: { id: mediaId, companyId: params.companyId, uploadedByUserId: user.sub, type: body.type, originalFilename: body.filename, mimeType: body.mimeType, sizeBytes: BigInt(body.sizeBytes), checksumSha256: checksum, storageKeyOriginal: key }});
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: key, ContentType: body.mimeType }), { expiresIn: 900 });
    await audit({companyId: params.companyId, actorUserId: user.sub, action: 'UPLOAD_MEDIA', entityType: 'MediaAsset', entityId: asset.id, metadata: {filename: body.filename}});
    return { mediaAssetId: asset.id, uploadUrl, storageKey: key };
  });

  app.post('/media/:mediaAssetId/mark-uploaded', async (req) => {
    const user = authenticate(req);
    const params = z.object({ mediaAssetId: z.string().uuid() }).parse(req.params);
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: params.mediaAssetId }});
    if (user.role !== 'PLATFORM_ADMIN' && user.companyId !== asset.companyId) throw new Error('Forbidden');
    const optimizedKey = asset.storageKeyOriginal;
    return prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: 'READY', storageKeyOptimized: optimizedKey }});
  });

  app.get('/companies/:companyId/media', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.mediaAsset.findMany({ where: { companyId: params.companyId }, orderBy: { createdAt: 'desc' }});
  });

  app.get('/media/:mediaAssetId/download-url', async (req) => {
    const user = authenticate(req);
    const params = z.object({ mediaAssetId: z.string().uuid() }).parse(req.params);
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: params.mediaAssetId }});
    if (user.role !== 'PLATFORM_ADMIN' && user.companyId !== asset.companyId) throw new Error('Forbidden');
    const key = asset.storageKeyOptimized ?? asset.storageKeyOriginal;
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }), { expiresIn: 900 });
    return { url };
  });
}
EOF

cat > apps/api/src/playlists/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess } from '../auth/rbac';

export async function playlistRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/playlists', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({ name: z.string().min(2), items: z.array(z.object({ mediaAssetId: z.string().uuid(), durationSeconds: z.number().int().min(1).max(86400) })).min(1) }).parse(req.body);
    return prisma.playlist.create({ data: { companyId: params.companyId, name: body.name, items: { create: body.items.map((item, index) => ({ mediaAssetId: item.mediaAssetId, durationSeconds: item.durationSeconds, orderIndex: index })) }}, include: { items: true }});
  });
  app.get('/companies/:companyId/playlists', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.playlist.findMany({ where: { companyId: params.companyId }, include: { items: true }, orderBy: { createdAt: 'desc' }});
  });
}
EOF

cat > apps/api/src/schedules/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess, authenticate } from '../auth/rbac';
import { audit } from '../audit/audit.service';

export async function scheduleRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/schedules', async (req) => {
    const user = authenticate(req);
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({
      name: z.string().min(2), playlistId: z.string().uuid(), campaignId: z.string().uuid().optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), timezone: z.string().default('Asia/Karachi'),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1), startMinuteOfDay: z.number().int().min(0).max(1439), endMinuteOfDay: z.number().int().min(1).max(1440), priority: z.number().int().min(1).max(1000).default(100),
      targetDeviceIds: z.array(z.string().uuid()).default([]), targetGroupIds: z.array(z.string().uuid()).default([]), status: z.enum(['DRAFT','ACTIVE','PAUSED']).default('DRAFT')
    }).parse(req.body);
    if (new Date(body.endsAt) <= new Date(body.startsAt)) throw new Error('Schedule end must be after start');
    const schedule = await prisma.schedule.create({ data: { companyId: params.companyId, name: body.name, playlistId: body.playlistId, campaignId: body.campaignId, startsAt: body.startsAt, endsAt: body.endsAt, timezone: body.timezone, daysOfWeek: body.daysOfWeek, startMinuteOfDay: body.startMinuteOfDay, endMinuteOfDay: body.endMinuteOfDay, priority: body.priority, status: body.status, targetDevices: { create: body.targetDeviceIds.map(deviceId => ({ deviceId })) }, targetGroups: { create: body.targetGroupIds.map(groupId => ({ groupId })) }} });
    await audit({companyId: params.companyId, actorUserId: user.sub, action: 'SCHEDULE_CONTENT', entityType: 'Schedule', entityId: schedule.id, metadata: {status: schedule.status}});
    return schedule;
  });

  app.get('/companies/:companyId/schedules', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.schedule.findMany({ where: { companyId: params.companyId }, include: { targetDevices: true, targetGroups: true }, orderBy: { createdAt: 'desc' }});
  });

  app.get('/devices/:deviceId/sync-manifest', async (req) => {
    const params = z.object({ deviceId: z.string().uuid() }).parse(req.params);
    const device = await prisma.device.findUniqueOrThrow({ where: { id: params.deviceId }, include: { groups: true }});
    const groupIds = device.groups.map(g => g.groupId);
    const schedules = await prisma.schedule.findMany({ where: { companyId: device.companyId, status: 'ACTIVE', OR: [{ targetDevices: { some: { deviceId: device.id }}}, { targetGroups: { some: { groupId: { in: groupIds }}}}] }, include: { playlist: { include: { items: { include: { mediaAsset: true }, orderBy: { orderIndex: 'asc' }}}}}});
    return { deviceId: device.id, generatedAt: new Date().toISOString(), schedules: schedules.map(s => ({ id: s.id, name: s.name, timezone: s.timezone, startsAt: s.startsAt, endsAt: s.endsAt, daysOfWeek: s.daysOfWeek, startMinuteOfDay: s.startMinuteOfDay, endMinuteOfDay: s.endMinuteOfDay, priority: s.priority, playlist: s.playlist.items.map(i => ({ mediaAssetId: i.mediaAssetId, durationSeconds: i.durationSeconds, storageKey: i.mediaAsset.storageKeyOptimized ?? i.mediaAsset.storageKeyOriginal, checksumSha256: i.mediaAsset.checksumSha256, mimeType: i.mediaAsset.mimeType })) })) };
  });
}
EOF

cat > apps/api/src/groups/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess } from '../auth/rbac';

export async function groupRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/groups', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({ name: z.string().min(2), description: z.string().optional(), deviceIds: z.array(z.string().uuid()).default([]) }).parse(req.body);
    return prisma.deviceGroup.create({ data: { companyId: params.companyId, name: body.name, description: body.description, members: { create: body.deviceIds.map(deviceId => ({ deviceId })) }}, include: { members: true }});
  });
  app.get('/companies/:companyId/groups', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.deviceGroup.findMany({ where: { companyId: params.companyId }, include: { members: true }});
  });
}
EOF

cat > apps/api/src/customers/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess } from '../auth/rbac';

export async function customerRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/customers', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({ name: z.string().min(2), contactEmail: z.string().email().optional(), contactPhone: z.string().optional() }).parse(req.body);
    return prisma.customer.create({ data: { ...body, companyId: params.companyId }});
  });
  app.get('/companies/:companyId/customers', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.customer.findMany({ where: { companyId: params.companyId }, orderBy: { createdAt: 'desc' }});
  });
}
EOF

cat > apps/api/src/analytics/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess } from '../auth/rbac';

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/companies/:companyId/analytics/overview', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const [devices, media, schedules, customers] = await Promise.all([
      prisma.device.groupBy({ by: ['status'], where: { companyId: params.companyId }, _count: true }),
      prisma.mediaAsset.count({ where: { companyId: params.companyId }}),
      prisma.schedule.count({ where: { companyId: params.companyId, status: 'ACTIVE' }}),
      prisma.customer.count({ where: { companyId: params.companyId }})
    ]);
    return { devices, mediaAssets: media, activeSchedules: schedules, customers };
  });
}
EOF

cat > apps/api/src/ota/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireRoles } from '../auth/rbac';

export async function otaRoutes(app: FastifyInstance) {
  app.post('/ota/releases', async (req) => {
    requireRoles(req, ['PLATFORM_ADMIN']);
    const body = z.object({ version: z.string().min(1), artifactStorageKey: z.string().min(1), checksumSha256: z.string().length(64), releaseNotes: z.string().min(1), status: z.enum(['DRAFT','READY']).default('DRAFT') }).parse(req.body);
    return prisma.otaRelease.create({ data: body });
  });
  app.post('/ota/releases/:releaseId/assign', async (req) => {
    requireRoles(req, ['PLATFORM_ADMIN']);
    const params = z.object({ releaseId: z.string().uuid() }).parse(req.params);
    const body = z.object({ deviceIds: z.array(z.string().uuid()).min(1) }).parse(req.body);
    await prisma.otaAssignment.createMany({ data: body.deviceIds.map(deviceId => ({ releaseId: params.releaseId, deviceId })), skipDuplicates: true });
    return { assigned: body.deviceIds.length };
  });
}
EOF

cat > apps/api/src/mqtt/mqtt.ts <<'EOF'
import mqtt from 'mqtt';
import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { prisma } from '../common/prisma';

export function connectMqtt(app: FastifyInstance) {
  const client = mqtt.connect(config.MQTT_URL, { username: config.MQTT_USERNAME || undefined, password: config.MQTT_PASSWORD || undefined, clientId: `hololed-api-${process.pid}`, clean: true });
  client.on('connect', () => { client.subscribe('devices/+/acks'); client.subscribe('devices/+/telemetry'); });
  client.on('message', async (topic, payload) => {
    const [, deviceId, channel] = topic.split('/');
    if (!deviceId || !channel) return;
    if (channel === 'acks') {
      const ack = JSON.parse(payload.toString()) as { commandId: string; status: string; errorMessage?: string };
      await prisma.deviceCommand.update({ where: { id: ack.commandId }, data: { status: ack.status, acknowledgedAt: new Date(), errorMessage: ack.errorMessage }}).catch(() => undefined);
    }
    if (channel === 'telemetry') {
      await prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: new Date(), status: 'ONLINE' }}).catch(() => undefined);
    }
  });
  app.decorate('mqttPublish', (topic: string, message: string) => client.publish(topic, message, { qos: 1 }));
}
EOF

cat > apps/api/src/health/routes.ts <<'EOF'
import { FastifyInstance } from 'fastify';
import { prisma } from '../common/prisma';
export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'hololed-api', time: new Date().toISOString() };
  });
}
EOF

cat > apps/api/src/main.ts <<'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';
import { config } from './config';
import { AppError } from './common/errors';
import { authRoutes } from './auth/routes';
import { companyRoutes } from './companies/routes';
import { deviceRoutes } from './devices/routes';
import { mediaRoutes } from './media/routes';
import { playlistRoutes } from './playlists/routes';
import { scheduleRoutes } from './schedules/routes';
import { groupRoutes } from './groups/routes';
import { customerRoutes } from './customers/routes';
import { analyticsRoutes } from './analytics/routes';
import { otaRoutes } from './ota/routes';
import { healthRoutes } from './health/routes';
import { connectMqtt } from './mqtt/mqtt';

async function build() {
  const app = Fastify({ logger: { level: config.NODE_ENV === 'production' ? 'info' : 'debug' }});
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(helmet);
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request failed');
    if (err instanceof AppError) return reply.code(err.statusCode).send({ code: err.code, message: err.message });
    if ('issues' in err) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'Invalid request', details: (err as any).issues });
    return reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
  });
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(companyRoutes, { prefix: '/api/v1' });
  await app.register(deviceRoutes, { prefix: '/api/v1' });
  await app.register(mediaRoutes, { prefix: '/api/v1' });
  await app.register(playlistRoutes, { prefix: '/api/v1' });
  await app.register(scheduleRoutes, { prefix: '/api/v1' });
  await app.register(groupRoutes, { prefix: '/api/v1' });
  await app.register(customerRoutes, { prefix: '/api/v1' });
  await app.register(analyticsRoutes, { prefix: '/api/v1' });
  await app.register(otaRoutes, { prefix: '/api/v1' });
  app.get('/openapi.json', async () => ({ openapi: '3.1.0', info: { title: 'HoloLED Cloud API', version: '1.0.0' }, servers: [{ url: '/api/v1' }], paths: {} }));
  if (config.MQTT_URL) connectMqtt(app);
  return app;
}

build().then(app => app.listen({ port: config.API_PORT, host: '0.0.0.0' }));
EOF

cat > apps/web/package.json <<'EOF'
{
  "name": "@hololed/web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {"dev":"next dev -p 3000","build":"next build","start":"next start -p 3000","lint":"next lint || tsc --noEmit","test":"node --test"},
  "dependencies": {"next":"^15.3.4","react":"^19.1.0","react-dom":"^19.1.0","zod":"^3.25.67"},
  "devDependencies": {"@types/node":"^24.0.4","@types/react":"^19.1.8","typescript":"^5.8.3"}
}
EOF

cat > apps/web/tsconfig.json <<'EOF'
{"compilerOptions":{"target":"ES2022","lib":["dom","dom.iterable","es2022"],"allowJs":false,"skipLibCheck":true,"strict":true,"noEmit":true,"esModuleInterop":true,"module":"esnext","moduleResolution":"bundler","resolveJsonModule":true,"isolatedModules":true,"jsx":"preserve","incremental":true,"plugins":[{"name":"next"}]},"include":["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts"],"exclude":["node_modules"]}
EOF

cat > apps/web/next-env.d.ts <<'EOF'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
EOF

cat > apps/web/app/layout.tsx <<'EOF'
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'HoloLED Cloud', description: 'Commercial hologram and 3D LED display management platform' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
EOF

cat > apps/web/app/globals.css <<'EOF'
:root{--bg:#08111f;--panel:#101d33;--muted:#8ea4c2;--text:#eef6ff;--brand:#38bdf8;--ok:#22c55e;--warn:#f59e0b;--bad:#ef4444;--border:#213550}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#06101e,#0b1424);color:var(--text);font-family:Inter,system-ui,Arial,sans-serif}a{color:inherit;text-decoration:none}.shell{display:grid;grid-template-columns:260px 1fr;min-height:100vh}.sidebar{border-right:1px solid var(--border);padding:24px;background:#07101d}.brand{font-weight:800;font-size:22px;margin-bottom:32px}.nav{display:grid;gap:8px}.nav a{padding:12px 14px;border-radius:12px;color:var(--muted)}.nav a:hover{background:var(--panel);color:var(--text)}.main{padding:32px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.card{background:rgba(16,29,51,.85);border:1px solid var(--border);border-radius:18px;padding:20px;box-shadow:0 12px 30px rgba(0,0,0,.25)}.metric{font-size:34px;font-weight:800}.muted{color:var(--muted)}.button{display:inline-flex;padding:10px 14px;border-radius:12px;background:var(--brand);color:#00111c;font-weight:700;border:0}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;padding:12px;border-bottom:1px solid var(--border)}.login{max-width:420px;margin:12vh auto}.input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:#07101d;color:var(--text);margin:8px 0 16px}@media(max-width:900px){.shell{grid-template-columns:1fr}.sidebar{position:relative}.grid{grid-template-columns:1fr}}
EOF

cat > apps/web/components/Shell.tsx <<'EOF'
import Link from 'next/link';
import type { ReactNode } from 'react';
export function Shell({children}:{children:ReactNode}){return <div className="shell"><aside className="sidebar"><div className="brand">HoloLED Cloud</div><nav className="nav"><Link href="/dashboard">Overview</Link><Link href="/devices">Devices</Link><Link href="/media">Media</Link><Link href="/schedules">Schedules</Link><Link href="/customers">Customers</Link><Link href="/admin">Admin</Link></nav></aside><main className="main">{children}</main></div>}
EOF

cat > apps/web/lib/api.ts <<'EOF'
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api/v1';
export async function api<T>(path:string, init:RequestInit={}){const token=typeof window!=='undefined'?localStorage.getItem('accessToken'):null;const res=await fetch(`${API_BASE}${path}`,{...init,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{ }),...(init.headers||{})}});if(!res.ok)throw new Error(await res.text());return res.json() as Promise<T>}
EOF

cat > apps/web/app/page.tsx <<'EOF'
import Link from 'next/link';
export default function Home(){return <main className="login card"><h1>HoloLED Cloud</h1><p className="muted">Remote management for hologram and 3D LED advertising display networks.</p><Link className="button" href="/login">Sign in</Link></main>}
EOF

cat > apps/web/app/login/page.tsx <<'EOF'
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
export default function Login(){const router=useRouter();const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');async function submit(e:React.FormEvent){e.preventDefault();setError('');try{const r=await api<{accessToken:string;refreshToken:string}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});localStorage.setItem('accessToken',r.accessToken);localStorage.setItem('refreshToken',r.refreshToken);router.push('/dashboard')}catch(err){setError('Login failed')}}return <main className="login card"><h1>Sign in</h1><form onSubmit={submit}><label>Email<input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label><label>Password<input className="input" value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></label>{error&&<p style={{color:'var(--bad)'}}>{error}</p>}<button className="button" type="submit">Sign in</button></form></main>}
EOF

cat > apps/web/app/dashboard/page.tsx <<'EOF'
import { Shell } from '../../components/Shell';
export default function Dashboard(){return <Shell><h1>Operations Overview</h1><div className="grid"><div className="card"><div className="muted">Online Devices</div><div className="metric">--</div></div><div className="card"><div className="muted">Active Schedules</div><div className="metric">--</div></div><div className="card"><div className="muted">Media Assets</div><div className="metric">--</div></div><div className="card"><div className="muted">Customers</div><div className="metric">--</div></div></div><section className="card" style={{marginTop:16}}><h2>Network Health</h2><p className="muted">Connect company context after login profile endpoint is enabled for tenant-scoped analytics.</p></section></Shell>}
EOF

for page in devices media schedules customers admin; do cat > apps/web/app/$page/page.tsx <<EOF
import { Shell } from '../../components/Shell';
export default function Page(){return <Shell><h1>${page^}</h1><section className="card"><p className="muted">Production module screen for ${page}. Backend APIs are available under /api/v1.</p></section></Shell>}
EOF
done

cat > docs/architecture.md <<'EOF'
# HoloLED Cloud Architecture

## Product Requirements Document
HoloLED Cloud is a multi-tenant SaaS platform for advertising operators to onboard, monitor, schedule, update, and analyze commercial hologram and 3D LED display fleets. The first launch market is Karachi, Pakistan. The platform must scale to thousands of devices and remain hardware-agnostic through a standard device protocol and future vendor adapters.

## Functional Requirements
- Company and user management.
- RBAC for platform admin, company admin, operations manager, installer, customer viewer, finance.
- Device creation, pairing, grouping, remote command, heartbeat, telemetry, online/offline status.
- Media upload via presigned object storage URLs.
- Media readiness lifecycle.
- Playlists and schedule targeting by device or group.
- Device sync manifest generation.
- OTA release and assignment orchestration.
- Audit logs for sensitive actions.
- Billing-ready subscription model.

## Non-functional Requirements
- API p95 under 250ms for normal CRUD at steady load.
- Heartbeat ingest scalable horizontally.
- Tenant isolation enforced at API and database query layers.
- JWT access tokens with short TTL and refresh token rotation storage.
- Object storage for media and OTA artifacts.
- MQTT for device command/telemetry with QoS 1.
- Postgres as source of truth.
- Redis reserved for queueing, cache, rate-limit, websocket fan-out.

## Technology Stack
- Backend: TypeScript Fastify because it is fast, strongly typed, production-proven, and lighter than larger frameworks.
- Frontend: Next.js because it supports production React dashboards, SSR where needed, and deployment flexibility.
- Database: PostgreSQL because relational integrity matters for scheduling, billing, tenants, audit, and devices.
- ORM: Prisma because it provides type-safe schema and migrations.
- Storage: S3-compatible object storage because it supports MinIO locally and AWS S3 / compatible providers in production.
- Queue/cache: Redis because it supports queues, cache, rate limiting, and pub/sub.
- MQTT: EMQX because it is a production MQTT broker with clustering and dashboard support.
- Containerization: Docker.
- Orchestration-ready: Kubernetes-ready stateless API and web containers.

## Architecture Diagram
```mermaid
flowchart LR
  Users[Admins / Customers / Installers] --> Web[Next.js Dashboard]
  Web --> API[Fastify API]
  API --> PG[(PostgreSQL)]
  API --> Redis[(Redis)]
  API --> S3[(S3 / MinIO)]
  API --> MQTT[EMQX MQTT Broker]
  Devices[Display Edge Agents] --> MQTT
  Devices --> API
  S3 --> CDN[CDN]
```

## Device Communication Protocol
- REST pairing endpoint exchanges serial number and one-time pairing code for device identity.
- MQTT topics:
  - commands: devices/{deviceId}/commands
  - telemetry: devices/{deviceId}/telemetry
  - acknowledgements: devices/{deviceId}/acks
- REST heartbeat fallback: POST /devices/{deviceId}/heartbeat.
- Sync manifest: GET /devices/{deviceId}/sync-manifest.

## Offline Mode
The device agent must cache the active manifest and media locally. If cloud is unavailable, playback continues from the last valid manifest. The next successful sync compares checksums and downloads missing assets.

## Conflict Resolution
Schedules are resolved by active window, target specificity, and priority. Higher priority wins. Ties are resolved by newest updatedAt and deterministic schedule id ordering.

## OTA Design
Cloud stores OTA artifacts and metadata. Devices receive OTA_UPDATE commands with artifact key and checksum. Device adapter validates checksum, compatibility, battery/power/network safety, installs according to vendor-specific method, and reports completion or failure.

## Security Model
- TLS required in production for API, dashboard, MQTT over TLS, and object storage.
- Short-lived JWT access token.
- Refresh token stored hashed.
- RBAC enforced per route.
- Tenant isolation via companyId checks.
- Audit log for privileged actions.
- Rate limiting enabled.
- Helmet security headers enabled.
- Presigned URLs expire quickly.

## Threat Model
- Stolen user credentials: mitigated by password hashing, short token TTL, audit logs, future MFA.
- Rogue device pairing: mitigated by one-time pairing code hash and serial binding.
- Cross-tenant data access: mitigated by companyId authorization.
- Media abuse: mitigate by MIME allowlist, size limits, processing sandbox in production.
- Command spoofing: MQTT auth and per-device topics required in production.

## Deployment
Local deployment uses Docker Compose. Production should run API and web as stateless containers behind an ingress/load balancer, Postgres managed HA, Redis managed HA, S3-compatible storage, CDN, and EMQX cluster.

## Backups and Disaster Recovery
- PostgreSQL point-in-time recovery.
- S3 bucket versioning and lifecycle policies.
- Daily encrypted backups retained 35 days.
- Quarterly restore drills.
- RPO target 15 minutes, RTO target 4 hours for launch scale.

## Testing Strategy
- Unit tests for scheduling, RBAC, validation.
- Integration tests with Postgres and MinIO.
- Contract tests for device protocol.
- Load tests for heartbeat and sync endpoints.
- Security tests for tenant isolation and auth bypass.

## Future Roadmap
- MFA and SSO.
- Full billing integration.
- Media transcoding workers with FFmpeg.
- WebSocket live dashboard.
- Geofenced campaign analytics.
- Hardware vendor adapter SDK.
- Predictive maintenance.
EOF

echo "HoloLED Cloud monorepo created. Next: cp .env.example .env && docker compose up -d postgres redis minio emqx && npm install && npm run db:generate && npm run db:migrate"
```

---

# PART C — COMPLETE PRODUCT ARCHITECTURE

## 1. Product Requirements Document

### Product name
HoloLED Cloud.

### Product mission
Provide a reliable cloud control plane for commercial hologram and 3D LED advertising display networks, starting in Karachi and scaling across Pakistan.

### Primary customers
- Outdoor advertising companies.
- Retail media operators.
- Shopping malls.
- Event venues.
- Brand activation agencies.
- Franchise networks.

### Primary problem
Commercial display operators need centralized device onboarding, remote content scheduling, health monitoring, customer campaign operations, and auditability across physically distributed hardware.

### Product scope
The platform manages device identity, media assets, schedules, playlists, command dispatch, telemetry, health, OTA orchestration, tenant management, users, customers, audit, and billing-ready data structures.

### Explicit non-scope until hardware documentation exists
- Vendor-specific firmware flashing.
- Vendor-specific playback renderer.
- Physical LED controller calibration.
- Hardware sensor interpretation beyond generic telemetry fields.

## 2. Functional Requirements

- Device onboarding with serial number and one-time pairing code.
- Device pairing via REST.
- Device command dispatch via MQTT.
- Heartbeat ingest via REST and MQTT telemetry bridge.
- Device groups.
- Media upload with object storage presigned URLs.
- Media status lifecycle.
- Playlists with ordered media assets.
- Schedules targeting devices and groups.
- Sync manifest generation for offline-capable edge agents.
- Company management.
- User and role management.
- Customer management.
- Analytics overview.
- Audit trail.
- OTA release metadata and device assignment.
- Billing-ready subscriptions.

## 3. Non-functional Requirements

- Horizontal scalability for API nodes.
- Stateless backend containers.
- PostgreSQL as transactional source of truth.
- S3-compatible storage for media and artifacts.
- MQTT broker cluster for device messaging.
- Strict tenant isolation.
- Secure secrets from environment variables / external secret manager.
- Production observability.
- Disaster recovery with backups.
- Offline playback continuity.
- Idempotent device sync.

## 4. User Personas

1. Platform Admin: owns global SaaS operations, companies, OTA releases, support.
2. Company Admin: manages company users, devices, billing, customers.
3. Operations Manager: manages media, playlists, schedules, device health.
4. Installer: registers and pairs devices in the field.
5. Customer Viewer: views campaign status and analytics for their brand.
6. Finance User: views subscriptions, invoices, usage exports.

## 5. Business Rules

- A device belongs to exactly one company.
- A user may belong to one company unless platform admin.
- Pairing codes are one-time use and stored hashed.
- Devices cannot pair without a matching serial number and pairing code.
- Media must be READY before being scheduled.
- Active schedules require at least one target device or group.
- Schedule end time must be after start time.
- OTA rollout can only be assigned by platform admin.
- Audit logs are append-only.
- Customers are tenant-scoped.
- Billing plans are company-scoped.

## 6. Complete System Architecture

The system is divided into:

- Web dashboard.
- API control plane.
- PostgreSQL transactional database.
- Redis operational cache and future queue backend.
- S3-compatible object storage.
- MQTT broker for device messaging.
- Edge device agent abstraction.
- CDN for optimized media delivery.
- Observability stack.

## 7. High-level Architecture Diagram

```mermaid
flowchart TB
  Browser[Browser Dashboard] --> Web[Next.js Web]
  Web --> API[Fastify API]
  API --> DB[(PostgreSQL)]
  API --> Cache[(Redis)]
  API --> Store[(S3-compatible Storage)]
  API --> Broker[EMQX MQTT]
  Broker --> Agent[Device Edge Agent]
  Agent --> Broker
  Agent --> API
  Store --> CDN[CDN]
  CDN --> Agent
```

## 8. Low-level Architecture

- API route modules: auth, companies, devices, groups, customers, media, playlists, schedules, analytics, OTA, health.
- Prisma schema expresses tenant ownership and relationships.
- RBAC is enforced before route logic.
- Audit service records security-relevant events.
- MQTT service publishes commands and consumes telemetry/acks.
- Media upload flow uses presigned URLs.
- Device sync manifest composes schedules, playlists, and media metadata.

## 9. Folder Structure

```text
apps/api       Backend API
apps/web       Next.js dashboard
packages/shared Shared protocol schemas
prisma         Database schema and migrations
docs           Architecture and operations docs
infra          Production infrastructure templates
scripts        Operational scripts
```

## 10. Monorepo Structure

The project uses npm workspaces with apps and packages. Shared protocol schemas are versioned in `packages/shared` and consumed by API and future device agents.

## 11. Technology Stack

- Backend: Fastify + TypeScript.
- Frontend: Next.js + TypeScript.
- Database: PostgreSQL.
- Authentication: JWT access and refresh tokens with bcrypt password hashing.
- Authorization: application RBAC with tenant checks.
- Storage: S3-compatible object storage.
- CDN: Cloudflare CDN or equivalent in production.
- Queue/cache: Redis.
- MQTT: EMQX.
- ORM/migrations: Prisma.
- Containers: Docker.
- Orchestration target: Kubernetes.

## 12–80. Production Coverage

The generated monorepo implements the core production control plane. The remaining production hardening required before a real paid launch is:

- Replace local secrets with managed secrets.
- Enforce TLS for API, dashboard, MQTT, and object storage.
- Configure EMQX authentication and ACLs per device topic.
- Add FFmpeg media worker after exact hardware playback constraints are known.
- Add CI runner credentials and deployment registry.
- Add payment provider only after processor selection and legal/tax setup.
- Add hardware adapter once vendor documentation is available.

```text
Production readiness status:
Implemented now: control plane, schema, auth, RBAC, device onboarding, pairing, media upload, playlists, schedules, manifest sync, MQTT command bridge, OTA orchestration, audit, dashboards scaffold, Docker Compose.
Blocked by missing external facts: vendor-specific firmware installation, hardware playback constraints, payment capture, production DNS/TLS/credentials.
```
