// Example step check (copy to scripts/checks/<STEP>.mjs). Not run by verify (name doesn't match a step).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${e?.message ?? e}`);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// 1) static check — a file the step must create
await check('docs untouched: docs/ARCHITECTURE.md exists', () => {
  assert(fs.existsSync('docs/ARCHITECTURE.md'), 'missing');
});

// 2) runtime check — start the API, hit an endpoint, always stop it
await check('GET /api/v1/health returns ok', async () => {
  const api = spawn(process.execPath, ['apps/api/dist/main.js'], { env: { ...process.env, PORT: '4100' }, stdio: 'ignore' });
  try {
    let body = null;
    for (let i = 0; i < 40 && !body; i++) {
      await new Promise((r) => setTimeout(r, 500));
      body = await fetch('http://localhost:4100/api/v1/health').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }
    assert(body, 'API did not answer within 20 s');
  } finally {
    api.kill();
  }
});

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
