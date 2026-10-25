#!/usr/bin/env node
// Headless auto runner: runs playbook steps one after another, each in a FRESH Claude Code
// session (`claude -p`), and independently re-verifies every step before starting the next.
//
// Usage: node scripts/auto-run.mjs [--until P14] [--max-steps 10] [--budget-usd 15]
//                                  [--model <alias|id>] [--claude <path>] [--no-reverify] [--dry-run]
// Requires the `claude` CLI on PATH (Claude Code v2.1.259+ for --permission-prompts).
import path from 'node:path';
import fs from 'node:fs';
import {
  IS_WIN,
  PATHS,
  ROOT,
  STEP_ID,
  gateAfter,
  gateBefore,
  headMessage,
  isClean,
  parseArgs,
  readConfig,
  readProgress,
  readState,
  run,
  stepTrailerMatches,
  writeJson,
  writeState,
} from './lib/auto-lib.mjs';

const { flags } = parseArgs(process.argv.slice(2), ['no-reverify', 'dry-run']);
const cfg = readConfig();
const maxSteps = Number(flags['max-steps'] ?? 10);
const claudeBin = typeof flags.claude === 'string' ? flags.claude : 'claude';
const log = (m) => console.log(`[auto-run ${new Date().toLocaleTimeString()}] ${m}`);
if (flags.until !== undefined && !STEP_ID.test(String(flags.until))) {
  console.error('--until must be a step id like P14');
  process.exit(2);
}

const on = run(process.execPath, [path.join(ROOT, 'scripts', 'auto.mjs'), 'on', ...(flags.until ? ['--until', String(flags.until)] : [])], {
  stdio: 'inherit',
});
if (on.code !== 0) process.exit(on.code);

const summary = [];
let stopReason = `max steps (${maxSteps}) reached`;

for (let i = 0; i < maxSteps; i++) {
  const p = readProgress();
  if (!p.next) {
    stopReason = 'all steps done';
    break;
  }
  const step = p.next.id;
  const blocked = gateBefore(step, cfg);
  if (blocked) {
    stopReason = blocked;
    break;
  }
  if (fs.existsSync(PATHS.stop)) {
    fs.rmSync(PATHS.stop, { force: true });
    stopReason = 'STOP requested';
    break;
  }

  const args = ['-p', `/run-step ${step}`, '--permission-mode', 'auto', '--permission-prompts', 'none', '--output-format', 'json', '--name', `newsroom-${step}`];
  if (flags['budget-usd']) args.push('--max-budget-usd', String(flags['budget-usd']));
  if (typeof flags.model === 'string') args.push('--model', flags.model);
  if (flags['dry-run']) {
    log(`dry run — would execute: ${claudeBin} ${args.join(' ')}`);
    stopReason = 'dry run';
    break;
  }

  log(`=== ${step} — ${p.next.title} === (fresh session)`);
  const started = Date.now();
  const res = run(claudeBin, args, { shell: IS_WIN, env: { NEWSROOM_AUTO_RUNNER: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  let out = null;
  try {
    out = JSON.parse(res.stdout);
  } catch {
    try {
      out = JSON.parse(res.stdout.trim().split(/\r?\n/).pop());
    } catch {
      out = null;
    }
  }
  writeJson(path.join(PATHS.runs, `${step}-${Date.now()}.json`), { step, exitCode: res.code, minutes, result: out, rawTail: out ? undefined : res.stdout.slice(-4000) });

  if (/ENOENT|not recognized|not found/i.test(res.stderr) && !out) {
    stopReason = `could not start "${claudeBin}" — install the Claude Code CLI or pass --claude <path>`;
    summary.push({ step, ok: false, minutes, cost: 'n/a' });
    break;
  }
  const row = readProgress().steps.find((s) => s.id === step);
  const problems = [];
  if (res.code !== 0 || out?.is_error) problems.push(`claude exited with code ${res.code}${out?.subtype ? ` (${out.subtype})` : ''}`);
  if (!row || (row.status !== 'x' && row.status !== '-')) problems.push(`${step} is not marked done in docs/PROGRESS.md (status [${row?.status ?? '?'}])`);
  if (!stepTrailerMatches(headMessage(), step)) problems.push(`HEAD is not the "Step: ${step}" commit`);
  if (!isClean()) problems.push('uncommitted changes were left behind');
  if (!problems.length && row.status === 'x' && !flags['no-reverify']) {
    log(`independent re-verification of ${step}…`);
    const rv = run(process.execPath, [path.join(ROOT, 'scripts', 'verify.mjs'), '--step', step], { stdio: 'inherit' });
    if (rv.code !== 0) problems.push('independent re-verification failed');
  }
  const cost = typeof out?.total_cost_usd === 'number' ? `$${out.total_cost_usd.toFixed(2)}` : 'n/a';
  summary.push({ step, ok: problems.length === 0, minutes, cost });

  if (problems.length) {
    stopReason = `${step}: ${problems.join('; ')}`;
    if (out?.result) log(`last message from Claude:\n${String(out.result).slice(-3000)}`);
    break;
  }
  log(`${step} done in ${minutes} min (est. cost ${cost}).`);
  const pause = gateAfter(step, cfg, readState());
  if (pause) {
    stopReason = pause;
    break;
  }
}

writeState({ ...readState(), mode: 'manual' });
console.log('\nauto-run summary');
for (const s of summary) console.log(`  ${s.ok ? 'OK  ' : 'FAIL'}  ${s.step}  ${s.minutes} min  ${s.cost}`);
console.log(`stopped: ${stopReason}`);
console.log('Auto mode is OFF. Review the commits (git log --oneline), then run again to continue.');
process.exit(summary.some((s) => !s.ok) ? 1 : 0);
