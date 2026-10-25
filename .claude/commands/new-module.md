---
description: Scaffold a NestJS business module following ARCHITECTURE §4.2 (usage - /new-module <name> <requirement-id>)
---

Scaffold the API module described by: $ARGUMENTS

1. Read `apps/api/CLAUDE.md`, `docs/ARCHITECTURE.md §4.2 and §5`, and the module's rows in `docs/API_SPEC.md` and `docs/REQUIREMENTS.md`.
2. Create `apps/api/src/modules/<name>/` with: `<name>.module.ts`, `controllers/`, `services/`, `repositories/`, `policies/`, `mappers/`, `events/`, `__tests__/` — and `<Name>WorkerModule` only if the module has jobs.
3. Create matching Zod schemas in `packages/contracts/src/<name>/` and export them from the package index.
4. Wire the module into `AppModule` (and `WorkerModule` if needed). Add error codes with the module prefix.
5. Add empty-but-compiling controller routes ONLY for endpoints listed in API_SPEC for this module, each with its permission decorator and schema, returning `NotImplemented` — so routes, guards and validation can be e2e-tested immediately.
6. Add one smoke e2e test per route (401 without auth, 403 without permission).
7. Stop and report (files, commands run, next suggested step). Do not implement business logic yet.
