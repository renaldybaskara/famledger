# FinTracker Project Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build durable English-language project memory for the current Budgetin working tree so future tasks can navigate directly to the relevant architecture, feature, and source files.

**Architecture:** Use a concise root `AGENTS.md` as the automatic entry point and a set of focused pages under `docs/project-memory/` for detailed knowledge. Derive every factual statement from the current source tree, configuration, or existing documentation; source code remains authoritative when sources disagree.

**Tech Stack:** Markdown, PowerShell validation commands, Git, Go 1.22/Gin/GORM backend, Expo 52/React Native Web/TypeScript frontend, PostgreSQL 16, Docker Compose, Caddy, Prometheus, Grafana, and Loki.

## Global Constraints

- Write all project memory in English.
- Reflect the current working tree, including uncommitted changes, without modifying those changes.
- Preserve `CLAUDE.md` and all existing product, configuration, deployment, and test files.
- Never copy credentials, tokens, secret values, or real `.env` values into documentation.
- Describe stable responsibilities, interfaces, flows, and file mappings; do not duplicate source code line by line.
- Treat current source code and configuration as authoritative when documentation disagrees.
- Label uncertainty, stale documentation, and incomplete behavior explicitly instead of guessing.
- Keep `AGENTS.md` concise and route detailed information to `docs/project-memory/`.
- Update memory alongside future changes to routes, entities, dependencies, configuration, tests, architectural boundaries, or feature mappings.
- Because `.gitignore` ignores `docs/`, stage new documentation there with `git add -f` and never stage unrelated working-tree changes.

---

## Planned File Structure

- Create `AGENTS.md`: automatic project entry point, essential rules, commands, and memory routing table.
- Create `docs/project-memory/README.md`: index explaining which page to read for each task type.
- Create `docs/project-memory/architecture.md`: system boundaries, dependency direction, startup, request, worker, OCR, email, AI, and payment flows.
- Create `docs/project-memory/backend.md`: Go package map, dependency injection, handlers, use cases, repositories, middleware, workers, and adapters.
- Create `docs/project-memory/data-model.md`: persisted entities, relationships, ownership, lifecycle behavior, and migration sources.
- Create `docs/project-memory/api.md`: route groups, authentication, handlers, use cases, response conventions, and route-order constraints.
- Create `docs/project-memory/frontend.md`: Expo Router map, hooks, stores, API client, components, theming, and platform behavior.
- Create `docs/project-memory/features.md`: end-to-end feature-to-file index covering frontend, backend, persistence, integrations, and tests.
- Create `docs/project-memory/infrastructure.md`: service topology, Docker, proxy, configuration names, deployment, and observability.
- Create `docs/project-memory/testing.md`: existing automated checks, integration scenarios, build commands, and task-specific verification matrix.
- Create `docs/project-memory/maintenance.md`: synchronization triggers, conflict resolution, safety checks, and review checklist.

## Task 1: Document System Architecture and Backend Boundaries

**Files:**

- Create: `docs/project-memory/architecture.md`
- Create: `docs/project-memory/backend.md`
- Read: `apps/api-go/cmd/server/main.go`
- Read: `apps/api-go/internal/delivery/http/router.go`
- Read: `apps/api-go/internal/delivery/http/middleware/*.go`
- Read: `apps/api-go/internal/delivery/http/httputil/response.go`
- Read: `apps/api-go/internal/domain/usecase/*.go`
- Read: `apps/api-go/internal/domain/repository/*.go`
- Read: `apps/api-go/internal/usecase/*.go`
- Read: `apps/api-go/internal/repository/*.go`
- Read: `apps/api-go/internal/infrastructure/**/*.go`

**Interfaces:**

- Consumes: Current Go constructors, interfaces, package dependencies, route registration, middleware contracts, worker startup, and infrastructure adapters.
- Produces: A stable system-flow reference and backend package map used by `api.md`, `features.md`, `README.md`, and `AGENTS.md`.

- [ ] **Step 1: Capture the current backend inventory and constructors**

Run:

```powershell
rg --files apps/api-go -g '*.go'
rg -n '^func New|^type .* interface|^type .* struct|RegisterRoutes|\.Start\(' apps/api-go
```

Expected: A complete list of Go source files plus constructor, interface, struct, route-registration, and worker-start locations. Save findings in working notes only; do not create generated inventory files.

- [ ] **Step 2: Trace startup and dependency injection from source**

Read `apps/api-go/cmd/server/main.go` completely and record the exact order for configuration loading, database connection/migration/seeding, repository creation, adapter creation, use-case creation, handler creation, middleware, routes, workers, cleanup jobs, and server start.

Cross-check supporting behavior with:

```powershell
Get-Content -Raw apps/api-go/internal/infrastructure/config/config.go
Get-Content -Raw apps/api-go/internal/infrastructure/database/database.go
Get-Content -Raw apps/api-go/internal/infrastructure/database/seed.go
```

Expected: Every startup stage documented from an actual constructor or call site; optional services identified by their configuration gate.

- [ ] **Step 3: Write `architecture.md`**

Create these sections with source-backed descriptions:

```markdown
# System Architecture
## System Context
## Runtime Components
## Backend Dependency Direction
## API Startup Sequence
## Authenticated Request Flow
## Email Import and Classification Flow
## Payment Slip OCR Flow
## Subscription Payment Flow
## Workspace Collaboration Flow
## Data and Service Boundaries
## Source of Truth and Known Uncertainty
```

The dependency section must explicitly preserve the direction `delivery -> domain ports <- implementations`, distinguish domain interfaces from concrete use cases/repositories, and call out any current-code exception rather than normalizing it.

- [ ] **Step 4: Write `backend.md`**

Create these sections:

```markdown
# Backend Reference
## Module and Entry Point
## Package Responsibilities
## Dependency Injection
## Domain Ports
## Use-Case Implementations
## Repository Implementations
## HTTP Handlers and Response Helpers
## Authentication and Tier Middleware
## Background Workers
## Infrastructure Adapters
## Error and Logging Conventions
## Safe Change Checklist
```

For every package, list its responsibility, public constructor or interface, direct dependencies, and principal consumers. Include the dual-layer paths for domain ports and concrete implementations.

- [ ] **Step 5: Validate the backend documents**

Run:

```powershell
Test-Path docs/project-memory/architecture.md
Test-Path docs/project-memory/backend.md
rg -n 'delivery|domain/usecase|domain/repository|internal/usecase|internal/repository|worker|middleware' docs/project-memory/architecture.md docs/project-memory/backend.md
git diff --check -- docs/project-memory/architecture.md docs/project-memory/backend.md
```

Expected: Both `Test-Path` calls return `True`; each required backend layer appears; `git diff --check` reports no errors.

- [ ] **Step 6: Commit the architecture and backend memory**

```powershell
git add -f -- docs/project-memory/architecture.md docs/project-memory/backend.md
git diff --cached --name-only
git commit -m "docs: map system architecture and backend"
```

Expected staged paths before commit: exactly the two files from this task.

## Task 2: Document the Data Model and HTTP API

**Files:**

- Create: `docs/project-memory/data-model.md`
- Create: `docs/project-memory/api.md`
- Read: `apps/api-go/internal/domain/entity/*.go`
- Read: `apps/api-go/internal/domain/repository/*.go`
- Read: `apps/api-go/internal/domain/usecase/*.go`
- Read: `apps/api-go/internal/delivery/http/router.go`
- Read: `apps/api-go/internal/delivery/http/handler/*.go`
- Read: `apps/api-go/internal/infrastructure/database/database.go`
- Read: `apps/api-go/internal/infrastructure/database/seed.go`
- Read: `infra/postgres/init.sql`

**Interfaces:**

- Consumes: Current entities, GORM tags, repository contracts, use-case request/response types, route registration, handler bindings, migrations, and database initialization.
- Produces: Entity ownership and lifecycle reference plus route-to-handler-to-use-case mappings used by feature navigation and change reviews.

- [ ] **Step 1: Inventory entities, tables, and persistence contracts**

Run:

```powershell
rg -n '^type ' apps/api-go/internal/domain/entity
rg -n 'AutoMigrate|CREATE TABLE|CREATE INDEX|Seed|uniqueIndex|foreignKey|constraint:' apps/api-go/internal infra/postgres/init.sql
```

Expected: The result identifies every persisted type, migration registration, manual SQL object, seed path, important index, and declared relationship constraint.

- [ ] **Step 2: Write `data-model.md`**

Create these sections:

```markdown
# Data Model
## Persistence Sources
## Ownership and Tenant Scope
## Identity and Authentication
## Accounts, Categories, Transactions, and Budgets
## Savings Goals
## Workspaces and Invitations
## Email Integration and Imported Messages
## Subscriptions and Billing
## System Settings and Parser Rules
## Relationships and Deletion Behavior
## Indexes, Idempotency, and Audit Data
## Seeds and Startup Migration Behavior
## Change Checklist
```

For each entity, document its owning user/workspace, key relationships, state fields, soft- versus hard-delete behavior, unique/idempotency fields, preload behavior when visible in repositories, and the source file defining it. Do not reproduce all struct fields.

- [ ] **Step 3: Inventory routes in registration order**

Run:

```powershell
rg -n '\.(GET|POST|PUT|PATCH|DELETE)\(' apps/api-go/internal/delivery/http/router.go
rg -n '^func \(h \*.*Handler\)' apps/api-go/internal/delivery/http/handler
```

Expected: A route list in actual Gin registration order and a complete handler-method list.

- [ ] **Step 4: Write `api.md`**

Create these sections:

```markdown
# HTTP API Reference
## Base Path and Response Envelope
## Public and Protected Routes
## Authentication
## Users and Settings
## Accounts
## Categories
## Transactions and Dashboard
## Budgets
## Savings Goals
## Email Integrations and Messages
## Payment Slip OCR
## Subscriptions and Billing
## Workspaces and Invitations
## Parser Rules and System Administration
## Middleware and Tier Gates
## Static-Before-Dynamic Route Ordering
## Adding or Changing an Endpoint
```

For each route group, record method/path, auth or tier requirement, handler method, domain use-case interface, and concrete implementation file. Preserve registration-order warnings where a dynamic parameter could capture a static route.

- [ ] **Step 5: Cross-check route and data-model coverage**

Run:

```powershell
rg -n '^## ' docs/project-memory/data-model.md docs/project-memory/api.md
rg -n 'GET|POST|PUT|PATCH|DELETE' docs/project-memory/api.md
git diff --check -- docs/project-memory/data-model.md docs/project-memory/api.md
```

Expected: Every route group from `router.go` appears under a documented heading; every entity family has an ownership/lifecycle section; whitespace validation is clean.

- [ ] **Step 6: Commit the data and API memory**

```powershell
git add -f -- docs/project-memory/data-model.md docs/project-memory/api.md
git diff --cached --name-only
git commit -m "docs: map data model and API"
```

Expected staged paths before commit: exactly the two files from this task.

## Task 3: Document the Frontend and End-to-End Features

**Files:**

- Create: `docs/project-memory/frontend.md`
- Create: `docs/project-memory/features.md`
- Read: `apps/web/app/**/*.tsx`
- Read: `apps/web/components/**/*.tsx`
- Read: `apps/web/src/hooks/*.ts`
- Read: `apps/web/src/store/*.ts`
- Read: `apps/web/src/lib/*.ts`
- Read: `apps/web/package.json`
- Read: `apps/web/app.json`
- Read: `apps/web/global.css`
- Read: `apps/web/tailwind.config.js`
- Read: backend files mapped by each frontend hook and API call

**Interfaces:**

- Consumes: Current Expo routes, layouts, screens, components, hooks, Zustand stores, API client, format/theme helpers, and the backend/data references from Tasks 1 and 2.
- Produces: Frontend navigation and state map plus an end-to-end feature index used by `AGENTS.md` to narrow future source inspection.

- [ ] **Step 1: Inventory frontend routes and shared modules**

Run:

```powershell
rg --files apps/web/app apps/web/components apps/web/src -g '*.ts' -g '*.tsx'
rg -n 'export default|create\(|useQuery|useMutation|api\.|router\.|href=|useLocalSearchParams' apps/web/app apps/web/components apps/web/src
```

Expected: All Expo Router screens/layouts, component exports, hooks, stores, API calls, and navigation targets are visible for mapping.

- [ ] **Step 2: Trace frontend state and network conventions**

Read completely:

```powershell
Get-Content -Raw apps/web/src/lib/api.ts
Get-Content -Raw apps/web/src/store/auth.store.ts
Get-Content -Raw apps/web/src/store/theme.store.ts
Get-Content -Raw apps/web/app/_layout.tsx
Get-Content -Raw 'apps/web/app/(tabs)/_layout.tsx'
```

Record token persistence and refresh behavior, workspace selection if present, query-key patterns, mutation invalidation, error display, theme initialization, and route guards from current code only.

- [ ] **Step 3: Write `frontend.md`**

Create these sections:

```markdown
# Frontend Reference
## Runtime and Entry Points
## Expo Router Structure
## Authentication and Route Guards
## API Client and Token Lifecycle
## React Query Hooks and Cache Invalidation
## Zustand Stores and Persistence
## Shared Components
## Feature Screens
## Theme, Typography, and Design Tokens
## Web and Native Differences
## Error, Loading, and Empty States
## Safe Change Checklist
```

For each screen and shared module, document responsibility, route, data hook/store dependencies, API endpoint family, and important consumers. Record actual current fonts/tokens rather than copying stale design guidance.

- [ ] **Step 4: Trace every major feature end to end**

Use searches for these feature families:

```powershell
rg -n 'auth|account|categor|transaction|dashboard|budget|saving|workspace|invite|email|parser|payment|subscription|setting|theme' apps/web apps/api-go/internal tests
```

For each family, identify frontend routes/components/hooks, API routes/handlers, domain and concrete use cases, repositories/entities, infrastructure adapters, and tests. Explicitly mark a layer as absent when the feature does not use it.

- [ ] **Step 5: Write `features.md`**

Create these sections:

```markdown
# Feature-to-File Map
## How to Use This Map
## Authentication and User Profile
## Accounts
## Categories
## Transactions
## Dashboard and Analytics
## Budgets
## Savings Goals
## Workspaces and Invitations
## Email Integration and Import Pipeline
## Bank Parser Rules and AI Fallback
## Payment Slip OCR
## Subscriptions and Billing
## Settings and Theme
## Cross-Cutting Change Map
```

Within each feature, use the same fields: user-facing routes, frontend state/hooks, API routes and handlers, use-case port and implementation, repository port and implementation, entities/storage, external adapters/workers, tests, and known limitations.

- [ ] **Step 6: Validate frontend and feature mappings**

Run:

```powershell
rg -n '^## ' docs/project-memory/frontend.md docs/project-memory/features.md
rg -n 'apps/web/app|apps/web/components|apps/web/src/hooks|apps/api-go/internal' docs/project-memory/frontend.md docs/project-memory/features.md
git diff --check -- docs/project-memory/frontend.md docs/project-memory/features.md
```

Expected: Every route group and major feature is represented; both frontend and backend paths occur in the end-to-end map; whitespace validation is clean.

- [ ] **Step 7: Commit the frontend and feature memory**

```powershell
git add -f -- docs/project-memory/frontend.md docs/project-memory/features.md
git diff --cached --name-only
git commit -m "docs: map frontend and product features"
```

Expected staged paths before commit: exactly the two files from this task.

## Task 4: Document Infrastructure, Testing, and Memory Maintenance

**Files:**

- Create: `docs/project-memory/infrastructure.md`
- Create: `docs/project-memory/testing.md`
- Create: `docs/project-memory/maintenance.md`
- Read: `.env.example`
- Read: `docker-compose.yml`
- Read: `docker-compose.dev.yml`
- Read: `apps/api-go/Dockerfile`
- Read: `apps/web/Dockerfile`
- Read: `apps/ocr-service/Dockerfile`
- Read: `apps/ocr-service/main.py`
- Read: `infra/caddy/Caddyfile`
- Read: `infra/postgres/init.sql`
- Read: `infra/prometheus/prometheus.yml`
- Read: `infra/grafana/provisioning/datasources/datasource.yml`
- Read: `infra/loki/loki-config.yml`
- Read: `infra/loki/promtail-config.yml`
- Read: `deploy/*.md`
- Read: `deploy/*.sh`
- Read: `scripts/setup.sh`
- Read: `tests/*`
- Read: all `*_test.go` and `*.test.ts` files

**Interfaces:**

- Consumes: Current service definitions, configuration names, health checks, proxy routes, deployment scripts, monitoring configuration, automated tests, and documented manual scenarios.
- Produces: Operational topology, verification matrix, and rules that keep the memory synchronized and safe.

- [ ] **Step 1: Inventory services and configuration names without exposing values**

Run:

```powershell
docker compose config --services
rg -n '^[A-Z][A-Z0-9_]*=' .env.example
rg -n 'image:|build:|ports:|depends_on:|healthcheck:|environment:' docker-compose.yml docker-compose.dev.yml
```

Expected: A service list, environment-variable names, build contexts, dependencies, ports, and health checks. Documentation must include names and purpose only, never populated secret values.

- [ ] **Step 2: Write `infrastructure.md`**

Create these sections:

```markdown
# Infrastructure and Operations
## Local and Production Topology
## Docker Compose Services
## Network and Proxy Routing
## PostgreSQL and Object Storage
## Cache and Background Processing
## OCR, AI, Email, OAuth, and Payment Integrations
## Configuration Variable Groups
## Deployment Paths
## Observability
## Health Checks and Troubleshooting
## Operational Safety
```

Distinguish base Compose behavior from the development override. Record service names, internal/exposed ports, dependencies, volumes, and configuration variable names from source. Do not claim a service is used by application code unless an actual dependency or call site exists.

- [ ] **Step 3: Inventory automated and manual verification assets**

Run:

```powershell
rg --files apps tests -g '*_test.go' -g '*.test.ts' -g '*.test.tsx' -g '*.mjs' -g '*.md'
Get-Content -Raw apps/web/package.json
Get-Content -Raw apps/api-go/go.mod
```

Expected: A current list of Go tests, frontend tests, test scripts, manual scenarios, PDF-generation/payment-flow assets, and supported package commands.

- [ ] **Step 4: Write `testing.md`**

Create these sections:

```markdown
# Testing and Verification
## Verification Principles
## Backend Tests
## Frontend Static Checks and Tests
## Build Verification
## Docker and Health Verification
## Integration and Payment Scenarios
## Feature-to-Check Matrix
## Known Test Gaps
## Before-Completion Checklist
```

Include exact working-directory-aware commands, what each command covers, expected success signals, and known environmental prerequisites. Do not advertise the root `npm test` script as a valid suite when it intentionally exits with an error.

- [ ] **Step 5: Write `maintenance.md`**

Create these sections:

```markdown
# Project Memory Maintenance
## Source-of-Truth Order
## When Memory Must Change
## Page Ownership by Change Type
## Synchronization Checklist
## Conflict and Uncertainty Handling
## Secret and Sensitive-Data Safety
## Link and Path Validation
## Review Checklist
```

The synchronization checklist must cover routes, auth/tier rules, entities/relationships, migrations/indexes/seeds, constructors/dependencies, workers/integrations, frontend routes/hooks/stores/components, environment-variable names, services, tests, and known limitations.

- [ ] **Step 6: Validate and commit operational memory**

Run:

```powershell
rg -n '^## ' docs/project-memory/infrastructure.md docs/project-memory/testing.md docs/project-memory/maintenance.md
rg -n 'PASSWORD=|SECRET=|TOKEN=|API_KEY=' docs/project-memory
git diff --check -- docs/project-memory/infrastructure.md docs/project-memory/testing.md docs/project-memory/maintenance.md
```

Expected: Required headings exist; the secret-pattern search returns no populated assignments; whitespace validation is clean.

Then commit only these files:

```powershell
git add -f -- docs/project-memory/infrastructure.md docs/project-memory/testing.md docs/project-memory/maintenance.md
git diff --cached --name-only
git commit -m "docs: add operations testing and maintenance memory"
```

## Task 5: Create the Entry Point, Index, and Run Full Validation

**Files:**

- Create: `AGENTS.md`
- Create: `docs/project-memory/README.md`
- Verify: `docs/project-memory/*.md`
- Preserve: `CLAUDE.md`

**Interfaces:**

- Consumes: All detailed project-memory pages from Tasks 1–4 and current authoritative commands/configuration.
- Produces: The automatic Codex entry point and a human-readable routing index for all future project work.

- [ ] **Step 1: Write `docs/project-memory/README.md`**

Create these sections:

```markdown
# Budgetin Project Memory
## Purpose and Limits
## Source-of-Truth Order
## Task Routing Table
## Memory Pages
## Quick Start for Future Work
## Current Snapshot and Maintenance
```

The routing table must map backend architecture, endpoint changes, data changes, frontend screens, feature changes, infrastructure/deployment, testing, and memory maintenance to the smallest relevant pages. Link every page with a relative Markdown link.

- [ ] **Step 2: Write concise root `AGENTS.md`**

Create these sections:

```markdown
# Budgetin Agent Guide
## Project Identity
## Source of Truth
## Architecture Guardrails
## Essential Safety Rules
## Common Commands
## Read Before Changing
## Memory Maintenance
```

Keep the file concise. Include the stack and repository layout, Go dependency direction, safe user serialization, HTTP response helper rule, static-before-dynamic Gin route rule, frontend conventions verified from current code, preservation of unrelated dirty changes, no-secret rule, exact core commands, and links to the detailed memory index/pages.

- [ ] **Step 3: Validate Markdown links**

Run this repository-local link check:

```powershell
$memoryFiles = @((Get-Item AGENTS.md), (Get-ChildItem docs/project-memory -Filter '*.md'))
$missingLinks = @()
foreach ($memoryFile in $memoryFiles) {
  $body = Get-Content -Raw -LiteralPath $memoryFile.FullName
  foreach ($match in [regex]::Matches($body, '\[[^\]]+\]\((?!https?://)([^)#]+)')) {
    $target = $match.Groups[1].Value
    $resolved = Join-Path $memoryFile.DirectoryName ($target -replace '/', '\')
    if (-not (Test-Path -LiteralPath $resolved)) {
      $missingLinks += "$($memoryFile.FullName): $target"
    }
  }
}
if ($missingLinks.Count -gt 0) { $missingLinks; exit 1 }
'All local Markdown links resolve.'
```

Expected: `All local Markdown links resolve.`

- [ ] **Step 4: Validate referenced repository paths**

Run:

```powershell
$memoryFiles = @((Get-Item AGENTS.md), (Get-ChildItem docs/project-memory -Filter '*.md'))
$missingPaths = @()
$pathExpression = [regex]'`((?:(?:apps|infra|deploy|tests|scripts|docs)/[^`]+)|(?:AGENTS\.md|CLAUDE\.md|README\.md|\.env\.example|docker-compose(?:\.dev)?\.yml|package\.json))`'
foreach ($memoryFile in $memoryFiles) {
  $body = Get-Content -Raw -LiteralPath $memoryFile.FullName
  foreach ($match in $pathExpression.Matches($body)) {
    $candidate = $match.Groups[1].Value -replace '/', '\'
    $exists = if ($candidate -match '[*?]') {
      Test-Path -Path $candidate
    } else {
      Test-Path -LiteralPath $candidate
    }
    if (-not $exists) {
      $missingPaths += "$($memoryFile.FullName): $candidate"
    }
  }
}
if ($missingPaths.Count -gt 0) { $missingPaths; exit 1 }
'All referenced repository paths resolve.'
```

Expected: `All referenced repository paths resolve.`

- [ ] **Step 5: Validate completeness, placeholders, formatting, and repository scope**

Run:

```powershell
rg -n 'T[B]D|T[O]DO|FIX[M]E|PLACE[H]OLDER|implement la[t]er|fill in det[a]ils' AGENTS.md docs/project-memory
rg -n '^# |^## ' AGENTS.md docs/project-memory/*.md
git diff --check -- AGENTS.md docs/project-memory
git status --short
```

Expected: The placeholder scan returns no matches; all expected headings are visible; `git diff --check` is clean; unrelated pre-existing changes remain present and unmodified.

- [ ] **Step 6: Run representative project verification**

Run backend verification:

```powershell
Set-Location apps/api-go
go test ./...
go build ./...
Set-Location ../..
```

Run frontend verification:

```powershell
Set-Location apps/web
pnpm type-check
pnpm build
Set-Location ../..
```

If a command fails because of a missing external service or local tool, record the exact limitation in `docs/project-memory/testing.md`; do not convert an environmental failure into a claim that the code is broken.

- [ ] **Step 7: Review representative end-to-end mappings**

Manually cross-check these three slices against current source:

1. Savings Goals: Expo route -> hook -> API route -> handler -> use case -> repository -> entity -> tests.
2. Email Import: integration screen -> API -> worker/parser/AI fallback -> email message -> transaction creation.
3. Subscription Billing: frontend gate/hook -> API -> handler/use case -> payment adapter -> persisted subscription/billing state.

Expected: Every file named in each slice exists and every call direction matches current code. Correct the memory inline if any mismatch is found.

- [ ] **Step 8: Commit the entry point and complete memory**

```powershell
git add -- AGENTS.md
git add -f -- docs/project-memory/README.md
git diff --cached --name-only
git commit -m "docs: add Budgetin project memory entry point"
```

Expected staged paths before commit: exactly `AGENTS.md` and `docs/project-memory/README.md`.

- [ ] **Step 9: Confirm final state**

Run:

```powershell
git log -5 --oneline
git status --short
git ls-files AGENTS.md docs/project-memory docs/superpowers/specs/fintracker.md docs/superpowers/plans/fintracker.md
```

Expected: All memory and planning files are tracked; implementation commits are visible; all pre-existing unrelated changes remain in their original working-tree state.
