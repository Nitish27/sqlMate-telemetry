# Plan: SqlMate Telemetry Backend MVP

**Goal:** Build a first-party telemetry backend for `sqlMate` that can record anonymous installs and current activity, then expose public aggregate stats to `sqlMate-landing`.
**Requires:** None
**Provides:** A deployable telemetry service, app integration contract, and public stats API
**Context budget:** 3 tasks, ~2-4 hours total implementation

---

## Architecture Summary

### Chosen Approach

- Separate backend project in `sqlMate-telemetry`
- `Hono` API running on `Cloudflare Workers`
- `Neon Postgres` as the system of record
- `Drizzle ORM` for schema and migrations
- Anonymous install tracking using a locally persisted `installation_id`

### Data Flow

1. `sqlMate` generates or loads a persistent `installation_id`.
2. On app launch, `sqlMate` sends a `session` event to the telemetry backend.
3. Every 3 minutes while the app is open, `sqlMate` sends a `heartbeat`.
4. The backend upserts install state into Postgres.
5. `sqlMate-landing` fetches aggregate metrics from the public stats endpoint.

### Explicit Product Definitions

- `downloaded`: measured outside this service
- `installed_and_opened`: first successful `session` event from an `installation_id`
- `currently_using`: last heartbeat within 10 minutes
- `active_user`: seen within a rolling time window such as 1, 7, or 30 days

### Scope Boundaries

This MVP does:
- collect anonymous install and heartbeat telemetry
- expose aggregate stats
- keep the Mac app first-party from a privacy perspective

This MVP does not do:
- identify humans across devices
- collect SQL, database names, hostnames, or any customer content
- support accounts, auth, dashboards, or billing

---

### Task 1: Scaffold the telemetry service and database foundation

**Files:**
- Create: `sqlMate-telemetry/package.json`
- Create: `sqlMate-telemetry/tsconfig.json`
- Create: `sqlMate-telemetry/wrangler.jsonc`
- Create: `sqlMate-telemetry/drizzle.config.ts`
- Create: `sqlMate-telemetry/src/index.ts`
- Create: `sqlMate-telemetry/src/env.ts`
- Create: `sqlMate-telemetry/src/db/schema.ts`
- Create: `sqlMate-telemetry/src/db/client.ts`
- Create: `sqlMate-telemetry/.env.example`

**Action:**
Initialize a standalone TypeScript service using `Hono`, `Drizzle ORM`, `postgres` or the Neon serverless driver, and `Zod`.

Implement a minimal project structure:
- `src/index.ts` boots the `Hono` app and registers routes.
- `src/env.ts` validates required environment variables.
- `src/db/schema.ts` defines the initial schema.
- `src/db/client.ts` creates the database client.

Create the first database table:
- `installations`
  - `installation_id` UUID/text primary key
  - `first_seen_at` timestamp not null
  - `last_seen_at` timestamp not null
  - `last_heartbeat_at` timestamp nullable
  - `app_version` text nullable
  - `platform` text not null default `'macos'`
  - `channel` text nullable
  - `last_seen_ip_hash` text nullable
  - `created_at` timestamp not null
  - `updated_at` timestamp not null

Add indexes for:
- `last_seen_at`
- `last_heartbeat_at`
- `channel`

DO NOT:
- add user accounts or auth in the MVP
- add event-log tables yet unless the install-state table proves insufficient
- collect raw IP addresses permanently; if IP-based abuse controls are needed later, hash them before storage

**Verify:**
```bash
cd /Users/nitish/Infosec/tb-cl/sqlMate-telemetry
npm install
npm run typecheck
npm run db:generate
# Expected: dependency install succeeds, TypeScript passes, Drizzle generates SQL artifacts without schema errors
```

**Done when:**
- [ ] The service has a compilable TypeScript/Hono foundation
- [ ] Environment variables are validated at startup
- [ ] The `installations` schema is defined with the required indexes
- [ ] Drizzle migration generation succeeds

---

### Task 2: Implement telemetry ingestion and public stats endpoints

**Files:**
- Modify: `sqlMate-telemetry/src/index.ts`
- Create: `sqlMate-telemetry/src/routes/telemetry.ts`
- Create: `sqlMate-telemetry/src/routes/public.ts`
- Create: `sqlMate-telemetry/src/lib/metrics.ts`
- Create: `sqlMate-telemetry/src/lib/upsert-installation.ts`
- Create: `sqlMate-telemetry/src/lib/hash.ts`
- Create: `sqlMate-telemetry/test/telemetry-routes.test.ts`
- Create: `sqlMate-telemetry/test/public-routes.test.ts`

**Action:**
Implement three endpoints:

- `POST /v1/telemetry/session`
  - Body:
    - `installation_id`
    - `app_version`
    - `platform`
    - `channel`
  - Behavior:
    - validate payload with `Zod`
    - create or update the installation row
    - set `first_seen_at` if new
    - always update `last_seen_at`

- `POST /v1/telemetry/heartbeat`
  - Body:
    - `installation_id`
    - `app_version`
    - `platform`
    - `channel`
  - Behavior:
    - validate payload
    - reject obviously malformed IDs
    - update `last_seen_at` and `last_heartbeat_at`
    - create the row if it does not exist so heartbeats remain idempotent for edge cases

- `GET /v1/public/stats`
  - Response:
    - `total_installs_opened`
    - `active_1d`
    - `active_7d`
    - `active_30d`
    - `currently_active`
    - `generated_at`

Implement metrics with SQL driven by timestamps:
- `currently_active = last_heartbeat_at >= now() - interval '10 minutes'`
- `active_1d = last_seen_at >= now() - interval '1 day'`
- `active_7d = last_seen_at >= now() - interval '7 days'`
- `active_30d = last_seen_at >= now() - interval '30 days'`

DO NOT:
- make the public endpoint return per-install or per-version raw data
- expose installation identifiers publicly
- add complex anti-abuse logic to the MVP beyond basic validation and optional hashed-IP rate limiting hooks

**Verify:**
```bash
cd /Users/nitish/Infosec/tb-cl/sqlMate-telemetry
npm run test
npm run typecheck
# Expected: route tests pass and the project remains type-safe
```

Manual verification:
```bash
cd /Users/nitish/Infosec/tb-cl/sqlMate-telemetry
npm run dev
# In another shell:
curl -X POST http://127.0.0.1:8787/v1/telemetry/session \
  -H "Content-Type: application/json" \
  -d '{"installation_id":"11111111-1111-1111-1111-111111111111","app_version":"0.4.1","platform":"macos","channel":"dmg"}'

curl -X POST http://127.0.0.1:8787/v1/telemetry/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"installation_id":"11111111-1111-1111-1111-111111111111","app_version":"0.4.1","platform":"macos","channel":"dmg"}'

curl http://127.0.0.1:8787/v1/public/stats
# Expected: stats JSON includes at least 1 opened install and 1 currently active install
```

**Done when:**
- [ ] Session ingestion upserts install state correctly
- [ ] Heartbeats update `last_heartbeat_at`
- [ ] Public stats return correct aggregate counts
- [ ] Tests cover payload validation and metric calculation behavior

---

### Task 3: Integrate `sqlMate` and `sqlMate-landing` with the telemetry backend

**Files:**
- Modify: `sqlMate/src-tauri/Cargo.toml`
- Modify: `sqlMate/src-tauri/src/lib.rs`
- Create: `sqlMate/src-tauri/src/core/telemetry.rs`
- Modify: `sqlMate/src-tauri/src/core/mod.rs`
- Modify: `sqlMate/src/App.tsx`
- Modify: `sqlMate-landing/src/app/page.tsx`
- Modify: `sqlMate-landing/src/app/privacy/page.tsx`

**Action:**
Wire the desktop app to the new service without introducing any third-party analytics SDK.

In `sqlMate`:
- add a Rust telemetry module using `reqwest` if needed
- persist or load a local anonymous `installation_id`
- send a `session` event on launch
- schedule a heartbeat every 3 minutes while the app is open
- keep failures non-blocking so telemetry never impacts core app behavior

Recommended app payload:
- `installation_id`
- `app_version`
- `platform: "macos"`
- `channel: "dmg"` or `"app_store"`

In `sqlMate-landing`:
- fetch `GET /v1/public/stats`
- render at least:
  - opened installs
  - active users in the last 30 days
  - currently active users
- handle backend unavailability gracefully with hidden stats or fallback copy

In privacy copy:
- disclose anonymous usage telemetry
- explicitly state that SQL queries, database contents, and hostnames are not sent to the telemetry service

DO NOT:
- block app startup on telemetry success
- show raw stats placeholders if the API fails and you cannot trust the number
- collect sensitive database or user content

**Verify:**
```bash
cd /Users/nitish/Infosec/tb-cl/sqlMate
npm run build

cd /Users/nitish/Infosec/tb-cl/sqlMate-landing
npm run build
# Expected: both projects build successfully after telemetry integration
```

Manual verification:
```bash
# Launch sqlMate with the telemetry backend running locally
# Expected: one session event is recorded and heartbeats continue without affecting app UX
```

**Done when:**
- [ ] `sqlMate` sends anonymous session and heartbeat events successfully
- [ ] Telemetry failures do not break app startup or core queries
- [ ] `sqlMate-landing` displays public aggregate metrics from the backend
- [ ] Privacy copy reflects the actual telemetry behavior

---

## Risks

| Risk | Mitigation | Severity |
|------|-----------|----------|
| App reinstall creates a new `installation_id` and inflates installs | Accept this as install-level rather than human-level analytics | Medium |
| Public stats endpoint becomes stale or unavailable | Keep UI resilient and avoid blocking the page on stats | Medium |
| Telemetry is perceived as invasive | Limit payload to anonymous install metadata and disclose it clearly | High |
| Cloudflare/Neon integration adds early setup friction | Keep the local Hono + Drizzle flow working before deployment work | Medium |

## Assumptions

- `sqlMate` remains a macOS-first app in this phase
- install-level analytics are acceptable; exact human identity is out of scope
- deployment secrets and managed Postgres credentials will be available at implementation time

## Next Step

Implement Task 1 first so the new `sqlMate-telemetry` directory becomes a real service skeleton instead of a planning-only folder.
