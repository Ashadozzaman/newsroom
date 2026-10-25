// Shared helpers for the automation scripts and Claude Code hooks.
// Node >= 20, no third-party dependencies, works on Linux, macOS and Windows.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const IS_WIN = process.platform === 'win32';

export const PATHS = {
  stateDir: path.join(ROOT, '.claude', 'state'),
  state: path.join(ROOT, '.claude', 'state', 'auto.json'),
  verify: path.join(ROOT, '.claude', 'state', 'last-verify.json'),
  stop: path.join(ROOT, '.claude', 'state', 'STOP'),
  runs: path.join(ROOT, '.claude', 'state', 'runs'),
  config: path.join(ROOT, '.claude', 'auto.config.json'),
  progress: path.join(ROOT, 'docs', 'PROGRESS.md'),
  decisions: path.join(ROOT, 'docs', 'DECISIONS.md'),
  checksDir: path.join(ROOT, 'scripts', 'checks'),
};

// ---------------------------------------------------------------- processes
const winQuote = (a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/** Run a command synchronously. Never throws; returns { code, stdout, stderr }. */
export function run(cmd, args = [], opts = {}) {
  const shell = opts.shell ?? false;
  const finalArgs = shell && IS_WIN ? args.map(winQuote) : args;
  const r = spawnSync(cmd, finalArgs, {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
    shell,
    env: { ...process.env, ...(opts.env ?? {}) },
    maxBuffer: 256 * 1024 * 1024,
    input: opts.input,
    stdio: opts.stdio,
    timeout: opts.timeoutMs,
  });
  const err = r.error ? `\n${r.error.message}` : '';
  return {
    code: typeof r.status === 'number' ? r.status : 1,
    stdout: r.stdout ?? '',
    stderr: `${r.stderr ?? ''}${err}`,
  };
}

export const git = (...args) => run('git', args);
export function gitOut(...args) {
  const r = git(...args);
  return r.code === 0 ? r.stdout.trim() : null;
}
export const isGitRepo = () => git('rev-parse', '--is-inside-work-tree').code === 0;
export const hasCommits = () => git('rev-parse', '--verify', 'HEAD').code === 0;
export const currentBranch = () => gitOut('rev-parse', '--abbrev-ref', 'HEAD');
export const headSha = () => gitOut('rev-parse', 'HEAD');
export const headMessage = () => gitOut('log', '-1', '--pretty=%B') ?? '';
export const isClean = () => gitOut('status', '--porcelain') === '';
export const stepTrailerMatches = (message, id) => new RegExp(`^Step: ${id}(\\s|$)`, 'm').test(message);

/**
 * Hash of the exact working tree: HEAD + status + tracked diff + untracked file contents.
 * Used to prove that a verification ran on precisely the files being committed.
 */
export function fingerprint() {
  const h = createHash('sha256');
  for (const args of [['rev-parse', 'HEAD'], ['status', '--porcelain=v1', '-uall'], ['diff', 'HEAD', '--binary']]) {
    const r = git(...args);
    h.update(`${args.join(' ')}\0${r.code}\0${r.stdout}\0`);
  }
  const untracked = (git('ls-files', '--others', '--exclude-standard', '-z').stdout || '')
    .split('\0')
    .filter(Boolean)
    .sort();
  for (const file of untracked) {
    h.update(`${file}\0`);
    try {
      h.update(fs.readFileSync(path.join(ROOT, file)));
    } catch {
      h.update('<unreadable>');
    }
  }
  return h.digest('hex');
}

// ---------------------------------------------------------------- json/state/config
export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export const DEFAULT_CONFIG = {
  pauseAfter: ['P14', 'P19', 'P23'],
  confirmBefore: { P20: '015', P26: '016', P28: '017' },
  maxStepsPerSession: 4,
  maxFixRounds: 3,
  protectedBranches: ['main', 'master'],
  branchPrefix: 'auto/run-',
  verify: { dockerUp: true, webE2e: false },
};

export function readConfig() {
  const c = readJson(PATHS.config, {}) ?? {};
  return { ...DEFAULT_CONFIG, ...c, verify: { ...DEFAULT_CONFIG.verify, ...(c.verify ?? {}) } };
}
export function readState() {
  return { mode: 'manual', ...(readJson(PATHS.state, {}) ?? {}) };
}
export function writeState(state) {
  writeJson(PATHS.state, { ...state, updatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------- docs/PROGRESS.md
const DONE = new Set(['x', '-']);
export const isDone = (status) => DONE.has(status);

function stepsSection(lines) {
  const start = lines.findIndex((l) => /^##\s+Steps\b/.test(l));
  if (start === -1) throw new Error('docs/PROGRESS.md has no "## Steps" section');
  let end = lines.findIndex((l, i) => i > start && /^##\s+/.test(l));
  if (end === -1) end = lines.length;
  return [start, end];
}

function parseRow(line) {
  const m = line.match(/^\|\s*(P\d{2})\s*\|/);
  if (!m) return null;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  const sm = (cells[3] ?? '').match(/\[(.)\]/);
  const status = sm ? sm[1].toLowerCase() : ' ';
  return { id: m[1], module: cells[1] ?? '', title: cells[2] ?? '', status, branch: cells[4] ?? '', notes: cells[5] ?? '' };
}

/** Parse the Steps table. status: ' ' todo · '~' in progress/needs fixes · 'x' done · '-' skipped. */
export function readProgress() {
  const text = fs.readFileSync(PATHS.progress, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const [start, end] = stepsSection(lines);
  const steps = [];
  for (let i = start; i < end; i++) {
    const row = parseRow(lines[i]);
    if (row) steps.push({ ...row, line: i });
  }
  const doneCount = steps.filter((s) => isDone(s.status)).length;
  const next = steps.find((s) => !isDone(s.status)) ?? null;
  let lastDone = null;
  for (const s of steps) {
    if (!isDone(s.status)) break;
    lastDone = s;
  }
  return { text, eol, lines, steps, doneCount, next, lastDone };
}

/** Rewrite one Steps row in place. Only the given cells change. */
export function updateStepRow(id, { status, branch, notes } = {}) {
  const p = readProgress();
  const row = p.steps.find((s) => s.id === id);
  if (!row) throw new Error(`Step ${id} not found in docs/PROGRESS.md`);
  const cells = p.lines[row.line].split('|');
  while (cells.length < 8) cells.splice(cells.length - 1, 0, ' ');
  if (status !== undefined) cells[4] = ` [${status}] `;
  if (branch !== undefined) cells[5] = ` ${branch} `;
  if (notes !== undefined) cells[6] = ` ${String(notes).replace(/\|/g, '/').replace(/\r?\n/g, ' ')} `;
  p.lines[row.line] = cells.join('|');
  const after = readProgressFromLines(p.lines);
  const nextLine = p.lines.findIndex((l) => /^- \*\*Next step:\*\*/.test(l));
  if (nextLine !== -1) p.lines[nextLine] = `- **Next step:** ${after.next ? after.next.id : '— (all steps done)'}`;
  fs.writeFileSync(PATHS.progress, p.lines.join(p.eol));
  return row;
}

function readProgressFromLines(lines) {
  const [start, end] = stepsSection(lines);
  const steps = [];
  for (let i = start; i < end; i++) {
    const row = parseRow(lines[i]);
    if (row) steps.push(row);
  }
  return { next: steps.find((s) => !isDone(s.status)) ?? null };
}

// ---------------------------------------------------------------- docs/DECISIONS.md + gates
export function decisionStatus(adr) {
  let text = '';
  try {
    text = fs.readFileSync(PATHS.decisions, 'utf8');
  } catch {
    return { found: false, unresolved: true, line: null };
  }
  const line = text.split(/\r?\n/).find((l) => new RegExp(`^\\|\\s*${adr}\\s*\\|`).test(l)) ?? null;
  if (!line) return { found: false, unresolved: true, line: null };
  return { found: true, unresolved: /\bTBD\b/.test(line), line };
}

/** Reason the given step must not start yet, or null. */
export function gateBefore(stepId, cfg = readConfig()) {
  const adr = cfg.confirmBefore?.[stepId];
  if (!adr) return null;
  const d = decisionStatus(adr);
  return d.unresolved ? `${stepId} needs decision ADR-${adr} recorded in docs/DECISIONS.md (still TBD)` : null;
}

/** Reason to pause after the given step completed, or null. */
export function gateAfter(stepId, cfg = readConfig(), state = readState()) {
  if (state.until && stepId === state.until) return `reached the --until limit (${state.until})`;
  if (cfg.pauseAfter?.includes(stepId)) return `phase gate after ${stepId} — demo/review before continuing`;
  return null;
}

// ---------------------------------------------------------------- misc
export function tail(text, n = 60) {
  return String(text).trimEnd().split(/\r?\n/).slice(-n).join('\n');
}

export function parseArgs(argv, booleanFlags = []) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split(/=(.*)/s);
    if (inline !== undefined) flags[key] = inline;
    else if (booleanFlags.includes(key)) flags[key] = true;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[key] = argv[++i];
    else flags[key] = true;
  }
  return { positional, flags };
}

export const STEP_ID = /^P\d{2}$/;

export function die(message, code = 1) {
  console.error(`✖ ${message}`);
  process.exit(code);
}
