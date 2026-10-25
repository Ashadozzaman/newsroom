#!/usr/bin/env node
// Claude Code SessionStart hook: adds a short, factual automation status to Claude's context
// at startup, resume, /clear and after compaction (so auto mode survives context compaction).
import fs from 'node:fs';
import { PATHS, currentBranch, readJson, readProgress, readState } from '../../scripts/lib/auto-lib.mjs';

try {
  try {
    fs.readFileSync(0, 'utf8');
  } catch {
    /* no stdin */
  }
  if (!fs.existsSync(PATHS.progress)) process.exit(0);
  const p = readProgress();
  const s = readState();
  const v = readJson(PATHS.verify, null);
  const lines = [
    `Project automation status: mode=${s.mode}${s.mode === 'auto' && s.until ? ` (until ${s.until})` : ''}, branch=${currentBranch() ?? 'n/a'}.`,
    `Playbook progress: ${p.doneCount}/${p.steps.length} steps done; next step ${p.next ? `${p.next.id} — ${p.next.title} [${p.next.status}]` : 'none'}.`,
  ];
  if (v) lines.push(`Last verification: ${v.ok ? 'passed' : 'failed'} for ${v.step ?? 'no step'} (${v.mode}) at ${v.at}.`);
  if (s.mode === 'auto') {
    lines.push('Auto mode follows docs/AUTOMATION.md; each step runs through .claude/commands/run-step.md and ends with scripts/commit-step.mjs.');
  }
  if (process.env.NEWSROOM_AUTO_RUNNER) lines.push('This session was started by scripts/auto-run.mjs and runs exactly one step.');
  process.stdout.write(`${lines.join('\n')}\n`);
} catch {
  /* never block a session start */
}
process.exit(0);
