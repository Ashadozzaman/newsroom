# CLAUDE.md — Newsroom Platform

Custom article/news publishing platform: contributors submit articles → editors review (AI-assisted) through an approval workflow → published to an SEO-optimised public site. Revenue from ads (self-serve + house) and reader subscriptions. Role-based dashboards and a full admin panel.

**Stack:** pnpm + Turborepo monorepo · `apps/api` NestJS 12 + Prisma 7 + PostgreSQL + Redis/BullMQ · `apps/web` Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn/ui · `packages/contracts` shared Zod 4 schemas.

## Read before you work

| File | Read when |
|------|-----------|
| `docs/PROGRESS.md` | **Every session start** — what is done, what is next |
| `docs/REQUIREMENTS.md` | Scope & acceptance criteria (module IDs M00–M18, requirement IDs like `WF-06`) |
| `docs/ARCHITECTURE.md` | Any design question; section refs `§N` are stable |
| `docs/API_SPEC.md` | Before adding/changing an endpoint |
| `apps/api/prisma/schema.prisma` | Before touching data — it is the data source of truth |
| `apps/api/CLAUDE.md` / `apps/web/CLAUDE.md` | Before working inside that app |
| `docs/DECISIONS.md` | Before re-deciding anything; append new decisions there |
| `docs/AUTOMATION.md` | Before running any step: modes, agent team, pipeline per step, gates |

## How we work (mandatory)

There are two modes (`docs/AUTOMATION.md §1`). The current mode is in `.claude/state/auto.json`; check it with `node scripts/auto.mjs status`. The default is **MANUAL**. **AUTO** is on only after `/auto` or `scripts/auto-run.mjs`.

1. **One step at a time.** Run steps with the run-step procedure (`.claude/commands/run-step.md`). You are the orchestrator. The subagents in `.claude/agents/` plan, implement, test, review and document, following the pipeline row in `docs/AUTOMATION.md §4`. Work only on the current step.
2. **Plan first** with the `planner` agent. Install dependencies yourself, before parallel work. Run agents in parallel only on disjoint files.
3. **Ask vs. assume.** MANUAL: ask when requirements are ambiguous or docs conflict. AUTO: use the documented default for **[CONFIRM]** items and log it as auto-assumed (`docs/AUTOMATION.md §8`). Pause only when no default exists or a `confirmBefore` decision is TBD.
4. **Quality gate.** A step is complete only when both are true: `node scripts/verify.mjs --step <ID>` passes on the final tree, **and** `code-reviewer` returns PASS (plus `security-auditor` on ✔ steps). Fix the root cause. Never weaken tests or checks. At most 3 fix rounds, then pause with notes.
5. **End of step.**
   - **MANUAL:** update PROGRESS notes, report (changes, commands and results, assumptions, TODOs, proposed commit message), then **STOP and wait for my review**. Don't commit.
   - **AUTO:** commit locally **only** via `node scripts/commit-step.mjs <ID> "<type(scope): subject>"`, then end your turn with a short report. The Stop hook (`.claude/hooks/auto-continue.mjs`) starts the next step or pauses at a gate. Never start the next step on your own, and never bypass a pause.
6. **Never:** run `git commit` directly, `git push`, switch, reset or rebase branches (`scripts/auto.mjs` manages the auto branch); run destructive commands (`prisma migrate reset`, `docker volume rm`, `rm -rf` outside build folders); mark a step `[x]`/`[-]` by hand; edit `scripts/*.mjs`, `scripts/lib/**`, `.claude/**` or `docs/AUTOMATION.md` unless I ask.
7. Keep changes minimal and focused. No drive-by refactors. If you see a problem outside scope, note it in the report.

## Commands

```bash
docker compose up -d                       # postgres, redis, seaweedfs (S3), mailpit
pnpm install
pnpm dev                                   # api (4000) + worker + web (3000) via turbo
pnpm build | pnpm lint | pnpm typecheck | pnpm test
pnpm --filter api test:e2e                 # API e2e against the test database
pnpm --filter api db:migrate               # prisma migrate dev
pnpm --filter api db:generate              # prisma generate
pnpm --filter api db:seed                  # roles, permissions, admin, categories, placements, plans, settings
pnpm --filter api db:studio
pnpm --filter web test | pnpm --filter web e2e
pnpm --filter @newsroom/contracts build

node scripts/verify.mjs --step P05 [--full|--quick]   # quality gate → .claude/state/last-verify.json
node scripts/commit-step.mjs P05 "feat(web): …"       # AUTO: the only way to commit (human adds --manual)
node scripts/auto.mjs on|off|stop|status|skip         # auto-mode control
node scripts/auto-run.mjs --until P14                 # headless auto mode, fresh session per step
```
Slash commands: `/run-step [ID]` · `/auto [--until ID]` · `/auto-stop` · `/verify [ID]` · `/next-step` · `/review` · `/new-module` · `/fix`
Local URLs: web http://localhost:3000 · API http://localhost:4000/api/v1 · Swagger http://localhost:4000/api/docs · Mailpit http://localhost:8025 · S3 http://localhost:8333

## Non-negotiable architecture rules

- **Layering:** Controller → Service → Repository. Controllers are thin (validate, authorize, one service call, map response). Business rules live in services/policies. **Only repositories import the Prisma client.**
- **Contracts:** every request/response shape is a Zod schema in `packages/contracts` and is imported by both apps. Never duplicate a type by hand.
- **Security defaults:** every endpoint is authenticated unless `@Public()`; every authenticated endpoint has `@RequirePermissions(...)` (or is explicitly "any logged-in user"); ownership/state checks go in `policies/`.
- **State machines:** `Article.status` changes only via `WorkflowService.transition()`; campaign status only via `CampaignLifecycleService`; subscription/payment status only via billing webhook handlers. (ARCHITECTURE §8, §14, §15)
- **External services behind ports:** storage, mail, AI, payments are injected interfaces (`STORAGE_PORT`, `MAIL_PORT`, `AI_PROVIDER`, `PAYMENT_GATEWAYS`). No SDK imports in business modules.
- **Side-effects via events:** services emit domain events; notifications, revalidation, audit, search react in listeners. Slow work goes to BullMQ jobs.
- **Data integrity:** `@Transactional()` for multi-row writes; optimistic locking (`version`) on articles; money is `Decimal` (never `number` math on money — use `Prisma.Decimal`/decimal.js); idempotency keys for payments.
- **Module boundaries:** a module may use another module's exported service, never its repository. Resolve cycles with events.
- **Config:** read env only through the typed config service; new variables go into `apps/api/src/config/env.schema.ts` **and** `apps/api/.env.example` (web: `apps/web/.env.example`).

## Code conventions

- TypeScript `strict`; no `any`, no `@ts-ignore` (use `unknown` + narrowing; `@ts-expect-error` only with a comment).
- Files kebab-case (`article-content.service.ts`); classes PascalCase; one class per file; barrel `index.ts` only at package/module public API.
- Names: services are use-case oriented (`submitArticle`, not `updateStatus`). Booleans `is/has/can`. Dates end with `At`.
- Errors: throw `DomainError` subclasses with an `ErrorCode`; never throw raw `Error` or Nest `HttpException` from services.
- Logging: inject the logger; log events, not noise; never log secrets, tokens, passwords, full card/payment payloads or PII.
- Comments explain *why*, not *what*. Public service methods get a one-line JSDoc.
- Formatting by Prettier; lint must pass with zero warnings.

## Database rules

- Schema changes: edit `schema.prisma` → `pnpm --filter api db:migrate --name <change>` → commit the migration. Never edit an applied migration.
- Raw SQL only via tagged-template `$queryRaw`/`$executeRaw` inside repositories (search, row locks, counters). Never `$queryRawUnsafe` with user input.
- Respect soft delete (`deletedAt`) in every read; add indexes for every new FK and every new filter/sort used by list endpoints.
- `articles."searchVector"` is trigger-maintained — never write it from code.

## Testing rules

- Unit tests for every service method (happy path + each failure branch) and every policy/transition rule.
- API e2e for every endpoint: 401 unauthenticated, 403 missing permission, 400 validation, success. Use factories in `apps/api/test/factories`.
- Bug fix = failing test first, then fix.
- Web: test hooks/utilities and complex components; Playwright for the journeys in REQUIREMENTS §6.

## Git conventions

- MANUAL: a branch per step, e.g. `feat/m06-workflow-transitions`. AUTO: one `auto/run-*` branch with one commit per step (a `Step: Pxx` trailer added by commit-step). Never commit on `main`.
- Conventional Commits with module scope: `feat(workflow): add request-changes transition (WF-05)`.
- Reference requirement IDs in commit bodies and PR descriptions.

## Definition of Done (per step)

- [ ] Acceptance criteria of the referenced requirement IDs met (reviewer's REQUIREMENTS COVERAGE all "met")
- [ ] `node scripts/verify.mjs --step <ID>` PASSED on the final tree (lint, typecheck, unit, build, e2e, step checks)
- [ ] code-reviewer PASS (+ security-auditor PASS on ✔ steps)
- [ ] No new `TODO` without a matching note in `docs/PROGRESS.md`
- [ ] API_SPEC / ARCHITECTURE / `.env.example` updated if behaviour or config changed
- [ ] PROGRESS notes + session log updated. MANUAL: report, then STOP. AUTO: commit-step, then end the turn.
