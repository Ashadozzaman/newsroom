#!/usr/bin/env node
// Claude Code Stop hook — drives AUTO mode.
// When Claude ends a turn, this decides whether to send it on to the next playbook step.
// It continues ONLY when a new step was committed by scripts/commit-step.mjs since the last
// check, the verification on record passed for that step on the commit's parent, the tree is
// clean, and no gate applies. Otherwise Claude stops normally (no loops: progress is required).
import fs from 'node:fs';
import {
  PATHS,
  gateAfter,
  gateBefore,
  gitOut,
  headMessage,
  isClean,
  readConfig,
  readJson,
  readProgress,
  readState,
  stepTrailerMatches,
  writeState,
} from '../../scripts/lib/auto-lib.mjs';

function respond(obj) {
  if (obj) process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  input = {};
}

try {
  // The headless runner (scripts/auto-run.mjs) drives steps itself: one step per session.
  if (process.env.NEWSROOM_AUTO_RUNNER) respond(null);

  const state = readState();
  if (state.mode !== 'auto') respond(null);

  const cfg = readConfig();
  const p = readProgress();
  const pause = (reason, { turnOff = true } = {}) => {
    writeState({ ...state, mode: turnOff ? 'manual' : 'auto' });
    respond({ systemMessage: `Auto mode paused: ${reason}` });
  };

  if (fs.existsSync(PATHS.stop)) {
    fs.rmSync(PATHS.stop, { force: true });
    pause('STOP was requested. Run /auto to resume.');
  }

  // No new step committed during this turn (question asked, step failed, or agents still running).
  if (p.doneCount <= (state.lastSeenDone ?? 0)) {
    respond({
      systemMessage:
        `Auto mode: this turn ended without completing ${p.next?.id ?? 'a step'} ` +
        `(status [${p.next?.status ?? '?'}]). It continues automatically once the step is committed; ` +
        'if the step is blocked, see docs/PROGRESS.md notes, fix it, then run /auto.',
    });
  }

  // A step was completed since the last check.
  const done = p.lastDone;
  const sessionId = input.session_id ?? 'unknown';
  const session = state.session?.id === sessionId ? state.session : { id: sessionId, steps: 0 };
  session.steps += 1;
  Object.assign(state, { lastSeenDone: p.doneCount, session });

  if (!done) pause('could not determine the completed step from docs/PROGRESS.md.');

  const problems = [];
  if (done.status === 'x') {
    const v = readJson(PATHS.verify, null);
    if (!v || !v.ok || v.step !== done.id) problems.push(`no passing verification recorded for ${done.id}`);
    else if (v.head && gitOut('rev-parse', 'HEAD~1') !== v.head) problems.push(`verification for ${done.id} did not run on the commit's parent`);
  }
  if (!stepTrailerMatches(headMessage(), done.id)) problems.push(`HEAD is not the "Step: ${done.id}" commit`);
  if (!isClean()) problems.push('the working tree has uncommitted changes');
  if (problems.length) pause(`after ${done.id}: ${problems.join('; ')}. Fix, then run /auto.`);

  if (!p.next) pause('every step in docs/PROGRESS.md is done. 🎉');

  const after = gateAfter(done.id, cfg, state);
  if (after) pause(`${after}. Run /auto to continue with ${p.next.id}.`);

  const before = gateBefore(p.next.id, cfg);
  if (before) pause(`${before}. Record it, then run /auto.`);

  const max = Number(state.maxStepsPerSession ?? cfg.maxStepsPerSession);
  if (session.steps >= max) {
    pause(
      `${session.steps} steps completed in this session (limit ${max}). Start a fresh session ` +
        `to keep context small, then run /auto to continue with ${p.next.id}.`,
    );
  }

  writeState(state);
  respond({
    decision: 'block',
    reason:
      `Auto mode is on. Step ${done.id} is ${done.status === '-' ? 'skipped (out of scope)' : 'verified'} and committed (${(gitOut('rev-parse', '--short', 'HEAD') ?? '').trim()}). ` +
      `The next step in docs/PROGRESS.md is ${p.next.id} — ${p.next.title}. ` +
      `Continue by running the run-step procedure (.claude/commands/run-step.md) for ${p.next.id}.`,
  });
} catch (error) {
  respond({ systemMessage: `auto-continue hook error (auto mode not advanced): ${error?.message ?? error}` });
}
