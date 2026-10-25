---
description: Run one playbook step end to end with the agent team (plan → implement → test → review → fix → docs → verify → commit in auto mode)
argument-hint: "[STEP-ID, e.g. P05 — defaults to the next step]"
---

# Run step $ARGUMENTS

You are the **orchestrator** (the main session). The subagents in `.claude/agents/` plan, implement, test, review and document. You coordinate them, install dependencies, route fixes, run the gates and own git. Follow `docs/AUTOMATION.md`. Keep your own context small: give agents precise briefs and keep only their reports.

**Run every subagent in the foreground and wait for it. Never end your turn while an agent is still running.** Spawn agents marked `∥` together in one message.

## 0 · Preflight
1. Run `node scripts/auto.mjs status` to get the mode (`auto` or `manual`). Read `CLAUDE.md`, `docs/AUTOMATION.md` §3–§9 and `docs/PROGRESS.md`.
2. The step is `$ARGUMENTS`, or the first PROGRESS step that isn't `[x]`/`[-]` if empty. It must be the next unfinished step. If it isn't, stop and explain.
3. Read the step block in `docs/PROMPTS.md` (from `### <ID>` to the next `###`) and the step's row in `docs/AUTOMATION.md §4`.
4. Gates:
   - If `.claude/auto.config.json` → `confirmBefore` lists this step and its ADR in `docs/DECISIONS.md` still says TBD: stop. In MANUAL, ask me. In AUTO, report and end the turn.
   - If DECISIONS.md says the step is out of scope: run `node scripts/auto.mjs skip <ID> "<reason>"`, report, end the turn.
5. Working tree (`git status`):
   - Clean → set the step's Status cell in PROGRESS to `[~]`.
   - Dirty and the row is already `[~]` → **resume**. Read the PROGRESS notes and `git diff HEAD --stat`, decide which stage to resume at, and say so.
   - Dirty for any other reason → stop and explain. Never discard work.
6. From P01 onward: `docker compose up -d --wait`.

## 1 · Plan — `planner`
Brief: step ID, the full step prompt, the AUTOMATION row, the mode. Read the returned plan critically:
- Parallel work packages must have disjoint files. If they don't, make them sequential.
- **Blocking questions:** in MANUAL, ask me (AskUserQuestion) and wait. In AUTO, use the documented default whenever one exists. If none exists, write the question into the row's Notes (status stays `[~]`), report, and end the turn.

## 2 · Dependencies — you
Install every dependency from the plan yourself before any parallel work: `pnpm --filter <workspace> add [-D] <pkg>@<range>`. During a step, only you touch `pnpm-lock.yaml`.

## 3 · Implement — `backend-dev` / `frontend-dev`
Follow the pipeline row. Each brief contains:
- the step ID and the exact step prompt;
- the agent's work package (files) and requirement IDs;
- the assumptions to use;
- the files it must NOT touch (the other agents' packages);
- the report format from its agent definition.

Contracts come first. In full-stack steps, backend-dev finishes and builds `packages/contracts` (and the API) before frontend-dev starts. Never run two agents that edit the same files at the same time. Don't use worktree isolation for implementation: a worktree branches from the default branch and won't see this step's uncommitted work.

## 4 · Test — `test-runner`
Brief: step ID, the "Done when" list, the plan's test list, the changed files (`git status`). It adds missing tests, writes `scripts/checks/<ID>.mjs`, and runs `node scripts/verify.mjs --step <ID>`. Tell it to add `--full` when the step changes apps/web and the web `e2e` script exists.

## 5 · Review — `code-reviewer`, plus `security-auditor` when the row says ✔ (in parallel)
Give them only: step ID, step prompt, requirement IDs. Don't pass them the implementers' reports; they review with fresh eyes.

## 6 · Fix loop — at most `maxFixRounds` rounds (`.claude/auto.config.json`, default 3)
- Collect: verify failures, reviewer BLOCKERS, auditor critical/high findings.
- Route each one to its owner agent with file:line and the expected fix. Run owners in parallel only if their files are disjoint.
- Rerun `node scripts/verify.mjs --step <ID>`. Re-review only the fixed items.
- SHOULD-FIX: fix if cheap and in scope. Otherwise log it as a TODO.
- Still failing after the last round: write a short failure summary into the row's Notes (status stays `[~]`) and add an Open TODO. Report, end the turn, and **do not commit**.

## 7 · Docs — `docs-keeper`
Brief: step ID, a summary of the final changes, the decisions and auto-assumed defaults used, the TODOs.

## 8 · Final gate — you
Run `node scripts/verify.mjs --step <ID>` (with `--full` if stage 4 used it) on the final tree, docs included. It must pass. If it fails, go back to stage 6.

## 9 · Finish
- **AUTO:** `node scripts/commit-step.mjs <ID> "<type(scope): subject>"`. Use the "Commit:" line from PROMPTS.md. Add `--body "<requirement IDs, notable decisions>"`. If it refuses because files changed after verify, rerun stage 8 and commit again.
- **MANUAL:** don't commit. In the report, give me the command: `node scripts/commit-step.mjs <ID> "<msg>" --manual`.

## 10 · Report (≤ 20 lines), then end your turn
Include: step and result; files touched (grouped); the verify table; reviewer/auditor verdicts; auto-assumed defaults; TODOs; anything I should look at first.
- **AUTO:** don't start the next step yourself. The Stop hook starts it, or pauses at a gate.
- **Headless runner** (`NEWSROOM_AUTO_RUNNER=1`): never wait for input; end after this one step.
