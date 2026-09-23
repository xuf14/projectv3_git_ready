# CLAUDE.md

<!--
SETUP FOR MAINTAINERS:
1. Replace all [bracketed values] once when starting the project.
2. Delete sections that do not apply.
3. Keep this file under 200 lines.
4. Put long or path-specific instructions in .claude/rules/ or skills.
HTML comments are for maintainers and are not injected into Claude's startup context.
-->

## Project

- Product: [one-sentence purpose]
- Framework: [Next.js App Router / React / Vue / other]
- Language: TypeScript with strict mode
- Package manager: [pnpm / npm / yarn]
- Primary database: [PostgreSQL / MySQL / MongoDB / other]
- ORM or database client: [Prisma / Drizzle / Mongoose / Supabase / other]
- Database hosting: [Neon / Supabase / Railway / local / other]
- Data stored from webapp: [users, registrations, orders, content, audit logs, etc.]
- Authentication: [provider or approach]
- Deployment: [Vercel / Docker / other]
- Primary language for UI: [Vietnamese / English]
- Current priority: correctness, security, maintainability, and minimal changes

## Commands

Use only commands defined by this repository.

- Install: `[pnpm install]`
- Development: `[pnpm dev]`
- Lint: `[pnpm lint]`
- Type check: `[pnpm typecheck]`
- Test: `[pnpm test]`
- Build: `[pnpm build]`
- Database generate: `[pnpm prisma generate]`
- Local database migration: `[pnpm prisma migrate dev]`
- Production migration: `[pnpm prisma migrate deploy]`

Do not substitute package managers or invent scripts. Inspect `package.json` only when a command or dependency version is relevant.

## Source of Truth

Use this precedence:

1. The user's current request.
2. Existing code and tests nearest to the change.
3. Repository configuration and schemas.
4. This file.
5. General framework conventions.

Never guess a library version, environment variable, API contract, database field, or project path when it can be verified locally.

## Token and Context Discipline

- Make the smallest correct change that completes the task.
- Reuse current session context; do not reread files without a reason.
- Search narrowly with `rg` or targeted file patterns before opening files.
- Read only the files and line ranges needed for the current task.
- Do not scan the entire repository by default.
- Do not read generated or large files unless required: `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`, lockfiles, generated clients, bundles, logs, binaries, media, and snapshots.
- Limit shell output with filters, targeted paths, or concise reporters.
- Stop log inspection at the first actionable root cause.
- Do not paste unchanged code, full files, or long command output into responses.
- Do not explain standard syntax or framework basics unless asked.
- For a simple change, edit directly. Give a short plan only for multi-file, risky, ambiguous, or architectural work.
- Ask a question only when the missing answer materially changes correctness; otherwise state the assumption briefly and proceed.

## Change Boundaries

- Do not broaden the task, perform opportunistic refactors, or reformat unrelated files.
- Preserve existing behavior and public contracts unless the request requires a change.
- Follow nearby project patterns before introducing a new abstraction.
- Do not add a dependency when the existing stack can solve the problem cleanly.
- Do not create one-use wrappers, helpers, types, or components unless they materially improve correctness or readability.
- Keep diffs focused and reviewable.
- Never deploy, publish, push, reset a database, delete data, rotate secrets, or run destructive commands without explicit authorization.

## Implementation Standards

### General

- Prefer clear, direct code over clever code.
- Use descriptive names and small functions with one responsibility.
- Comments explain why, constraints, or non-obvious decisions—not obvious syntax.
- Remove dead code created by the change.
- Do not leave fake implementations, silent fallbacks, or placeholder success states.
- Add a `TODO` only when the user explicitly accepts incomplete work.

### TypeScript

- Keep strict typing.
- Avoid `any`, unsafe casts, non-null assertions, and `@ts-ignore`.
- If one is unavoidable, keep its scope minimal and explain the reason in code.
- Validate data at trust boundaries; do not rely only on TypeScript types at runtime.
- Reuse canonical domain types rather than creating duplicate shapes.

### Web and API

- Treat all client input, URL parameters, headers, cookies, and external responses as untrusted.
- Validate request data and return intentional HTTP status codes.
- Keep authorization checks on the server and verify resource ownership.
- Return stable, minimal response shapes; do not leak stack traces or internal details.
- Keep secrets and privileged SDKs out of client bundles.
- Preserve accessibility: semantic HTML, labels, keyboard access, and meaningful states.
- Handle loading, empty, success, and error states when relevant.

### Next.js, When Applicable

- Prefer Server Components; add `"use client"` only for browser APIs, state, effects, event handlers, or client-only libraries.
- Keep server-only logic in server modules, route handlers, or server actions.
- Do not expose server environment variables through public configuration.
- Use framework-native routing, metadata, image, and caching unless the repository deliberately uses another pattern.
- Avoid unnecessary client-side fetching when data can be loaded on the server.

### Database and Webapp Data Flow

- Reuse the repository's existing database stack. Do not introduce a second database, ORM, or client unless the task explicitly requires it.
- If persistence is requested but no database exists, inspect the framework and deployment target, then choose only a compatible server-side design; state any architectural assumption.
- Default data path: browser form/event → server action or API route → runtime validation → authentication/authorization → service → ORM/client → database.
- Never connect the browser to a privileged database. Direct client access is allowed only for an approved BaaS architecture protected by Row Level Security.
- Keep the ORM, admin client, service-role key, and database connection code in server-only modules.
- Maintain one canonical database module, such as `src/lib/db.ts`, and reuse its client. Prevent duplicate clients during development hot reload.
- On serverless platforms, use the provider-supported adapter or connection pooler; do not create an unrestricted connection per request.
- Read connection settings from server environment variables such as `DATABASE_URL` and optional `DIRECT_URL`. List names in `.env.example`; never expose values through `NEXT_PUBLIC_*`.
- For any webapp feature that stores data, implement the complete path: schema/model, migration when needed, server-side validation, authorized write, duplicate/error handling, response, and focused test.
- Treat the current schema and committed migrations as authoritative. Never infer fields from UI labels when the schema is available.
- Validate, normalize, and whitelist writable fields. Never pass a complete request body directly into `create`, `update`, `insert`, or `upsert`.
- Check authorization and record ownership before reading, updating, or deleting protected records.
- Enforce required fields, uniqueness, relationships, and valid references with database constraints as well as application validation.
- Use transactions for dependent writes. Use idempotency keys, unique business keys, or safe upserts for forms that may be submitted more than once.
- Store only necessary personal data. Never log passwords, tokens, medical/payment data, connection strings, or full sensitive payloads.
- Store uploaded files in approved object storage and keep only their metadata and references in the database unless binary storage is explicitly required.
- Select only required fields, paginate unbounded results, avoid N+1 queries, and add indexes only for real query, sort, uniqueness, or relationship needs.
- Handle unique conflicts, missing records, foreign-key errors, timeouts, and connection failures intentionally. Retry only transient idempotent operations with a strict limit.
- Do not edit a migration already shared or deployed. Create a new migration and preserve compatibility through staged changes when necessary.
- Never run reset, force-push, drop, truncate, mass update/delete, seed, or production migration commands without explicit authorization.

### Security

- Never print, commit, expose, or fabricate secrets.
- Do not open or reproduce `.env` values; use variable names from `.env.example`.
- Use parameterized queries or the ORM; never concatenate untrusted SQL.
- Do not weaken authentication, authorization, validation, CORS, CSP, CSRF, rate limiting, or audit controls merely to make an error disappear.
- Flag a security-impacting assumption before implementing it.

## Validation

Use the narrowest validation that gives credible confidence:

- Copy/style-only change: inspect affected UI and run targeted lint if available.
- Local TypeScript change: targeted test plus type check for the affected package.
- Business logic change: add or update focused tests, then run them.
- API/auth/database change: test persistence, invalid input, duplicates, unauthorized access, missing records, and database failures.
- Dependency/config/build change: run type check and production build.
- Cross-cutting or release-critical change: run the full relevant suite.

Do not repeatedly run the same failing command without changing code or the hypothesis.
Do not claim a check passed unless it was actually executed.

## Response Format

Match the user's language. Be concise by default.

For completed work, report only:

- `Changed:` files and essential behavior.
- `Verified:` commands or checks actually run.
- `Notes:` only real limitations, assumptions, migrations, or follow-up actions.

Do not repeat the request, narrate every tool call, include a tutorial, or paste a full diff unless requested.

## Definition of Done

A task is done when:

- The requested behavior is implemented with a focused diff.
- Relevant edge cases and security boundaries are handled.
- Webapp data is persisted through a validated server-side path when storage is required.
- Appropriate targeted validation passes.
- No unrelated files or behavior were changed.
- The final response accurately states what was and was not verified.
