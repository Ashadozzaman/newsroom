# Automation — Auto Mode & Agent Team

This document explains how Claude Code builds the platform on its own, one step after another. Each step is tested before the next one starts. Seven specialised subagents do the work.
Section numbers (§) are referenced from `CLAUDE.md` and `.claude/commands/run-step.md`.

---

## §1 Modes

| Mode | Start | What happens after a step | Best for |
|------|-------|---------------------------|----------|
| **MANUAL** (default) | `/run-step` (or paste a prompt from PROMPTS.md) | agents → verify → review → report → **stops**. You review and commit (`node scripts/commit-step.mjs P05 "…" --manual`) | first steps, risky steps, learning the codebase |
| **AUTO, in-session** | `/auto` (optionally `--until P14`) | agents → verify → review → **commits locally** → the Stop hook starts the next step | watching progress in VS Code |
| **AUTO, headless** | `node scripts/auto-run.mjs --until P14` | the same, but each step runs in a **fresh** `claude -p` session, and the runner re-runs verify independently before continuing | long unattended runs (overnight) |

Auto mode never pushes, never merges, and never touches `main`. It works on an `auto/run-*` branch with **one commit per step** (each with a `Step: Pxx` trailer). You review the branch at each phase gate and merge it yourself.

---

## §2 The agent team (`.claude/agents/`)

| Agent | Role | Owns (may edit) | Model | Tools |
|-------|------|-----------------|-------|-------|
| `planner` | Turns the step prompt into a file-level plan: work packages per agent, deps, migrations, env, contracts, tests, automatable checks | nothing (read-only) | inherit | Read, Grep, Glob, Web |
| `backend-dev` | NestJS / Prisma / BullMQ / contracts / infra | `apps/api/**`, `packages/**`, root config, `docker/**` | inherit | full |
| `frontend-dev` | Next.js / React / Tailwind / shadcn | `apps/web/**` | inherit | full |
| `test-runner` | Missing unit/e2e/Playwright tests, `scripts/checks/<ID>.mjs`, runs verify, names root causes | test files, `scripts/checks/**` | sonnet | full |
| `code-reviewer` | Independent review against CLAUDE.md, ARCHITECTURE, requirements → PASS/FAIL | nothing (read-only) | inherit | Read, Grep, Glob, Bash |
| `security-auditor` | OWASP-style audit on flagged steps → PASS/FAIL | nothing (read-only) | inherit | Read, Grep, Glob, Bash |
| `docs-keeper` | PROGRESS notes, API_SPEC/ARCHITECTURE sync, DECISIONS, README | `docs/**` (except AUTOMATION/PROMPTS), README | sonnet | full |

The **main session is the orchestrator**. It installs dependencies, routes fixes, runs the gates and owns git. Subagents never commit, never switch branches, and never spawn other agents.
To save usage, change `model:` in an agent file (e.g. `sonnet` or `haiku` for test-runner/docs-keeper, `sonnet` for the implementers).

---

## §3 What one step does (`.claude/commands/run-step.md`)

```
 preflight ─► planner ─► install deps ─► implement ─► test-runner ─► reviewer (∥ auditor)
                                          (be → fe)        │                  │
                                                           ▼                  ▼
                                                  ┌──── fix loop (≤ 3 rounds) ────┐
                                                  └──► docs-keeper ─► FINAL VERIFY ─► commit-step (AUTO) ─► report ─► Stop hook
```

1. **Preflight:** confirm the step is next, check gates and decisions, resume a half-done step (`[~]`), start docker.
2. **Plan** (`planner`). In AUTO, blocking questions get the documented default. If no default exists, the step pauses.
3. **Dependencies:** the orchestrator installs them once, so only one agent touches the lockfile.
4. **Implement:** contracts and API first, then web. Agents run in parallel (`∥`) only when their files don't overlap.
5. **Test** (`test-runner`): adds missing tests, encodes "Done when" into `scripts/checks/<ID>.mjs`, runs verify.
6. **Review** (`code-reviewer`, plus `security-auditor` on flagged steps). Both get fresh eyes: they never see the implementers' reasoning.
7. **Fix loop:** verify failures, blockers and high/critical findings go back to their owners. At most `maxFixRounds` rounds.
8. **Docs** (`docs-keeper`).
9. **Final verify** on the exact final tree.
10. **Commit** via `scripts/commit-step.mjs` (AUTO only). The script refuses unless the last passing verification matches the current files.
11. **Report** and end the turn. In AUTO, the Stop hook decides what happens next.

---

## §4 Step → pipeline

Notation: `pl` planner · `be` backend-dev · `fe` frontend-dev · `qa` test-runner · `cr` code-reviewer · `sec` security-auditor · `doc` docs-keeper · `→` sequential · `∥` parallel.
**Full-stack** = `pl → be → (fe ∥ qa:api) → qa:web → cr [∥ sec] → doc`.

| Step | Title | Pipeline | Security audit | Gate |
|------|-------|----------|:--:|------|
| P00 | Monorepo bootstrap | pl → be (root, packages, api) → fe (web scaffold) → qa → cr → doc | – | – |
| P01 | API platform core | pl → be → qa → cr → doc | – | – |
| P02 | Database & seed | pl → be → qa → cr → doc | – | – |
| P03 | Authentication API | pl → be → qa → cr ∥ sec → doc | ✔ | – |
| P04 | RBAC & users API | pl → be → qa → cr ∥ sec → doc | ✔ | – |
| P05 | Web foundation & auth UI | pl → fe → qa → cr ∥ sec → doc | ✔ (proxy, refresh, CSRF) | – |
| P06 | Taxonomy & media API | pl → be → qa → cr ∥ sec → doc | ✔ (uploads) | – |
| P07 | Taxonomy & media UI | pl → fe → qa → cr → doc | – | – |
| P08 | Articles API | pl → be → qa → cr ∥ sec → doc | ✔ (sanitiser, XSS) | – |
| P09 | Article editor UI | pl → fe → qa → cr → doc | – | – |
| P10 | Editorial workflow API | pl → be → qa → cr ∥ sec → doc | ✔ (transition authz, races) | – |
| P11 | Editorial UI | pl → fe → qa → cr → doc | – | – |
| P12 | Notifications & email | full-stack | – | – |
| P13 | Public site pages | full-stack | ✔ (paywall leakage) | – |
| P14 | SEO, feeds, views | full-stack | – | **pause after** (Phase 1 demo) |
| P15 | AI review API | pl → be → qa → cr ∥ sec → doc | ✔ (prompt injection, budget) | – |
| P16 | AI review UI | pl → fe → qa → cr → doc | – | – |
| P17 | Engagement | full-stack | ✔ (user content, moderation) | – |
| P18 | Search | full-stack | ✔ (raw SQL) | – |
| P19 | Dashboards | full-stack | – | **pause after** (Phase 2 demo) |
| P20 | Payments core | pl → be → qa → cr ∥ sec → doc | ✔ | **needs ADR-015** (gateway) |
| P21 | Subscriptions & paywall | full-stack | ✔ | – |
| P22 | Advertising API | pl → be → qa → cr ∥ sec → doc | ✔ (tokens, open redirect, spend) | – |
| P23 | Advertising UI | pl → fe → qa → cr ∥ sec → doc | ✔ (sandboxed creatives) | **pause after** (Phase 3 demo) |
| P24 | Admin & settings | full-stack | ✔ | – |
| P25 | Reports | full-stack | – | – |
| P26 | Contributor payouts | full-stack | ✔ | **needs ADR-016**; auto-skipped if "no" |
| P27 | Hardening & E2E | pl → sec (audit report) → (be ∥ fe) fixes → qa → cr → doc | ✔ (leads) | – |
| P28 | Deployment & CI/CD | pl → be → qa → cr ∥ sec → doc | ✔ | **needs ADR-017** (hosting) |

Gates are configured in `.claude/auto.config.json` (`pauseAfter`, `confirmBefore`). Edit that file to change them.

---

## §5 Quality gate — `scripts/verify.mjs`

`node scripts/verify.mjs --step P05 [--full | --quick]` runs these checks in order:

| Check | Runs | Notes |
|-------|------|-------|
| lint | `pnpm run lint` | zero warnings policy comes from the ESLint config |
| typecheck | `pnpm run typecheck` | |
| unit tests | `pnpm run test` | |
| build | `pnpm run build` | skipped with `--quick` |
| docker services | `docker compose up -d --wait` | only when e2e needs it |
| api e2e | `pnpm --filter ./apps/api run test:e2e` | once the script exists |
| web e2e | `pnpm --filter ./apps/web run e2e` | only with `--full` (or `verify.webE2e: true`) |
| step checks | `node scripts/checks/<STEP>.mjs` | the step's "Done when" list, automated |
| tree unchanged | fingerprint before vs after | fails if the checks modified tracked files |

The result goes to `.claude/state/last-verify.json`, together with a **fingerprint** of the working tree (HEAD + diff + untracked files).
`scripts/commit-step.mjs` commits only when that verification **passed**, was for **this step**, was not `--quick`, and its fingerprint **equals the current tree**. If any file changes after verifying, you have to verify again.
The Stop hook additionally checks that the verification ran on the commit's parent. The headless runner re-runs verify on its own.

---

## §6 When auto mode pauses

Auto mode continues only when **all** of these are true after a turn:

1. A new step was committed by `commit-step.mjs` (or skipped by `auto.mjs skip`) during the turn.
2. A passing verification is on record for that step, and it ran on the commit's parent.
3. HEAD carries the matching `Step:` trailer and the working tree is clean.
4. There is a next step, and it isn't blocked by a TBD decision (`confirmBefore`).
5. The finished step isn't in `pauseAfter`, and isn't the `--until` step.
6. Fewer than `maxStepsPerSession` steps (default 4) have run in this session. This keeps context and quality high: after the limit, start a fresh session and run `/auto`.
7. No STOP was requested (`node scripts/auto.mjs stop`).

Otherwise, Claude stops and you see a one-line "Auto mode paused: …" message with the reason.
Turns that end without completing a step never trigger a continuation, so loops are impossible. Every continuation requires a new verified commit.

---

## §7 Commits & branches

- `node scripts/auto.mjs on` creates `auto/run-<timestamp>` if you are on `main`/`master` (it refuses if `main` has uncommitted changes).
- Each step produces exactly one commit: a Conventional Commit subject (from PROMPTS.md), a `Step: Pxx` trailer and a `Verified:` trailer. `commit-step.mjs` also ticks the step `[x]` in PROGRESS.
- Husky/commitlint/lint-staged hooks still run. If they reject the commit, the script restores PROGRESS and nothing is committed.
- Direct `git commit`, `git push`, `git switch`, `git checkout`, `git reset --hard` and `git clean` are denied in `.claude/settings.json`.
- **Your review:** at each pause, run `git log --oneline main..HEAD`. Review commit by commit (`git show <sha>`), revert a single step with `git revert <sha>` if needed, then merge or open a PR yourself.

---

## §8 Decisions in auto mode

- **[CONFIRM] items with a documented default** (REQUIREMENTS, OPEN_QUESTIONS "Default" column): use the default. Log it in PROGRESS "Auto-assumed decisions" and in DECISIONS.md as "auto-assumed — confirm with client".
- **No documented default:** the step pauses with the question written in its Notes.
- **Irreversible or client-owned decisions** (payment gateway, payouts scope, hosting) are hard gates in `confirmBefore`. Replace `TBD` in `docs/DECISIONS.md` to unblock them.
- If ADR-016 says payouts are out of scope, the orchestrator runs `node scripts/auto.mjs skip P26 "<reason>"`.

---

## §9 Fix-loop policy

- At most `maxFixRounds` (default 3) rounds per step. Each round: route failures to their owners → verify → re-review the fixed items.
- Each fix must address the root cause. Weakening a test, adding `.skip`, loosening lint rules or disabling checks is a blocker for the reviewer.
- After the last failed round, the step stays `[~]` with a failure summary in Notes and an Open TODO. Nothing is committed, and auto mode pauses.
- To resume: fix it manually or give Claude guidance, then run `/run-step` (it resumes the `[~]` step) or `/auto`.

---

## §10 Setup & daily use

**One-time**

1. `git init && git add . && git commit -m "docs: project kit"` (auto mode needs at least one commit).
2. Docker Desktop running → `docker compose up -d`.
3. Claude Code with hooks support (`claude update`). Check the hooks are loaded: run `/hooks` and confirm you see `SessionStart` and `Stop`.
4. Open the repo root in VS Code → Claude Code → set the **permission mode to Auto** (mode indicator below the prompt box). Project settings can't select Auto for you. On the CLI: `claude --permission-mode auto`.

**In-session auto mode**

```text
/auto --until P05          # build P00…P05 back to back, then pause
/auto                      # continue until the next gate (P14 by default)
/auto-stop                 # turn it off (when Claude is idle)
```
From another terminal: `node scripts/auto.mjs stop` (pauses after the current step) · `node scripts/auto.mjs status`.

**Headless (fresh context per step, best for long runs)**

```bash
node scripts/auto-run.mjs --until P14 --max-steps 15
node scripts/auto-run.mjs --until P14 --budget-usd 20   # per-step spend cap (API billing only)
node scripts/auto-run.mjs --dry-run                     # print the command it would run
```
Requirements: the `claude` CLI on PATH, logged in, and Claude Code v2.1.259+ (for `--permission-prompts none`). Each step runs as `claude -p "/run-step Pxx" --permission-mode auto --permission-prompts none --output-format json`. Logs go to `.claude/state/runs/`.

**Manual mode, with agents** — `/run-step` runs the same pipeline but stops before committing. Commit yourself:
`node scripts/commit-step.mjs P05 "feat(web): …" --manual`.

---

## §11 Usage, cost & limits

- One step uses 4–7 subagent runs. Each has its own context, so the main session stays small, but total usage is several times higher than a single session.
- On a Claude **Pro** plan you will likely hit usage limits partway through a phase. When that happens the run stops, and the step stays `[~]`. Resume later with `/auto` or the runner; preflight continues the half-done step.
- To reduce usage:
  - set `model: sonnet` on backend-dev/frontend-dev;
  - set `model: haiku` on docs-keeper;
  - lower `maxStepsPerSession`;
  - run the security-auditor only on ✔ steps (the default).
- Auto permission mode uses a classifier that blocks risky commands. Production deploys and migrations, force pushes and mass deletion are blocked by default. If it blocks something the step really needs, the step pauses. Run that command yourself, then `/auto`.

---

## §12 Optional: agent teams (experimental)

Claude Code's **agent teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) let teammates message each other directly and share a task list. They are not used by default, for three reasons: they are experimental, they use significantly more tokens, and split panes don't work in VS Code's integrated terminal.
One place they help is the **P27 hardening audit**. Ask: *"Spawn three teammates using the security-auditor, code-reviewer and test-runner agent types to audit apps/api and apps/web in parallel and challenge each other's findings."* Turn the variable off again afterwards.

---

## §13 Troubleshooting

| Symptom | Fix |
|---------|-----|
| Auto mode never continues | Run `/hooks` and check that `Stop` → `auto-continue.mjs` is listed. Check `node scripts/auto.mjs status` shows `mode: auto`. Make sure Node is on PATH for the IDE. |
| "Files changed after the last verification" | Something edited files after verify (often docs). Run `node scripts/verify.mjs --step Pxx` again, then commit. |
| "tree unchanged by checks" fails | A build or test writes a tracked file (e.g. `next-env.d.ts`, snapshots). Commit it once, or git-ignore it. |
| e2e fail: Docker not running | Start Docker Desktop, then `docker compose up -d --wait`. |
| commitlint rejects the commit | Use an allowed scope (see `commitlint.config` from P00) and rerun commit-step. |
| Step stuck at `[~]` after limits/interruption | Run `/run-step`. Preflight resumes from the current diff. |
| Want to redo the latest step | `git revert <sha>`. This also reverts its PROGRESS tick back to `[ ]`, because the tick was part of the step commit. Then `/run-step Pxx`. |
| Pause before P20/P26/P28 | Record the decision in `docs/DECISIONS.md` (replace `TBD`), commit, then `/auto`. |
