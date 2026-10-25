#!/usr/bin/env node
// Commit a finished step — the ONLY way Claude commits in this repo.
// Refuses unless the last verification passed for this step on exactly the current files.
// Marks the step [x] in docs/PROGRESS.md and adds a "Step: <ID>" trailer to the commit.
//
// Usage: node scripts/commit-step.mjs <STEP> "<type(scope): subject>" [--body "text"] [--manual]
//   --manual   allow use while auto mode is off (for the human in manual mode)
import fs from 'node:fs';
import path from 'node:path';
import {
  PATHS,
  STEP_ID,
  currentBranch,
  die,
  fingerprint,
  git,
  headSha,
  parseArgs,
  readConfig,
  readJson,
  readProgress,
  readState,
  updateStepRow,
  writeState,
} from './lib/auto-lib.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2), ['manual']);
const [step, subject] = positional;

if (!step || !STEP_ID.test(step)) die('usage: node scripts/commit-step.mjs <STEP> "<type(scope): subject>" [--body "..."] [--manual]');
if (!subject || !/^[a-z]+(\([a-z0-9-]+\))?!?: \S.*/.test(subject)) {
  die(`commit subject must be a Conventional Commit, e.g. "feat(auth): add refresh rotation" (got: ${subject ?? 'nothing'})`);
}

const cfg = readConfig();
const state = readState();
if (state.mode !== 'auto' && !flags.manual) {
  die('Auto mode is off. In manual mode only the human commits (add --manual if you are the human).');
}

const branch = currentBranch();
if (!branch || branch === 'HEAD') die('Detached HEAD — switch to a branch first.');
if (cfg.protectedBranches.includes(branch)) die(`Refusing to commit on protected branch "${branch}". Use an auto/* or feature branch.`);

const v = readJson(PATHS.verify, null);
if (!v) die(`No verification recorded. Run: node scripts/verify.mjs --step ${step}`);
if (!v.ok) die(`The last verification FAILED. Fix the failures and run: node scripts/verify.mjs --step ${step}`);
if (v.step !== step) die(`The last verification was for step ${v.step ?? '(none)'}, not ${step}. Run: node scripts/verify.mjs --step ${step}`);
if (v.mode === 'quick') die('A --quick verification does not count. Run the standard (or --full) verification.');
if (v.fingerprint !== fingerprint()) die(`Files changed after the last verification. Run: node scripts/verify.mjs --step ${step}`);

const progress = readProgress();
const row = progress.steps.find((s) => s.id === step);
if (!row) die(`Step ${step} not found in docs/PROGRESS.md`);
if (row.status === 'x') die(`Step ${step} is already marked done.`);
if (progress.next?.id !== step) die(`Step ${step} is not the next step (next is ${progress.next?.id ?? 'none'}).`);

const originalProgress = progress.text;
updateStepRow(step, { status: 'x', branch });

const message = [
  subject,
  '',
  ...(flags.body && flags.body !== true ? [String(flags.body), ''] : []),
  `Step: ${step}`,
  `Verified: ${v.at} (scripts/verify.mjs ${v.mode})`,
].join('\n');
const msgFile = path.join(PATHS.stateDir, 'commit-message.txt');
fs.mkdirSync(PATHS.stateDir, { recursive: true });
fs.writeFileSync(msgFile, `${message}\n`);

const rollback = (why, output) => {
  fs.writeFileSync(PATHS.progress, originalProgress);
  git('reset', '-q');
  die(`${why}\n${output ?? ''}\nNothing was committed; docs/PROGRESS.md restored.`);
};

const add = git('add', '-A');
if (add.code !== 0) rollback('git add failed.', add.stderr);
const commit = git('commit', '-F', msgFile);
if (commit.code !== 0) rollback('git commit failed (commit hooks such as commitlint or lint-staged may have rejected it).', `${commit.stdout}\n${commit.stderr}`);

const sha = headSha();
writeState({ ...readState(), lastCommitted: { step, sha, at: new Date().toISOString() } });
const after = readProgress();
console.log(`✔ Committed ${step} on ${branch}: ${sha?.slice(0, 10)}  "${subject}"`);
console.log(`  Next step: ${after.next ? `${after.next.id} — ${after.next.title}` : 'none (all steps done)'}`);
