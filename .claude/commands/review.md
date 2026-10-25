---
description: Self-review the current changes against CLAUDE.md and the Definition of Done before I commit
---

Review the uncommitted changes (`git status`, `git diff`) for the current step: $ARGUMENTS

Check and report pass/fail with file:line evidence for each:

1. Layering — controllers thin; business logic in services/policies; Prisma only in repositories.
2. Contracts — all request/response shapes come from `@newsroom/contracts`; no hand-written duplicate types.
3. Security — `@Public()`/`@RequirePermissions` on every route; policy checks for ownership/state; inputs validated; no secrets or PII in logs; audit on privileged actions.
4. State machines — no direct writes to `status` outside the lifecycle services.
5. Data — transactions where multiple rows change; indexes for new FKs/filters; soft delete respected; Decimal for money.
6. Tests — unit tests for new service/policy branches; e2e covers 401/403/400/success for new endpoints.
7. Docs — API_SPEC / ARCHITECTURE / `.env.example` / PROGRESS updated where behaviour changed.
8. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` (scoped with `--filter` if appropriate) and report results.

Finish with a list of issues found (severity: blocker / should-fix / nit) and a proposed Conventional Commit message. Fix nothing unless I ask.
