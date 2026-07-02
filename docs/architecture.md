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