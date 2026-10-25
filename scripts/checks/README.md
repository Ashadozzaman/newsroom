# Step checks

`scripts/checks/<STEP>.mjs` turns a step's **"Done when"** list (docs/PROMPTS.md) into automated checks.
`node scripts/verify.mjs --step <STEP>` runs the file for that step after lint, typecheck, unit, build and e2e.
The `test-runner` agent writes these during each step. A missing file is skipped, not failed.

Contract for every check file:

- Node ESM (`.mjs`), only Node built-ins (and `fetch`). No new dependencies.
- Print one line per check: `PASS <name>` or `FAIL <name>: <reason>`. Exit `0` if all pass, `1` otherwise.
- Idempotent and safe to run repeatedly. Never reset or truncate the dev database. Use the test database (`newsroom_test`) or read-only queries.
- If a check needs a running server, start it in the check, wait for `/health/live`, and always kill it in `finally`. Keep the whole file under ~5 minutes.
- Don't write tracked files. verify fails when the tree changes during the checks.

See `_example.mjs`.
