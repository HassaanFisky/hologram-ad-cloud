# ADR-001: Monorepo Structure

**Status:** Accepted

**Context:** Need to manage multiple deployable services and shared packages.

**Decision:** Use npm workspaces monorepo with Turborepo for build orchestration.

**Consequences:** Shared packages are hoisted. All services share one node_modules.
