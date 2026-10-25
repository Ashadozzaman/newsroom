# Claude Code Prompt Playbook

Sequential prompts to build the platform with Claude Code, one step at a time. The step blocks below (P00–P28) are the **work orders**. The `/run-step` procedure reads them and runs them through the agent team: planner → developers → test-runner → reviewer/auditor → docs-keeper → verify. See `docs/AUTOMATION.md`.

## How to run steps

**Auto mode (steps run back to back):**
1. Set Claude Code to the **Auto** permission mode (VS Code: mode indicator → Auto).
2. Run `/auto` (or `/auto --until P05`).

Each step is planned, implemented, tested (`scripts/verify.mjs`), reviewed, documented and committed locally on an `auto/run-*` branch. Then the next step starts by itself. It pauses at phase gates (after P14, P19, P23), before steps that need a client decision (P20, P26, P28), on a failing step, or after 4 steps per session. For long unattended runs, use `node scripts/auto-run.mjs --until P14` (a fresh session per step).

**Manual mode (you review every step):**
1. Start a fresh session. Run `/run-step` (next step) or `/run-step P05`.
2. The same agent pipeline runs, then Claude **stops** before committing.
3. Review the report, `git diff` and the running app.
4. Commit: `node scripts/commit-step.mjs P05 "<message>" --manual`.
5. If something is off, use the **Correction** prompt. Never move on with a broken step.

Without the agent setup you can still paste a step block directly. The rules in `CLAUDE.md` apply either way.

---

## Utility prompts

### Session start
```
Read CLAUDE.md, docs/PROGRESS.md and the CLAUDE.md of any app you will touch. Summarise in 5 bullets: what is done, what is next, open TODOs, open [CONFIRM] items that affect the next step, and anything in the repo that looks inconsistent with the docs. Do not change any file.
```

### Plan only (before a big step)
```
Before implementing step <ID>, produce a plan only: files to create/modify (grouped by app/package), new dependencies with versions, migrations, new env vars, new contracts schemas, test list, and risks/questions. Do not write code until I reply "go".
```

### Correction
```
Your last step has these problems: <list>. Fix only these, keep everything else unchanged, re-run lint/typecheck/tests for affected packages, update docs/PROGRESS.md notes, report and stop.
```

### Scope change / new decision
```
Decision: <what was decided and why>. Append it to docs/DECISIONS.md (ADR format used in ARCHITECTURE §24), update the affected sections of REQUIREMENTS / ARCHITECTURE / API_SPEC / schema.prisma (plan first if the schema changes), list which already-completed steps are impacted, then stop.
```

### Docs sync (end of each phase)
```
Compare the implemented code with docs/API_SPEC.md, docs/ARCHITECTURE.md and docs/REQUIREMENTS.md for phase <N>. List every mismatch (endpoint missing/extra, different path, permission, behaviour). Propose doc or code fixes; change nothing until I choose.
```

### Debug
```
Problem: <symptom, logs, steps to reproduce>. Investigate first: read the relevant code, form 2–3 hypotheses ranked by likelihood, and tell me how you will confirm each. Do not change code until I agree. Then fix test-first (/fix rules).
```

### Resume after a pause (auto mode)
```
Run `node scripts/auto.mjs status` and read docs/PROGRESS.md. Explain why auto mode paused, what is unfinished in the current [~] step (from its Notes and `git diff HEAD --stat`), and what you need from me. If nothing is needed from me, run /auto.
```

### Phase review (at a phase gate)
```
Phase <N> is done on this branch. Use the code-reviewer agent and the security-auditor agent in parallel to review `git diff main...HEAD` as a whole (cross-step consistency, dead code, duplicated logic, missing tests, security). Then compare the implementation with docs/API_SPEC.md and REQUIREMENTS for this phase. Report blockers and should-fix items grouped by owner. Change nothing.
```

---

## Phase 0 — Foundation

### P00 — Monorepo bootstrap (M00)
Branch `chore/m00-bootstrap` · Read first: CLAUDE.md, ARCHITECTURE §2, §4
```
Step P00 — Monorepo bootstrap (M00).

Goal: an empty but fully wired pnpm + Turborepo monorepo that installs, builds, lints, typechecks, tests and runs.

The repo already contains docs/, CLAUDE.md files, .claude/ (agents, commands, hooks, settings), scripts/ (automation), docker-compose.yml, docker/, .gitignore, apps/api/prisma/**, apps/api/prisma.config.ts and the two .env.example files. Preserve them byte-for-byte (you may only APPEND missing entries to .gitignore). Scaffold generators (Nest CLI, create-next-app) into a temp directory with non-interactive flags, no nested git repos, then merge into apps/api and apps/web.

Package names: `api` (apps/api), `web` (apps/web), `@newsroom/contracts`, `@newsroom/tsconfig`, `@newsroom/eslint-config` — so `pnpm --filter api|web` works as written in the CLAUDE.md files.

1. Root: pnpm-workspace.yaml (apps/*, packages/*), turbo.json (build with dependsOn ^build and outputs dist/**, .next/** excluding cache; dev persistent + no cache; lint; typecheck; test; test:e2e), root package.json scripts proxying to turbo (`dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`) plus `"verify": "node scripts/verify.mjs"`, `"auto": "node scripts/auto.mjs"`, `"auto:run": "node scripts/auto-run.mjs"`; "packageManager": "pnpm@10.x", engines node >=22. .nvmrc = 22. Lint/format configs must ignore `.claude/state/`.
2. packages/tsconfig: base.json (strict, noUncheckedIndexedAccess, noImplicitOverride, target ES2022, moduleResolution bundler for libs), nestjs.json (CommonJS, emitDecoratorMetadata, experimentalDecorators), nextjs.json.
3. packages/eslint-config: flat configs `base`, `nest`, `next` (typescript-eslint type-checked, no-explicit-any = error, consistent-type-imports, import ordering, jsx-a11y for next). Root Prettier config + ignore.
4. packages/contracts (@newsroom/contracts): zod 4 dependency, tsup build → cjs + esm + d.ts, exports map, vitest. src/index.ts exports a placeholder HealthResponseSchema. Add `"sideEffects": false`.
5. apps/api: NestJS 12 CommonJS app (Jest). Global prefix `api`, URI versioning v1 → GET /api/v1/health returns { status: "ok" }. Path alias @/* → src/* (tsconfig + jest moduleNameMapper). Scripts: dev, build, start, start:worker (node dist/worker.js — create a minimal src/worker.ts that boots an application context and logs "worker started"), lint, typecheck, test, test:e2e, db:migrate, db:generate, db:seed, db:studio (prisma commands; they may fail until P02 — that's fine).
6. apps/web: Next.js 16 (App Router, TS, Tailwind CSS 4, src/ dir, Turbopack, ESLint via CLI not `next lint`). next.config.ts: rewrites /api/v1/:path* → `${API_INTERNAL_URL}/api/v1/:path*`, `output: 'standalone'`, typedRoutes if stable. Home page renders the site name from NEXT_PUBLIC_SITE_NAME.
7. Husky + lint-staged (prettier --write, eslint --fix on staged files) + commitlint (conventional; allowed scopes: repo, deps, docs, ci, contracts, web, api, and module folder names auth, users, rbac, taxonomy, media, articles, workflow, ai-review, public-content, engagement, search, ads, billing, payouts, notifications, dashboards, site, analytics, audit). Footer trailers like `Step: P05` and `Verified: …` must pass commitlint (they do with the conventional preset; verify with a test message).
8. Extend the existing .gitignore only if something is missing; add .editorconfig.
9. README.md: prerequisites (Node 22, pnpm 10, Docker), setup (copy env files, docker compose up -d, pnpm install, pnpm dev), main commands, link to docs/.
10. GitHub Actions CI skeleton .github/workflows/ci.yml: pnpm cache, install, lint, typecheck, test, build (no e2e yet).

Do NOT add business modules, Prisma client code, auth, or UI component libraries yet.
```
**Done when:** `pnpm install && pnpm build && pnpm lint && pnpm typecheck && pnpm test` pass · `pnpm dev` serves http://localhost:3000 and http://localhost:4000/api/v1/health · `curl localhost:3000/api/v1/health` works through the rewrite · existing docs, `.claude/` and `scripts/` untouched · `node scripts/verify.mjs --step P00` passes.
**Commit:** `chore(repo): bootstrap pnpm turborepo with nestjs 12 and next.js 16 apps`

### P01 — API platform core (M00)
Branch `chore/m00-api-core` · Read first: apps/api/CLAUDE.md, ARCHITECTURE §5, §19, §21
```
Step P01 — API platform core (M00). Build the framework glue every module will rely on. No business modules.

1. Config: src/config/env.schema.ts (Zod) covering EVERY variable in apps/api/.env.example with sensible types/defaults (booleans, numbers, URLs, enums, optional secrets that become required when NODE_ENV=production). Load with @nestjs/config (Standard Schema validation). Typed AppConfigService with grouped getters (app, database, redis, auth, storage, mail, ai, payments, seed). No process.env access elsewhere (add an ESLint rule restricting process.env outside src/config).
2. CLS: nestjs-cls with requestId (incoming x-request-id or UUIDv7), ip, userAgent, userId placeholder.
3. Logging: nestjs-pino JSON, requestId in every line, redact authorization/cookie/set-cookie/password/token fields, pretty transport only in development.
4. Errors: src/common/errors — ErrorCode enum, DomainError base (code, httpStatus, detail, fieldErrors) and subclasses NotFoundError, ForbiddenError, UnauthorizedError, ConflictError, ValidationError, InvalidStateTransitionError, PaymentRequiredError, RateLimitedError. Global ProblemDetailsFilter → application/problem+json { type, title, status, detail, code, errors?, requestId }; maps Nest HttpExceptions and Standard Schema validation failures (errors[] with path + message); 500s hide internals and log the stack.
5. Response envelope interceptor ({ data, meta? }) + @SkipEnvelope() decorator. Controllers may return { data, meta } explicitly for paginated results.
6. Validation: confirm how NestJS 12's StandardSchemaValidationPipe is used with @Body/@Query/@Param({ schema }) in the installed version; write a tiny example endpoint test proving 400 + problem details on invalid input. Document the exact usage in apps/api/CLAUDE.md if it differs from the example there.
7. HTTP hardening in main.ts: helmet (API-appropriate CSP off, noSniff, frameguard deny), cookie-parser, trust proxy (from config), rawBody: true, enableShutdownHooks, global prefix api + URI versioning v1, CORS disabled by default (single origin) with an env allow-list option for local tools.
8. Swagger at /api/docs (when SWAGGER_ENABLED) with cookie auth scheme; helpers @ApiZodBody(schema), @ApiZodQuery(schema), @ApiZodResponse(schema, status) using z.toJSONSchema().
9. Redis: RedisModule (ioredis, single shared client + duplicate for BullMQ), CacheService (getOrSet with TTL, del by pattern prefix), LockService (SET NX PX + safe release via Lua).
10. Throttler: @nestjs/throttler with Redis storage, default 120 req/min/IP; @Throttle overrides allowed.
11. Queues: @nestjs/bullmq root config from REDIS_URL; src/infrastructure/queue/queues.ts with QUEUES + JOBS constants from ARCHITECTURE §17. WorkerModule + src/worker.ts (application context, graceful shutdown). No processors yet.
12. Events: @nestjs/event-emitter configured (wildcards on, delimiter '.').
13. Common decorators/types: @Public(), @CurrentUser(), @RequirePermissions(...keys), @RequireAnyPermission(...keys), @Audit(action, opts), @Idempotent() — metadata only for now (guards come in P03/P04). AuthUser type.
14. Contracts: common/pagination.ts (PaginationQuerySchema page/pageSize≤100/sort, CursorQuerySchema, PageMetaSchema, CursorMetaSchema), common/id.ts (IdParamSchema uuid), common/problem.ts (ProblemDetailsSchema), common/money.ts (MoneyStringSchema). API helpers to build offset/cursor pagination from Prisma results (cursor = base64url JSON).
15. Health: @nestjs/terminus /api/v1/health/live and /health/ready (Redis now; DB added in P02), @Public, @SkipEnvelope.

Tests: unit (ProblemDetailsFilter mapping table, envelope, pagination helpers, LockService with redis mock), e2e (health, 404 problem+json with requestId, validation 400 example, throttling returns 429 problem).
```
**Done when:** checks green · invalid env makes boot fail with a readable message · every error response is problem+json with `requestId`.
**Commit:** `feat(api): add config, logging, errors, envelope, redis, queues and health foundation`

### P02 — Database layer, migrations & seed (M00)
Branch `chore/m00-database` · Read first: apps/api/CLAUDE.md (Prisma 7 section), schema.prisma, prisma/sql/001_extensions_and_search.sql, ARCHITECTURE §7.1
```
Step P02 — Database layer, first migration and seed (M00).

1. Install in apps/api: prisma@^7.10 (dev), @prisma/client@^7.10, @prisma/adapter-pg, pg, tsx, dotenv. Do NOT use Prisma 8 (still RC). Keep schema.prisma as provided; run `prisma validate` and `prisma format`. If anything must change, stop and explain before editing.
2. PrismaModule (global) + PrismaService using @prisma/adapter-pg exactly as shown in apps/api/CLAUDE.md. Generated client at src/generated/prisma (git-ignored). Add `postinstall`/`db:generate` so CI and fresh clones generate the client.
3. Transactions: @nestjs-cls/transactional + its Prisma adapter registered in ClsModule. Verify it works with Prisma 7 + driver adapter (write an integration test that rolls back on error). If incompatible, implement a minimal equivalent (TransactionHost with AsyncLocalStorage, @Transactional decorator) with the same API, and record the decision in docs/DECISIONS.md.
4. Initial migration: `prisma migrate dev --create-only --name init`, then edit migration.sql: paste section 1 of prisma/sql/001_extensions_and_search.sql at the TOP and section 2 at the BOTTOM. Apply. Verify: inserting an article populates "searchVector"; the trigram index exists.
5. Contracts: packages/contracts/src/permissions.ts (PERMISSIONS const object, keys exactly as REQUIREMENTS §2.1, with module + description), roles.ts (ROLE_KEYS + DEFAULT_ROLE_PERMISSIONS per ARCHITECTURE §7.1; SUPER_ADMIN = all), enums.ts mirroring every Prisma enum as `as const` arrays + Zod enums. Add an API unit test that asserts each contracts enum equals the generated Prisma enum values.
6. Seed (prisma/seed/index.ts, idempotent upserts, configured in prisma.config.ts): permissions, roles + role_permissions, super admin from SEED_SUPER_ADMIN_* (argon2id hash, ACTIVE, verified), categories (Politics, Business, Technology, Sports, Entertainment, Health, World, Opinion), ad placements (home_leaderboard 970×90 IMAGE; home_mrec 300×250 IMAGE/NATIVE; article_top 728×90 IMAGE; article_inline_1 NATIVE/TEXT; article_sidebar 300×600 IMAGE; category_leaderboard 728×90 IMAGE — with example CPM/CPC/flat rates in USD), plans (premium_monthly 5.00 USD MONTH, premium_yearly 50.00 USD YEAR), menus (header from categories, footer with legal pages), pages (about, contact, terms, privacy, advertise — placeholder content as TipTap JSON), site settings defaults for groups general, seo, workflow (requireChiefApproval true, minWords 300, autoReassignOnResubmit true), comments (moderationMode "post", autoHideReportThreshold 3), paywall (teaserParagraphs 3), ai (enabled checks, monthlyBudgetUsd 50, authorRunsPerDay 5, styleGuide ""), ads, billing (providers ["STRIPE"], graceDays 3, taxRate 0), email, security (require2faRoles ["SUPER_ADMIN","ADMIN","CHIEF_EDITOR"]).
   Demo seed (only when SEED_DEMO_DATA=true): one user per role (password = SEED_SUPER_ADMIN_PASSWORD), 12 articles across statuses with simple TipTap content, tags.
7. Health ready check includes the database.
8. Test infrastructure: .env.test pointing to newsroom_test + redis db 1; test/helpers/reset-db.ts (TRUNCATE all tables except _prisma_migrations … RESTART IDENTITY CASCADE), global setup that migrates the test DB once; test/factories/user.factory.ts with role helpers.
9. Base repository utilities: soft-delete `notDeleted` helper, Prisma error → DomainError translation (P2002 → ConflictError with field, P2025 → NotFoundError).
```
**Done when:** `docker compose up -d && pnpm --filter api db:migrate && pnpm --filter api db:seed` works twice in a row · Prisma Studio shows seeded data · enum parity test passes · checks green.
**Commit:** `feat(api): add prisma 7 data layer, init migration with search trigger, and seed`

---

## Phase 1 — Core publishing

### P03 — Authentication API (M01)
Branch `feat/m01-auth` · Read first: REQUIREMENTS M01, ARCHITECTURE §6, API_SPEC Auth, schema (User, RefreshToken, VerificationToken, OAuthAccount)
```
Step P03 — Authentication API (M01: AUTH-01…AUTH-10).

Implement modules/auth exactly per ARCHITECTURE §6 and API_SPEC "Auth":
1. Contracts: auth schemas (Register, Login, VerifyEmail, ForgotPassword, ResetPassword, ChangePassword, ChangeEmail, TwoFactorVerify, MeResponse, SessionResponse). Password policy: 10–128 chars, not equal to email, check against a small common-password list.
2. Infrastructure: MAIL_PORT + SmtpMailAdapter (nodemailer) + Handlebars template renderer with layout; templates verify-email, reset-password, email-changed, new-login (optional). EncryptionService (AES-256-GCM, ENCRYPTION_KEY). Token utilities (random 32 bytes base64url, sha256 hashing).
3. Services: AuthService (register, verifyEmail, login, refresh with rotation + reuse detection by familyId, logout, logoutAll, forgot/reset, changePassword, changeEmail), TokenService (JWT access, cookie writer/clearer with names nr_at / nr_rt / nr_csrf and attributes from config), TwoFactorService (otplib TOTP setup/enable/disable/verify, encrypted secret, 10 hashed recovery codes, challenge token in Redis 5 min), GoogleOAuth (passport-google-oauth20; link by verified email or create).
4. Guards: global JwtAuthGuard (reads nr_at cookie or Authorization Bearer for tooling; respects @Public; loads user status — suspended/deactivated ⇒ 401), global CsrfGuard (double submit for cookie-authenticated mutations; @SkipCsrf for webhooks/beacons), GET /auth/csrf.
5. Rate limits per ARCHITECTURE §6 with @Throttle and per-account counters in Redis.
6. Emails go through a `mail.send` BullMQ job (create the mail processor in NotificationsWorkerModule stub or a MailWorkerModule) with EmailLog rows.
7. Audit: auth.login, auth.login_failed, auth.refresh_reuse_detected, auth.password_reset, auth.2fa_enabled/disabled via AuditService (create a minimal modules/audit with AuditService.record + repository; the viewer comes later).
8. Users are created with role READER. Login of PENDING_VERIFICATION users is allowed; expose emailVerified in /auth/me (permissions come in P04 — return empty array for now).

Tests: unit for AuthService branches (reuse detection revokes family; reset revokes all; generic errors), TwoFactorService; e2e for every endpoint incl. cookie attributes, CSRF rejection, throttling on login, verification and reset flows (read tokens via InMemoryMail fake).
```
**Done when:** full register → verify (Mailpit) → login → refresh → logout works with curl/REST client; reuse of an old refresh token logs the user out everywhere; checks green.
**Commit:** `feat(auth): add cookie-based auth with refresh rotation, email flows, google oauth and totp`

### P04 — RBAC, users & profiles API (M02)
Branch `feat/m02-rbac-users` · Read first: REQUIREMENTS M02 + §2, ARCHITECTURE §7, API_SPEC "Users, roles, profiles"
```
Step P04 — RBAC, user admin and profiles (M02: USR-01…USR-06).

1. modules/rbac: PermissionsRepository/RolesRepository, PermissionService.getEffectivePermissions(userId) cached in Redis `perm:{userId}` (invalidate on role.changed), global PermissionsGuard for @RequirePermissions / @RequireAnyPermission. Role admin endpoints (system roles protected; only SUPER_ADMIN can grant SUPER_ADMIN).
2. /auth/me now returns roles, permissions, entitlements placeholder.
3. modules/users: profile (/me/profile, username uniqueness + reserved names list), author profile, contributor applications (apply, admin decision → grant CONTRIBUTOR + notification event), admin users list/detail/status/roles/comment-ban, data export (JSON of own data; synchronous for now), account deletion = anonymise (name "Former user", email deleted+uuid@invalid, clear profile, revoke sessions, keep articles/payments).
4. Every admin mutation audited with before/after.
5. Contracts for all of the above. Mappers must never expose passwordHash, twoFactorSecret, recovery codes.

Tests: table-driven unit test that every DEFAULT_ROLE_PERMISSIONS entry resolves; guard tests; e2e for each endpoint with 401/403/400/200 and the SUPER_ADMIN escalation rule.
```
**Done when:** permission changes take effect on the next request without re-login · checks green.
**Commit:** `feat(rbac): add permission guard, role admin, user admin and profiles`

### P05 — Web foundation, auth UI & dashboard shell
Branch `feat/web-foundation` · Read first: apps/web/CLAUDE.md, ARCHITECTURE §6 (web side), §18
```
Step P05 — Web foundation, auth pages and dashboard/admin shells.

1. UI base: shadcn/ui initialised for Tailwind 4; design tokens (light/dark) in styles/globals.css; fonts via next/font; ThemeProvider; Toaster (sonner); TanStack Query provider with sensible defaults; next-intl with messages/en.json (all strings so far).
2. lib/api: server.ts (apiServer with tags/revalidate/withCookies), client.ts (CSRF header, single-flight refresh on 401, retry once), errors.ts (ApiError from problem details), query-client.ts.
3. Auth: lib/auth/session.ts getSession() (server, cached per request via React cache, calls /auth/me with cookies), useSession() hook, <Can permission> + useCan().
4. src/proxy.ts per ARCHITECTURE §6: for /dashboard/** and /admin/**: refresh when access cookie missing/expired and refresh cookie exists (forward Set-Cookie), else redirect to /login?next=…; for /login and /register redirect logged-in users to /dashboard. Matcher excludes static assets.
5. Reusable form components in components/form: FormInput, FormPassword (show/hide + strength), FormTextarea, FormSelect, FormCombobox (async search), FormCheckbox, FormSwitch, FormDatePicker, FormDateTimePicker (site timezone), FormMoney, FormTagInput, FormSubmit — all RHF-bound with label/description/error/required. Helper to map ApiError.errors to setError.
6. Pages (auth route group): login (with 2FA step), register, verify-email (token from URL), forgot-password, reset-password, Google button. Accessible, responsive, i18n.
7. Dashboard shell (/dashboard layout): sidebar built from a nav config filtered by permissions (sections: Overview, My articles, Editorial, Moderation, Advertising, Billing, Saved, Following, Notifications, Settings), top bar with user menu + notifications bell placeholder, breadcrumbs, responsive mobile drawer. Admin shell (/admin layout) similar, gated by dashboard.admin.
8. Settings pages: profile (with avatar URL for now), security (change password, sessions list with revoke, 2FA setup with QR + recovery codes download), become-a-contributor application form.
9. Generic <DataTable> (TanStack Table) with URL-synced pagination/sort/filters, skeleton, empty and error states. Use it for /admin/users (list, filters, detail drawer with role assignment and suspend).

Tests: Vitest for client.ts refresh logic, useCan, form error mapping; Playwright: register→verify (read Mailpit API)→login→dashboard→logout.
```
**Done when:** login/refresh/logout work in the browser; admin can assign roles and the sidebar changes after reload · checks green.
**Commit:** `feat(web): add ui foundation, auth pages, proxy refresh and dashboard/admin shells`

### P06 — Taxonomy & media API (M03, M04)
Branch `feat/m03-m04-taxonomy-media` · Read first: REQUIREMENTS M03, M04, ARCHITECTURE §11, API_SPEC Taxonomy & Media
```
Step P06 — Taxonomy and media APIs (TAX-01…TAX-03, MED-01…MED-05).

1. modules/taxonomy: categories (tree max depth 2, reorder, delete guard, slug from name with uniqueness), tags (typeahead, create, merge in a transaction re-pointing ArticleTag rows), public category tree cached in Redis + `category.updated` event.
2. infrastructure/storage: STORAGE_PORT (presignPut, head, getObjectStream, putObject, delete, publicUrl) + S3StorageAdapter (@aws-sdk/client-s3 + s3-request-presigner, path-style, auto-create bucket in dev). FakeStorage for tests.
3. modules/media: presigned upload → complete → `media.process` job in MediaWorkerModule (file-type sniffing, sharp rotate/strip, WebP variants 320/640/1024/1600 + 200×200 thumb, no upscaling, checksum) → READY + media.ready event; list/detail/update/delete with usage check (articles featured/og/body references + creatives). Allowed MIME + size limits from config.
4. Cleanup cron (in worker): PENDING assets older than 24 h → delete object + row.

Tests: unit (slug uniqueness, tree depth, merge), processor test with a fixture JPEG (EXIF orientation + GPS stripped), MIME mismatch → FAILED; e2e for endpoints.
```
**Done when:** an image uploaded via presigned URL ends READY with variants visible at MEDIA_PUBLIC_BASE_URL · checks green.
**Commit:** `feat(media): add taxonomy apis and presigned upload pipeline with image variants`

### P07 — Taxonomy & media UI
Branch `feat/web-taxonomy-media`
```
Step P07 — Taxonomy and media UI.

1. /admin/categories: tree view with drag-to-reorder (dnd-kit), create/edit dialog (SEO fields with counters), active/nav toggles, delete with guard message.
2. /admin/tags: DataTable, edit, merge dialog.
3. Media: <MediaUploader> (drag & drop, multiple, progress per file via presigned PUT, then complete + poll until READY), <MediaLibraryDialog> (grid, search, filter, pagination, select one/many, edit alt/caption/credit inline), /admin/media page, lib/media/loader.ts for next/image choosing the closest variant.
4. FormImagePicker component (opens MediaLibraryDialog; enforces alt text before selection when `requireAlt`).

Tests: Vitest for loader variant selection and uploader state machine; Playwright: upload image → set alt text → appears in library.
```
**Commit:** `feat(web): add category/tag admin and media library with direct uploads`

### P08 — Articles API (M05)
Branch `feat/m05-articles` · Read first: REQUIREMENTS M05, ARCHITECTURE §8.4, §9, API_SPEC Articles
```
Step P08 — Articles API (ART-01…ART-12).

1. Contracts: editor-schema.ts (allowed TipTap node/mark types and embed provider allow-list — single list shared with the web editor), CreateArticle, UpdateArticle (requires version; no status field), ArticleListQuery, ArticleDetailResponse (with `can` hints), ArticleListItem, Revision schemas, PreviewToken.
2. ArticleContentService: validate node types, server-side HTML rendering with TipTap's HTML utilities using the same extensions as the editor (confirm the server-safe API in the installed TipTap 3 version), sanitize-html allow-list (ARCHITECTURE §9), plainText, wordCount, readingTime, referenced media ids. Unit-test with fixtures incl. XSS payloads (script, onerror, javascript: links, disallowed iframes).
3. SlugService (transliteration fallback, uniqueness, redirect on change after publish).
4. ArticlesService/Repository: create draft, list (scoped: own vs article.review), detail, update with optimistic locking (409 includes current version + updatedBy), soft delete rules, co-authors, tags (create missing tags only if tag.create), edit lock acquire/heartbeat/release/takeover (audited), revisions list/detail/diff (use `diff` package on plain text + HTML-aware diff for display)/manual save/restore, preview token (HMAC, 1 h) + /public/preview/:token payload, corrections (PUBLISHED only).
5. ArticlePolicy per ARCHITECTURE §7 and §8.4 with exhaustive table-driven tests.
6. Emit article.updated; stale lock cron (release > 5 min).

Do NOT implement status transitions here (P10).
```
**Done when:** concurrent update test returns 409 · sanitiser tests pass · checks green.
**Commit:** `feat(articles): add article authoring api with revisions, locking and sanitised content`

### P09 — Article editor UI
Branch `feat/web-article-editor`
```
Step P09 — Article editor UI (ART-02…ART-09, ART-12).

1. /dashboard/articles: my articles DataTable with status tabs, search, category filter, quick actions.
2. /dashboard/articles/new → creates draft and redirects to /[id]/edit.
3. Editor page: TipTap 3 with the extension list from contracts (headings, marks, lists, link dialog with rel options, blockquote, pull quote node, image node from MediaLibraryDialog with caption/credit, embed node (allow-listed URLs → oEmbed-like preview), table, hr, code block, undo/redo, character/word count). Sticky toolbar, bubble menu, slash command menu.
4. Side panel tabs: Details (title, subtitle, excerpt, category, tags, type, visibility, co-authors, featured image with required alt, sponsored + sponsor name), SEO (title/meta with counters, slug with availability check, canonical, OG image, Google/social preview cards).
5. useAutosave: debounce 2 s, sends version, status indicator (Saving… / Saved / Offline / Conflict). Conflict dialog: show who saved, offer reload (and overwrite only with article.update.any).
6. useEditLock: acquire on open, heartbeat 60 s, release on unload; read-only banner when locked by someone else, takeover button for editors.
7. Revision history page with side-by-side diff and restore. Preview button opens /preview/[token] (implement the preview route rendering the public article template with noindex — basic template now, full design in P13).
8. Submit button placeholder (wired in P11).

Tests: Vitest for useAutosave (debounce, version bump, conflict), editor extension parity test (web list == contracts list); Playwright: write article with image → autosave → reload persists → revision restore.
```
**Commit:** `feat(web): add tiptap article editor with autosave, locking, seo panel and revisions`

### P10 — Editorial workflow API (M06)
Branch `feat/m06-workflow` · Read first: REQUIREMENTS M06, ARCHITECTURE §8 (all), API_SPEC Editorial workflow
```
Step P10 — Editorial workflow API (WF-01…WF-13).

1. workflow.transitions.ts: the §8.1 table as data (action, from[], to, permission, actorRule, requiresNote, sideEffects flags). Exhaustive table-driven unit tests: every action × every status × role matrix → allowed/denied.
2. WorkflowService.transition(articleId, action, actor, payload): @Transactional, row lock (SELECT … FOR UPDATE via repository raw query), table lookup, policy + actor rule, payload validation per action, completeness check (§8.2, settings-driven, returns field-level errors), version check if supplied, status/timestamp updates, revision creation where required, WorkflowTransition row, assignment changes, audit log, then domain events after commit.
3. Critical AI findings acknowledgement on APPROVE (query latest AiReview — table exists; until P15 there are none).
4. Scheduling: delayed BullMQ job jobId publish:{articleId}; UNSCHEDULE removes it; AUTO_PUBLISH processor; cron safety net every minute with LockService; failure → admin notification event.
5. Fast-track, unpublish/republish, reopen, send back, approve-and-publish combo when allowed.
6. Endpoints: transitions (POST/GET), available-actions, editorial queue (views unassigned/mine/all/overdue with filters and sort), calendar, assignments, notes (threads, anchors, visibility rules: authors never see INTERNAL notes; editors see all), resolve.
7. Events emitted with payloads needed by notifications (articleId, title, authorId, coAuthorIds, assigneeId, actorId, note).

Tests: e2e for the full happy path (submit → claim → request changes → resubmit → approve → schedule → auto publish via job), forbidden paths, completeness errors, concurrency (two editors claiming simultaneously → one wins).
```
**Done when:** no code path other than WorkflowService writes Article.status (add a unit test that greps/inspects repository update types or an ESLint restricted-syntax rule) · checks green.
**Commit:** `feat(workflow): add editorial state machine, assignments, notes and scheduled publishing`

### P11 — Editorial UI
Branch `feat/web-editorial`
```
Step P11 — Editorial UI.

1. Action bar component driven by GET /articles/:id/available-actions: buttons + confirm dialogs collecting required inputs (note, reason, assignee picker, due date, schedule date-time in site timezone, critical-findings acknowledgement checkbox). Shown in the editor (author actions) and review workspace (editor actions).
2. Submit flow for authors: completeness errors shown inline (jump to field).
3. /dashboard/editorial queue: tabs (Unassigned, Mine, All, Overdue) with counts, filters, sort, claim button, assign dialog.
4. Review workspace /dashboard/editorial/review/[id]: read-only article (or editable when allowed) + right panel tabs: Notes (threaded, anchored highlights — select text → add note; click note → scroll/highlight), AI review (placeholder until P16), History (transitions timeline), Revisions diff vs previous submission.
5. Author view of CHANGES_REQUESTED: banner with editor note, AUTHOR-visible notes listed, resubmit.
6. /dashboard/editorial/calendar: month/week views of scheduled & published, drag to reschedule (calls SCHEDULE/UNSCHEDULE as needed).
7. Status badges, timestamps in site timezone, optimistic UI only where safe.

Tests: Playwright for contributor submit → editor request changes with anchored note → contributor resubmit → editor approve → chief schedule.
```
**Commit:** `feat(web): add editorial queue, review workspace, notes and calendar`

### P12 — Notifications & email (M14)
Branch `feat/m14-notifications` · Read first: REQUIREMENTS M14, ARCHITECTURE §16
```
Step P12 — Notifications and transactional email (NTF-01…NTF-04).

1. Contracts notifications.ts catalogue (type, defaultChannels, mandatory, title/body templates, link builder) covering: auth/security, contributor application decision, all workflow events (submitted → chief editors/unassigned pool, assigned → assignee, changes requested/approved/rejected/scheduled/published → author + co-authors, fast-track → chief editors), comment replies, AI review completed/critical, campaign & payment & subscription events (types only for now), scheduled publish failure → admins.
2. NotificationService.notify(), preferences resolution, bulk insert, mail jobs, EmailLog. Listeners in modules/notifications subscribing to domain events (one listener class per source module).
3. Templates for every email type (Handlebars layout with site name/logo from settings, plain-text alternative).
4. Endpoints per API_SPEC Notifications. Cleanup cron for old read notifications.
5. Web: bell with unread count (poll 60 s + focus), dropdown of latest 10, /dashboard/notifications page with filters and mark all read, /dashboard/settings/notifications preference matrix (mandatory types disabled toggles).

Tests: unit for preference resolution and recipients per event; e2e: workflow transition creates notifications + EmailLog; Playwright: bell count updates after an editor action.
```
**Commit:** `feat(notifications): add in-app and email notifications with preferences`

### P13 — Public site pages (M08)
Branch `feat/m08-public-site` · Read first: REQUIREMENTS M08, ARCHITECTURE §12.1, API_SPEC Public content, apps/web/CLAUDE.md
```
Step P13 — Public site pages and public-content API (PUB-01…PUB-04, PUB-08).

API (modules/public-content): home aggregation, feeds with cursor pagination, article by slug with access computation (MEMBERS/PREMIUM teaser = first N paragraphs from settings; entitlement check via an EntitlementService stub returning false until P21), body endpoint for entitled users, related (same category + shared tags), most-read (Redis sorted sets), pages, menus, public settings, author profile with articles. All responses cache-friendly (no user data unless /body). Slug redirects return { redirectTo }.

Web:
1. Public layout: header (logo, category nav from menus, search, account menu, subscribe CTA), breaking-news ticker, footer (menus, social, newsletter form placeholder), dark mode.
2. Home, category (with sub-category chips, pagination via cursor "Load more"), tag, author, CMS page, article page (hero, byline with co-authors, dates "Published / Updated", featured image with caption/credit, body styles for every node type incl. embeds with lazy facades, tags, share buttons, author box, related, correction notes, sponsored label, comments placeholder, <AdSlot> placeholders reserving space).
3. <ArticleAccessGate> for MEMBERS/PREMIUM (login CTA or pricing CTA; full body fetched client-side when entitled).
4. Rendering & caching per ARCHITECTURE §12.1 with the approach recorded in DECISIONS (tags per route), loading/error/not-found states, permanentRedirect on slug redirects.
5. Typography and layout must be responsive and accessible (AA contrast, skip-link, landmarks).

Tests: unit for teaser extraction and access computation; Playwright: published article visible on home + category + article page; premium article shows paywall to anonymous user.
```
**Commit:** `feat(public-content): add public site pages, article template and paywall gate`

### P14 — SEO, feeds, revalidation & view tracking (M08)
Branch `feat/m08-seo`
```
Step P14 — SEO, sitemaps, feeds, on-demand revalidation and view counting (PUB-05…PUB-07).

1. generateMetadata for every public route (title template, description, canonical, OG/Twitter, article OG fields), dynamic OG image for articles (opengraph-image.tsx) when no OG image set.
2. JSON-LD builders: NewsArticle (with paywall markup), BreadcrumbList, WebSite+SearchAction, Organization; validated by unit tests against expected shapes.
3. Sitemap index + paged article sitemaps + categories + authors, Google News sitemap (48 h), RSS 2.0 site & per category, robots.ts (disallow /dashboard, /admin, /preview, /api).
4. API WebRevalidationService + listeners (article.published/updated/unpublished, category.updated, page.published, settings.updated, menus) → POST /api/revalidate with secret; web route handler validates secret and revalidates tags (Next 16 API as decided). Retries via a small BullMQ job if the web is down.
5. View tracking: POST /public/articles/:id/view (bot filter with isbot, visitor hash with daily salt, Redis dedupe, counters, HyperLogLog, most-read sorted sets) + hourly flush job to ArticleDailyStat and viewCount. Web <ViewBeacon>.

Tests: unit for sitemap/RSS generation and JSON-LD; e2e: publishing triggers revalidation call (fake web endpoint); view endpoint dedupes.
```
**Done when:** Rich Results Test-compatible JSON-LD (validate output manually with a sample) · publishing an article updates home within seconds · checks green.
**Commit:** `feat(public-content): add seo metadata, json-ld, sitemaps, rss, revalidation and view tracking`

---

## Phase 2 — Intelligence & community

### P15 — AI review API (M07)
Branch `feat/m07-ai-review` · Read first: REQUIREMENTS M07, ARCHITECTURE §10, API_SPEC AI review
```
Step P15 — AI-assisted review backend (AI-01…AI-10).

1. infrastructure/ai: AI_PROVIDER port, AnthropicAdapter (@anthropic-ai/sdk; structured output via a forced tool whose input_schema = z.toJSONSchema(schema), or the SDK's native structured output if available in the installed version; timeouts; retries only on 429/5xx), pricing.ts (USD per 1M tokens per model, env override), FakeAiProvider for tests.
2. Prompt registry: prompts/review.v1.ts (system prompt as a senior news editor applying the site style guide; explicit rule that <article> content is untrusted data; severity rubric with examples; output limits) + outputSchema (ARCHITECTURE §10) + buildUserContent(article, settings, existingTags).
3. Local analysis: Flesch reading ease, sentence/paragraph stats, duplicate detection (pg_trgm title candidates + FTS keywords + 5-gram shingle Jaccard on plainText) → DUPLICATE findings + duplicateMatches.
4. AiReviewService: enqueue (budget check, author daily limit, dedupe if a QUEUED/RUNNING review exists for the same revision), listener on article.submitted (AUTO_ON_SUBMIT), manual runs, findings status updates, usage endpoint, admin AI settings (strict schema; enabled checks; style guide; budget; models).
5. AiReviewProcessor (AiReviewWorkerModule): status transitions, chunking for long articles, one repair retry on schema failure, excerpt → offset mapping, cost computation, events ai_review.completed / failed; CRITICAL → notify chief editors (notification types from P12).
6. Wire WorkflowService APPROVE acknowledgement check to real data.

Tests: processor with FakeAiProvider (valid, invalid-then-repaired, failing), budget and rate limits, duplicate detection fixtures, prompt snapshot test (prompt changes must be intentional).
```
**Commit:** `feat(ai-review): add asynchronous ai review with versioned prompts, cost tracking and duplicate detection`

### P16 — AI review UI
Branch `feat/web-ai-review`
```
Step P16 — AI review UI.

1. AI panel (review workspace + author editor side panel): run button with remaining daily runs, status (queued/running with polling, failed with retry), overall score gauge, summary, findings grouped by category and sorted by severity with filters, each finding: message, suggestion, excerpt (click → highlight in editor/article), Accept / Dismiss.
2. Suggestions card: headlines (apply to title), SEO title, meta description, excerpt, tags (apply = normal article PATCH with version; show diff before applying).
3. Critical findings banner + required acknowledgement in the approve dialog.
4. /admin/ai: settings form (checks toggles, style guide editor, budget, limits, models) and usage chart (cost per day, by model, budget progress).

Tests: Vitest for finding grouping/sorting and apply-suggestion diff; Playwright with the API using FakeAiProvider (test env flag) — submit → AI findings visible → apply headline.
```
**Commit:** `feat(web): add ai review panel, suggestion apply flow and ai admin`

### P17 — Engagement (M09)
Branch `feat/m09-engagement` · Read first: REQUIREMENTS M09, API_SPEC Engagement
```
Step P17 — Comments, moderation, reactions, bookmarks, follows, newsletter (ENG-01…ENG-07).

API: comments (verified + not banned, 1-level replies, edit window 15 min, rate limit 5/min, profanity filter list in settings, moderation mode pre/post from settings, auto-hide at report threshold, commentCount maintenance in transactions), likes, reports, moderation queue & decisions & bans (audited), reactions, bookmarks, follows, personalised feed, newsletter double opt-in + unsubscribe + admin list/CSV. Optional toxicity check with the fast AI model behind a setting (async job, flags to PENDING).
Web: comments section on article page (sign-in CTA, compose, replies, edit/delete, like, report dialog, pending notice), /dashboard/comments moderation queue + reports, reactions bar, bookmark button, follow buttons (author box, category header), /dashboard/saved, /dashboard/following, "For you" feed tab on home for logged-in users, newsletter forms (footer, article end, confirm & unsubscribe pages).
Notifications: comment reply, moderation outcome, followed author published.

Tests: unit for moderation rules & counters; e2e for endpoints; Playwright: comment → report ×3 → hidden → moderator approves.
```
**Commit:** `feat(engagement): add comments with moderation, reactions, bookmarks, follows and newsletter`

### P18 — Search (M10)
Branch `feat/m10-search`
```
Step P18 — Search (SRC-01…SRC-04) per ARCHITECTURE §13.

API: SearchRepository with tagged $queryRaw (websearch_to_tsquery + unaccent, ts_rank_cd with recency decay, filters, total count, ts_headline snippets), suggest endpoint (pg_trgm, Redis cache 60 s), dashboard search across statuses (permission-scoped). SEARCH_PORT interface so Meilisearch can replace it later.
Web: header search with typeahead (debounced, keyboard navigation), /search page with filters (category, tag, author, type, date range), highlighted snippets, pagination, noindex, empty state; dashboard article search uses the same endpoint.

Tests: e2e with seeded articles (ranking: title match > body match; accents ignored; unpublished excluded).
```
**Commit:** `feat(search): add full-text search with filters, snippets and typeahead`

### P19 — Role-based dashboards (M15)
Branch `feat/m15-dashboards`
```
Step P19 — Role-based dashboards (DSH-01…DSH-05).

API modules/dashboards: /dashboards/me composes widgets per role using other modules' services (never their repositories); author, editorial, admin endpoints (advertiser endpoint returns empty until P22). Cache per user 60 s.
Web: /dashboard overview renders widgets by role: reader (saved, following updates, subscription status), author (status counts, action needed list, 30-day views sparkline, latest AI scores), editor (queue counts, my assignments with due dates, overdue, today's schedule, critical AI flags), admin link to /admin; /admin overview KPIs (published today/week, pending reviews, new users, active subscribers placeholder, AI spend) + system status (queues, failed jobs count, last cron runs).
Charts with recharts, skeletons, empty states.

Tests: unit for widget composition per role; Playwright smoke per role (seeded demo users).
```
**Commit:** `feat(dashboards): add role-based dashboard widgets and admin overview`

---

## Phase 3 — Monetisation

### P20 — Payments core (M12)
Branch `feat/m12-payments-core` · Read first: REQUIREMENTS M12, ARCHITECTURE §15, API_SPEC Billing. **Confirm the gateway (OPEN_QUESTIONS E1) before starting.**
```
Step P20 — Payments core (PAY-01, PAY-04…PAY-08).

1. infrastructure/payments: PaymentGatewayPort + NormalizedPaymentEvent (contracts), PAYMENT_GATEWAYS registry, StripeAdapter (hosted Checkout for one-off + subscription mode, refunds, webhook signature verification with raw body, customer portal), FakeGateway for tests (and an SslCommerzAdapter stub with TODOs if confirmed for later).
2. modules/billing: PaymentsService (create payment with idempotency key, provider checkout, status polling endpoint), webhook controller (raw body, @Public, @SkipCsrf, @SkipEnvelope) → WebhookEvent insert (dedupe) → `billing.process-webhook` job → handlers per normalized type in @Transactional, emitting payment.succeeded / payment.failed / refund.processed.
3. Invoices: InvoiceNumberService using invoice_number_seq (raw nextval), invoice + items on payment success, PDF job with pdfkit (company details from settings, billing snapshot), signed download URLs.
4. Refunds (admin), payments ledger with filters + CSV, webhook events list + replay (re-enqueue).
5. @Idempotent interceptor (Redis-stored response for 24 h keyed by user + key).

Tests: adapter mapping tests with recorded Stripe event fixtures; webhook idempotency (same event twice → one effect); refund flow; e2e with FakeGateway.
```
**Commit:** `feat(billing): add payment gateway abstraction, stripe adapter, webhooks, invoices and refunds`

### P21 — Subscriptions & paywall (M12)
Branch `feat/m12-subscriptions`
```
Step P21 — Reader subscriptions and paywall entitlements (PAY-03, PUB-04).

API: plans admin CRUD (deactivate when in use), public plans, subscription checkout, webhook handlers for subscription created/updated/canceled + invoice paid (period dates, status mapping, grace days), cancel/resume, portal URL, EntitlementService (ARCHITECTURE §15, Redis cache, busted on events) replacing the P13 stub, /auth/me entitlements, expiry & renewal-reminder cron (for non-recurring gateways).
Web: /pricing page (plans from API, features list, current plan state), checkout redirect + success page polling payment/subscription status, /dashboard/billing (current plan, renewal date, cancel/resume, invoices with PDF links, payment history), paywall CTA → pricing with return URL, entitled users see full premium body.
Emails: subscription activated, payment failed, canceled, renewal reminder.

Tests: entitlement matrix unit tests (active, trialing, past_due within/after grace, canceled before/after period end); e2e with FakeGateway webhooks; Playwright: anonymous → paywall → subscribe (fake gateway) → full article.
```
**Commit:** `feat(billing): add subscriptions, entitlements and premium paywall`

### P22 — Advertising API (M11)
Branch `feat/m11-ads-api` · Read first: REQUIREMENTS M11, ARCHITECTURE §14, API_SPEC Advertising
```
Step P22 — Advertising backend (ADS-01…ADS-11).

1. Advertiser profile + admin approval; placements CRUD; campaigns CRUD with rate snapshot from placement rate card, quote endpoint (budget ↔ estimated impressions/clicks/days), creatives CRUD (image requires READY media with alt; HTML only if setting allows; targetUrl https validation).
2. CampaignLifecycleService implementing the §14.1 state machine (data-driven table + exhaustive tests), submit → PENDING_PAYMENT (or PENDING_REVIEW for house/invoiced), checkout using billing PaymentsService (purpose AD_CAMPAIGN), listener on payment.succeeded → PENDING_REVIEW, review decisions for campaigns & creatives (reject campaign ⇒ refund via billing), pause/resume/cancel, house campaigns by AD_MANAGER.
3. Serving per §14.2: candidate cache in Redis (rebuild on events + every 60 s), targeting (category, device via UA parser, language), frequency cap with nr_vid cookie, priority tiers + weighted random, HMAC tokens, 204 on no fill.
4. Tracking per §14.3: impression beacon, click redirect (UTM append), bot filter, token dedupe, Redis hash counters.
5. Jobs/crons: flush counters (Lua get-and-delete) → AdDailyStat upsert-increments + spend + budget completion + low-budget event; lifecycle cron (start/end); FLAT daily charge.
6. Stats endpoints (group by day/placement/creative, CSV) for advertisers and admins.
Notifications for campaign events.

Tests: serving selection with seeded random (deterministic), frequency cap, budget exhaustion, token tampering rejected, flush math for CPM/CPC/FLAT with Decimal precision, e2e lifecycle with FakeGateway.
```
**Commit:** `feat(ads): add advertiser campaigns, review lifecycle, serving, tracking and spend`

### P23 — Advertising UI
Branch `feat/web-ads`
```
Step P23 — Advertising UI.

1. <AdSlot placement> client component per apps/web/CLAUDE.md (reserved size per placement, fetch serve, render IMAGE/TEXT/NATIVE/HTML (sandboxed iframe srcdoc), "Sponsored"/"Ad" label, viewable impression beacon once, click via /api/v1/p/c/:token, no layout shift, respects consent setting). Place slots on home, category, article (top, inline after paragraph N, sidebar).
2. Advertiser area /dashboard/ads: onboarding form, campaigns list, campaign wizard (details → placements with rate card → schedule & budget with live quote → targeting → creatives with live preview per placement size → review & pay), campaign detail (status timeline, rejection reasons, creatives with statuses, pause/resume/cancel, stats charts by day/placement/creative, CSV export), invoices.
3. Admin /admin/ads: placements manager, review queue (campaign + creative previews, approve/reject with reason), all campaigns, advertisers approval, house campaign creation, ad revenue report.
4. "Advertise with us" CMS page CTA → register as advertiser.

Tests: Vitest for AdSlot visibility/beacon logic (IntersectionObserver mock); Playwright: advertiser creates campaign → pays (fake) → admin approves → ad renders on article → click redirects.
```
**Commit:** `feat(web): add ad slots, advertiser campaign wizard and ad operations admin`

---

## Phase 4 — Operations, insight & launch

### P24 — Admin panel & site settings (M16)
Branch `feat/m16-admin`
```
Step P24 — Admin panel completion (ADM-01…ADM-05).

API: settings per group with strict Zod schemas (public flag drives /public/settings; revalidate on change; audit diff), pages CRUD + publish (TipTap content via ArticleContentService), menus editor, admin articles list + bulk actions + hard delete (SUPER_ADMIN), audit log query endpoint, system status (queue counts, failed jobs, last cron runs stored in Redis by each cron, storage usage estimate), Bull Board mounted at /api/v1/admin/queues behind dashboard.admin.
Web: /admin/settings/[group] forms (general incl. logo picker & timezone, seo defaults, workflow, comments, paywall, ads, billing, email, security), /admin/pages (list + editor reusing TipTap editor), /admin/menus (nested drag-drop editor), /admin/articles (bulk actions), /admin/audit-log (filters, JSON diff viewer), /admin/system.
Cookie consent banner (setting-driven) gating analytics/ads scripts; analytics script injection (GA4/Plausible id from settings) via next/script after consent.

Tests: settings schema tests; e2e for settings permissions & audit; Playwright: change site name → public header updates after revalidation.
```
**Commit:** `feat(site): add settings, cms pages, menus, audit viewer, system status and consent`

### P25 — Analytics & reports (M17)
Branch `feat/m17-reports`
```
Step P25 — Reports (RPT-01…RPT-05).

API modules/analytics: content report (views by day/category/author, top articles), editorial report (submissions, approval rate, avg time SUBMITTED→APPROVED and →PUBLISHED from WorkflowTransition, per-editor throughput), revenue report (ad revenue from AdDailyStat spend, subscription revenue & MRR from payments/subscriptions, churn, refunds), ads report, own article stats; date ranges in site timezone; streamed CSV for all (format=csv). Use efficient SQL ($queryRaw tagged) with indexes; add any missing indexes via migration.
Web: /admin/reports/{content,editorial,revenue,ads} with date-range picker, KPI tiles, charts, tables, CSV download; author "My stats" page.

Tests: report SQL against seeded fixtures with known expected numbers.
```
**Commit:** `feat(analytics): add content, editorial, revenue and ads reports with csv export`

### P26 — Contributor payouts (M13) — only if confirmed
Branch `feat/m13-payouts`
```
Step P26 — Contributor payouts (PO-01…PO-03), as confirmed in DECISIONS.md.

API: rate settings (per article type/category or manual), generate payouts for a period (published articles by contributors in range, one Payout per user, idempotent by unique (user, period)), approve/reject/mark-paid with reference (audited), contributor history + pending estimate, notifications.
Web: /admin/payouts (generate, review items, approve, mark paid, CSV), /dashboard/earnings for contributors.

Tests: generation math and idempotency; permission e2e.
```
**Commit:** `feat(payouts): add contributor payout batches and earnings view`

### P27 — Security hardening, accessibility & E2E (M18)
Branch `chore/m18-hardening`
```
Step P27 — Hardening pass (SEC-01…SEC-06, NFRs).

1. Produce docs/SECURITY_REVIEW.md: walk ARCHITECTURE §20 and the apps/api/CLAUDE.md endpoint checklist across ALL controllers (script that lists routes with their decorators to find missing @RequirePermissions/@Public/@Throttle), fix gaps.
2. Web CSP with nonces (Next 16 approach), security headers, frame-src allow-list for embeds and ads, Referrer-Policy, Permissions-Policy.
3. Dependency audit (pnpm audit), Renovate/Dependabot config, secrets scan (gitleaks) in CI.
4. Data export/delete flows verified; IP hashing everywhere; log redaction verified.
5. Accessibility audit with @axe-core/playwright on key pages; fix violations.
6. Performance: Lighthouse CI on home/article (budgets: LCP < 2.5 s, CLS < 0.1); API p95 check with k6 script on public endpoints and ad serving.
7. Complete Playwright suites for REQUIREMENTS §6 journeys; CI job running them against a docker-compose stack.

Report findings with severity and what was fixed vs deferred.
```
**Commit:** `chore(repo): security, accessibility and performance hardening with full e2e suite`

### P28 — Deployment & CI/CD
Branch `chore/deploy` · Read first: ARCHITECTURE §23. **Confirm hosting (OPEN_QUESTIONS F1).**
```
Step P28 — Containerisation, CI/CD and operations runbook.

1. docker/api.Dockerfile (multi-stage, pnpm deploy/prune, prisma generate, non-root user, healthcheck) used for both api and worker; docker/web.Dockerfile (Next standalone, non-root); .dockerignore.
2. docker/compose.prod.yml: caddy (Caddyfile: TLS, /api/v1/* → api:4000, rest → web:3000, compression, security headers, body size limits, block /api/revalidate from public except internal network if feasible), api, worker, web, (optional) postgres + redis with volumes when not managed; healthchecks; restart policies; log rotation.
3. One-off migrate service/command (`prisma migrate deploy`) run before rolling the app containers.
4. GitHub Actions: ci.yml (full checks + API e2e with service containers + Playwright on compose), deploy-staging.yml (on main: build & push to GHCR tagged SHA, SSH deploy, migrate, up -d, smoke tests), deploy-production.yml (on release tag with manual approval).
5. Backups: nightly pg_dump to object storage with retention (script + cron container) — or document managed PITR settings; restore script and drill instructions.
6. Monitoring: Sentry releases with source maps, uptime checks for /health/ready and home page, alert emails (ARCHITECTURE §21).
7. docs/RUNBOOK.md: environments, deploy/rollback, migrations (expand/contract), rotating secrets, restoring backups, replaying webhooks, retrying failed jobs, handling AI budget exhaustion, incident checklist.
```
**Commit:** `chore(ci): add production docker images, compose, ci/cd pipelines, backups and runbook`

---

## Phase gates (client demo checklist)

Auto mode pauses automatically after P14, P19 and P23 (`pauseAfter` in `.claude/auto.config.json`). Add `"P05"` there if you want a pause for the first demo. Run the **Phase review** prompt at each pause.

| After | Demo to client |
|-------|----------------|
| P05 | Login/register/2FA, admin user & role management |
| P14 | Write → submit → review → approve → schedule → publish → visible on public site with SEO |
| P19 | AI review, comments & moderation, search, dashboards |
| P23 | Subscriptions/paywall, advertiser self-service → approval → live ads with stats |
| P28 | Staging = production-like; UAT sign-off; launch checklist |
