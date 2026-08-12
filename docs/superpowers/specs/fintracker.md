# Project Memory Design

Date: 2026-08-13
Project: Budgetin (`C:\Project\FinTracker`)

## Purpose

Create durable, Codex-friendly project memory that substantially reduces repeated repository-wide exploration before future coding tasks. The memory will describe the current working tree, including uncommitted changes, and will route future work to the smallest relevant set of source files.

The source code remains authoritative. Project memory is an architectural map and operating guide, not a copy of the implementation.

## Goals

- Provide a concise root entry point that Codex can discover automatically.
- Document system architecture, important data flows, conventions, and operational commands.
- Map product features to their backend, frontend, database, infrastructure, and test files.
- Reflect the current working tree rather than only the latest Git commit.
- Make uncertainty and incomplete implementation explicit.
- Establish a maintenance rule so memory changes alongside relevant code.
- Preserve all existing files and uncommitted user work.

## Non-goals

- Copy every source line into documentation.
- Replace targeted source inspection before making a change.
- Document dependencies, generated files, binary assets, build outputs, or temporary files line by line.
- Store secrets or actual environment-variable values.
- Refactor or otherwise modify product code while constructing the memory.

## Structure

The memory will use a layered design.

### Root entry point

`AGENTS.md` will contain:

- Project identity and a concise stack summary.
- Source-of-truth and documentation-precedence rules.
- Essential architectural constraints and coding conventions.
- Common development and verification commands.
- Security and repository-safety reminders.
- A routing table linking task types to detailed memory pages.

It must stay concise enough to be useful as startup context.

### Detailed memory

`docs/project-memory/README.md` will act as the navigation index. It will link to:

- `architecture.md`: system boundaries, dependency direction, startup, request, background-worker, and integration flows.
- `backend.md`: Go packages, dependency injection, handlers, use cases, repositories, middleware, workers, and external adapters.
- `frontend.md`: Expo Router structure, screens, components, API hooks, client state, theming, and design conventions.
- `data-model.md`: entities, relationships, ownership, persistence behavior, and migration sources.
- `features.md`: feature-to-file mapping across backend, frontend, database, infrastructure, and tests.
- `api.md`: route groups, authentication requirements, handler mappings, and noteworthy ordering or response conventions.
- `infrastructure.md`: Docker services, configuration variable names, deployment paths, observability, and external integrations.
- `testing.md`: available tests, static checks, build commands, integration scenarios, and task-specific verification guidance.
- `maintenance.md`: update triggers and a synchronization checklist.

Existing `CLAUDE.md` will remain untouched. Relevant accurate information may be represented in the new memory, but current code wins when documentation disagrees.

## Construction Workflow

1. Inventory tracked and untracked project files while excluding dependency and build-output directories.
2. Read existing project instructions and documentation.
3. Inspect current backend entry points, route registration, domain interfaces and entities, use-case implementations, repositories, infrastructure adapters, workers, and tests.
4. Inspect current frontend routes, shared components, hooks, stores, API client, libraries, configuration, and tests.
5. Inspect database initialization, Docker and proxy configuration, deployment documentation, and observability configuration.
6. Trace each major feature end to end and record the files and interfaces involved.
7. Write facts only when supported by current code, configuration, or clearly labeled project documentation.
8. Record uncertainty, stale documentation, or incomplete behavior explicitly instead of guessing.
9. Validate all referenced local paths and supported commands.

## Future Usage

For future tasks, Codex should:

1. Read `AGENTS.md`.
2. Use its routing table to select the relevant project-memory page.
3. Use the feature map to open only the source files required for the task.
4. Treat source as authoritative if it differs from memory.
5. Update affected memory pages in the same task when routes, entities, dependencies, configuration, tests, architectural boundaries, or feature mappings change.

This workflow reduces broad rereading but does not remove the need for focused inspection of code that will be modified.

## Maintenance Rules

The maintenance checklist will cover:

- New, removed, or renamed files and packages.
- New or changed routes and authentication requirements.
- Entity, relationship, migration, and ownership changes.
- Use-case, repository, worker, and integration changes.
- Frontend routes, hooks, stores, components, and design-system changes.
- Environment-variable names and service dependencies.
- Test additions, removals, and command changes.
- Known limitations, incomplete flows, and documentation conflicts.

Memory updates should describe durable behavior. Volatile implementation details should remain in source unless they are essential for safe modification.

## Safety and Error Handling

- Do not include secret values, credentials, tokens, or sensitive user data.
- Do not modify existing product files while creating the initial memory.
- Preserve all current uncommitted user changes.
- Mark inferred relationships as inferences and verify them where possible.
- If a path or documented command cannot be verified, omit it or label the limitation.
- When existing documentation conflicts with current code, document the current behavior and note the discrepancy if it can affect future work.

## Verification

The completed memory will be checked by:

- Scanning for placeholders such as `TBD` and `TODO`.
- Confirming every referenced repository path exists.
- Comparing documented commands with package scripts, Go modules, Docker files, and deployment scripts.
- Cross-checking representative features end to end.
- Reviewing route, entity, feature, and test coverage for obvious omissions.
- Running representative backend and frontend verification commands where practical and reporting any environment limitation.
- Confirming the final Git diff contains only intended memory files.

## Success Criteria

The work is successful when a future coding task can begin from `AGENTS.md`, select the correct detailed memory page, identify the relevant implementation files, and perform only targeted source inspection without needing to rediscover the whole repository.
