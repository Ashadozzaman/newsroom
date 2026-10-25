#!/usr/bin/env node
// Auto-mode control.
//   node scripts/auto.mjs on [--until P14] [--max-steps 4] [--branch auto/my-run]
//   node scripts/auto.mjs off                      turn auto mode off now
//   node scripts/auto.mjs stop                     stop gracefully after the current step
//   node scripts/auto.mjs status
//   node scripts/auto.mjs skip <STEP> "<reason>"   mark an out-of-scope step [-] and commit that
import fs from 'node:fs';
import {
  PATHS,
  STEP_ID,
  currentBranch,
  decisionStatus,
  die,
  gateBefore,
  git,
  hasCommits,
  isClean,
  isGitRepo,
  parseArgs,
  readConfig,
  readJson,
  readProgress,
  readState,
  updateStepRow,
  writeState,
} from './lib/auto-lib.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2), ['manual']);
const [cmd, ...rest] = positional;
const cfg = readConfig();

function status() {
  const s = readState();
  const p = readProgress();
  const v = readJson(PATHS.verify, null);
  console.log(`mode:        ${s.mode}${s.mode === 'auto' && s.until ? ` (until ${s.until})` : ''}`);
  console.log(`branch:      ${currentBranch() ?? 'n/a'}`);
  console.log(`progress:    ${p.doneCount}/${p.steps.length} steps done`);
  console.log(`next step:   ${p.next ? `${p.next.id} — ${p.next.title} [${p.next.status}]` : 'none (all done)'}`);
  if (v) console.log(`last verify: ${v.ok ? 'PASSED' : 'FAILED'} for ${v.step ?? '-'} (${v.mode}) at ${v.at}`);
  if (s.lastCommitted) console.log(`last commit: ${s.lastCommitted.step} ${String(s.lastCommitted.sha).slice(0, 10)}`);
  const ahead = p.steps.filter((x) => x.status !== 'x' && x.status !== '-').map((x) => x.id);
  const pauses = cfg.pauseAfter.filter((id) => ahead.includes(id));
  const decisions = Object.entries(cfg.confirmBefore)
    .filter(([id]) => ahead.includes(id))
    .map(([id, adr]) => `${id}←ADR-${adr}${decisionStatus(adr).unresolved ? ' (TBD)' : ' (decided)'}`);
  console.log(`gates ahead: pause after ${pauses.join(', ') || '—'}; decisions ${decisions.join(', ') || '—'}`);
  if (fs.existsSync(PATHS.stop)) console.log('STOP requested: auto mode will pause after the current step.');
}

switch (cmd) {
  case 'on': {
    if (!isGitRepo() || !hasCommits()) die('Initialise git and make the first commit first (see START_HERE.md).');
    const p = readProgress();
    if (!p.next) {
      writeState({ ...readState(), mode: 'manual' });
      console.log('All steps are done — nothing to automate.');
      break;
    }
    if (flags.until !== undefined && !STEP_ID.test(String(flags.until))) die(`--until must be a step id like P14 (got ${flags.until})`);
    const gate = gateBefore(p.next.id, cfg);
    if (gate) {
      status();
      die(`BLOCKED: ${gate}. Record the decision, then run /auto again.`, 3);
    }
    let branch = currentBranch();
    if (cfg.protectedBranches.includes(branch)) {
      if (!isClean()) die(`You are on "${branch}" with uncommitted changes. Commit or stash them, then run again.`);
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
      const name = typeof flags.branch === 'string' ? flags.branch : `${cfg.branchPrefix}${stamp}`;
      const r = git('switch', '-c', name);
      if (r.code !== 0) die(`Could not create branch ${name}:\n${r.stderr}`);
      branch = name;
      console.log(`Created and switched to branch ${branch}`);
    }
    fs.rmSync(PATHS.stop, { force: true });
    const prev = readState();
    writeState({
      ...prev,
      mode: 'auto',
      since: new Date().toISOString(),
      until: flags.until ?? null,
      maxStepsPerSession: Number(flags['max-steps'] ?? cfg.maxStepsPerSession),
      lastSeenDone: p.doneCount,
      branch,
      session: null,
    });
    console.log('Auto mode ON.');
    status();
    break;
  }
  case 'off': {
    writeState({ ...readState(), mode: 'manual' });
    fs.rmSync(PATHS.stop, { force: true });
    console.log('Auto mode OFF. Nothing was reverted.');
    break;
  }
  case 'stop': {
    fs.mkdirSync(PATHS.stateDir, { recursive: true });
    fs.writeFileSync(PATHS.stop, new Date().toISOString());
    console.log('STOP requested: auto mode pauses when the current step ends (nothing is interrupted or reverted).');
    break;
  }
  case 'status':
  case undefined: {
    status();
    break;
  }
  case 'skip': {
    const [step, ...reasonParts] = rest;
    const reason = reasonParts.join(' ').trim();
    if (!step || !STEP_ID.test(step) || !reason) die('usage: node scripts/auto.mjs skip <STEP> "<reason>"');
    const p = readProgress();
    if (p.next?.id !== step) die(`Only the next step can be skipped (next is ${p.next?.id ?? 'none'}).`);
    const branch = currentBranch();
    if (cfg.protectedBranches.includes(branch) && !flags.manual) die(`Refusing to commit on protected branch "${branch}".`);
    const original = p.text;
    updateStepRow(step, { status: '-', notes: `Skipped: ${reason}` });
    const r = git('commit', '-m', `chore(repo): skip step ${step}`, '-m', reason, '-m', `Step: ${step} (skipped)`, '--', 'docs/PROGRESS.md');
    if (r.code !== 0) {
      fs.writeFileSync(PATHS.progress, original);
      die(`git commit failed:\n${r.stdout}\n${r.stderr}`);
    }
    console.log(`Skipped ${step}: ${reason}`);
    status();
    break;
  }
  default:
    die(`unknown command "${cmd}". Use: on | off | stop | status | skip`);
}
