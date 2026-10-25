# Start here — Newsroom Platform kit

This folder is the seed of the repository. Drop it into an empty git repo. Claude Code then builds the project step by step: manually with review gates, or in **auto mode**, where each tested step is committed and the next one starts by itself.

## What's inside

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Root rules loaded every session: modes, workflow, architecture rules, conventions, DoD |
| `apps/api/CLAUDE.md` · `apps/web/CLAUDE.md` | App-specific patterns (NestJS 12 + Prisma 7 / Next.js 16) |
| `docs/REQUIREMENTS.md` | PRD: roles, fixed module list M00–M18, requirement IDs, NFRs, journeys, delivery plan |
| `docs/ARCHITECTURE.md` | System design: stack, layering, auth, RBAC, workflow state machine, AI, media, SEO, ads, payments, jobs, security, deployment, ADRs |
| `docs/API_SPEC.md` | Endpoint inventory with permissions |
| `apps/api/prisma/schema.prisma` | Full data model (56 models, Prisma 7, validated) + `prisma.config.ts` + `prisma/sql/` |
| `docs/PROMPTS.md` | 29 step work orders (P00–P28) + utility prompts |
| `docs/AUTOMATION.md` | **Auto mode & agent team**: modes, pipeline per step, quality gate, gates, commit policy, troubleshooting |
| `.claude/agents/` | 7 subagents: planner, backend-dev, frontend-dev, test-runner, code-reviewer, security-auditor, docs-keeper |
| `.claude/commands/` | `/run-step`, `/auto`, `/auto-stop`, `/verify`, `/next-step`, `/review`, `/new-module`, `/fix` |
| `.claude/hooks/` | `auto-continue.mjs` (Stop hook that moves to the next step) · `session-context.mjs` (status at session start) |
| `.claude/settings.json` · `.claude/auto.config.json` | Permissions + hook registration · auto-mode gates and limits |
| `scripts/verify.mjs` · `commit-step.mjs` · `auto.mjs` · `auto-run.mjs` | Quality gate · verified commits · auto-mode control · headless runner (Node, no dependencies, cross-platform) |
| `docs/PROGRESS.md` · `docs/DECISIONS.md` · `docs/OPEN_QUESTIONS.md` | Tracker · decision log (auto mode reads it) · interview/kickoff checklist |
| `docker-compose.yml` · `apps/*/.env.example` · `.gitignore` | Local infra (Postgres 17, Redis, SeaweedFS S3, Mailpit), env templates |

## First run

1. Kickoff call → fill `docs/OPEN_QUESTIONS.md`. Then update REQUIREMENTS (remove the `[CONFIRM]` tags) and `docs/DECISIONS.md` (replace `TBD` for ADR-015/016/017 when known).
2. `git init && git add . && git commit -m "docs: project kit"`
3. Start Docker, then `docker compose up -d`.
4. Open the repo in VS Code → Claude Code. Run `/hooks` and check that `SessionStart` and `Stop` are listed.
5. Pick one:
   - **Auto:** set the permission mode to **Auto** (mode indicator below the prompt) → `/auto --until P05` → watch it build P00–P05, then review `git log --oneline`.
   - **Manual:** `/run-step` → review → `node scripts/commit-step.mjs P00 "<message>" --manual` → repeat.
   - **Headless overnight:** `node scripts/auto-run.mjs --until P14`.
6. At each pause: review the branch, demo to the client, merge, then `/auto` to continue.
