#!/usr/bin/env node
// Quality gate for one playbook step. The result is written to .claude/state/last-verify.json
// together with a fingerprint of the working tree; scripts/commit-step.mjs only commits a tree
// whose fingerprint matches a passing verification.
//
// Usage: node scripts/verify.mjs [P05] [--step P05] [--full] [--quick] [--no-docker]
//   --full       also run web Playwright e2e (apps/web "e2e" script)
//   --quick      lint + typecheck + unit only (does NOT count for commit-step)
//   --no-docker  do not try to start docker compose services
import fs from 'node:fs';
import path from 'node:path';
import {
  IS_WIN,
  PATHS,
  ROOT,
  STEP_ID,
  currentBranch,
  fingerprint,
  gitOut,
  headSha,
  isGitRepo,
  parseArgs,
  readConfig,
  readJson,
  run,
  tail,
  writeJson,
} from './lib/auto-lib.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2), ['full', 'quick', 'no-docker']);
const step = flags.step ?? positional.find((p) => STEP_ID.test(p)) ?? null;
if (step !== null && !STEP_ID.test(step)) {
  console.error(`verify: invalid step id "${step}" (expected P00–P99)`);
  process.exit(2);
}
if (!isGitRepo()) {
  console.error('verify: not a git repository — run `git init` and make the first commit (see START_HERE.md).');
  process.exit(2);
}

const cfg = readConfig();
const mode = flags.quick ? 'quick' : flags.full ? 'full' : 'standard';
const pkgJson = (rel) => readJson(path.join(ROOT, rel, 'package.json'), null);
const rootPkg = pkgJson('.');
const apiPkg = pkgJson('apps/api');
const webPkg = pkgJson('apps/web');
const pnpm = (args) => run('pnpm', args, { shell: IS_WIN });
const results = [];

function record(name, fn) {
  const started = Date.now();
  let r;
  try {
    r = fn();
  } catch (e) {
    r = { code: 1, stdout: '', stderr: String(e?.stack ?? e) };
  }
  if (r?.skip) {
    results.push({ name, status: 'skipped', reason: r.skip });
    return;
  }
  const passed = r.code === 0;
  results.push({
    name,
    status: passed ? 'passed' : 'failed',
    durationMs: Date.now() - started,
    ...(passed ? {} : { output: tail(`${r.stdout}\n${r.stderr}`, 80) }),
  });
}
const failed = (name) => results.some((r) => r.name === name && r.status === 'failed');
const missing = (script) => ({ code: 1, stdout: '', stderr: `root package.json has no "${script}" script` });

const before = fingerprint();

if (!rootPkg) {
  results.push({ name: 'workspace', status: 'failed', output: 'No root package.json — step P00 has not been implemented yet.' });
} else {
  const s = rootPkg.scripts ?? {};
  record('lint', () => (s.lint ? pnpm(['run', 'lint']) : missing('lint')));
  record('typecheck', () => (s.typecheck ? pnpm(['run', 'typecheck']) : missing('typecheck')));
  record('unit tests', () => (s.test ? pnpm(['run', 'test']) : missing('test')));

  if (mode !== 'quick') {
    record('build', () => (s.build ? pnpm(['run', 'build']) : missing('build')));

    const wantWebE2e = Boolean(webPkg?.scripts?.e2e) && (mode === 'full' || cfg.verify.webE2e);
    const wantApiE2e = Boolean(apiPkg?.scripts?.['test:e2e']);
    const compose = fs.existsSync(path.join(ROOT, 'docker-compose.yml'));
    if ((wantApiE2e || wantWebE2e) && compose && cfg.verify.dockerUp && !flags['no-docker']) {
      record('docker services', () => run('docker', ['compose', 'up', '-d', '--wait']));
    }
    const infraOk = !failed('docker services');
    const compiled = !failed('typecheck') && !failed('build');
    const infraHint = { code: 1, stdout: '', stderr: 'Docker services are not running. Start Docker, then `docker compose up -d --wait`.' };

    record('api e2e', () => {
      if (!wantApiE2e) return { skip: 'apps/api has no "test:e2e" script yet' };
      if (!compiled) return { skip: 'typecheck/build failed' };
      if (!infraOk) return infraHint;
      return pnpm(['--filter', './apps/api', 'run', 'test:e2e']);
    });
    if (mode === 'full' || cfg.verify.webE2e) {
      record('web e2e', () => {
        if (!webPkg?.scripts?.e2e) return { skip: 'apps/web has no "e2e" script yet' };
        if (!compiled) return { skip: 'typecheck/build failed' };
        if (!infraOk) return infraHint;
        return pnpm(['--filter', './apps/web', 'run', 'e2e']);
      });
    }
  }
}

if (step) {
  const checkFile = path.join(PATHS.checksDir, `${step}.mjs`);
  record(`step checks ${step}`, () =>
    fs.existsSync(checkFile) ? run(process.execPath, [checkFile]) : { skip: `scripts/checks/${step}.mjs not present` },
  );
}

const after = fingerprint();
if (after !== before) {
  results.push({
    name: 'tree unchanged by checks',
    status: 'failed',
    output:
      'The working tree changed while the checks ran (generated or formatted files?). ' +
      'Commit or git-ignore those files, then run verify again.\n' +
      (gitOut('status', '--porcelain') ?? ''),
  });
}

const ok = results.some((r) => r.status === 'passed') && !results.some((r) => r.status === 'failed');
const report = {
  ok,
  step,
  mode,
  at: new Date().toISOString(),
  branch: currentBranch(),
  head: headSha(),
  fingerprint: after,
  results,
};
writeJson(PATHS.verify, report);

// ---- human-readable summary
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nverify  step=${step ?? '-'}  mode=${mode}  branch=${report.branch}`);
for (const r of results) {
  const mark = r.status === 'passed' ? 'PASS' : r.status === 'failed' ? 'FAIL' : 'SKIP';
  const extra = r.status === 'skipped' ? r.reason : `${((r.durationMs ?? 0) / 1000).toFixed(1)}s`;
  console.log(`  ${mark}  ${pad(r.name, 26)} ${extra}`);
}
const count = (st) => results.filter((r) => r.status === st).length;
console.log(
  `RESULT: ${ok ? 'PASSED' : 'FAILED'} (${count('passed')} passed, ${count('failed')} failed, ${count('skipped')} skipped) -> .claude/state/last-verify.json`,
);
for (const r of results.filter((x) => x.status === 'failed')) {
  console.log(`\n----- ${r.name} (last lines) -----\n${r.output ?? ''}`);
}
process.exit(ok ? 0 : 1);
