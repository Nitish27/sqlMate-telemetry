# SqlMate Telemetry Backend

## Purpose

This service is the first-party telemetry backend for `sqlMate`.

It exists to measure:
- DMG/App Store installs that actually opened the app
- currently active users via heartbeats
- rolling active-install metrics such as DAU, WAU, and MAU
- public aggregated counters for `sqlMate-landing`

## Recommended Stack

- Runtime: `TypeScript`
- API framework: `Hono`
- Validation: `Zod`
- Database: `Postgres`
- ORM / SQL tooling: `Drizzle ORM`
- Hosting: `Cloudflare Workers`
- Managed Postgres: `Neon`
- Tests: `Vitest`

## Why This Stack

- `Hono` keeps the API tiny and fast for a 2-3 endpoint service.
- `Cloudflare Workers` keeps ops low and deployment simple.
- `Postgres` gives reliable aggregation queries for active-user metrics.
- `Drizzle ORM` keeps schema and SQL explicit without adding heavy framework complexity.
- This stays fully first-party, which is a cleaner privacy/App Store story than embedding a third-party analytics SDK directly in the Mac app.

## Initial Scope

The first version will support:
- `POST /v1/telemetry/session`
- `POST /v1/telemetry/heartbeat`
- `GET /v1/public/stats`

It will not support:
- per-user accounts
- dashboards inside the service
- cross-device identity
- detailed event analytics beyond install/activity tracking
- vendor forwarding to PostHog or Mixpanel

## Core Metric Definitions

- `total_installs_opened`: count of unique `installation_id` values ever seen
- `active_30d`: unique `installation_id` values seen in the last 30 days
- `currently_active`: unique `installation_id` values with a heartbeat in the last 10 minutes
- `downloads`: tracked separately from the app install ID flow, usually via landing-page or file-delivery tracking
