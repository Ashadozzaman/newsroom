---
description: Run the quality gate (lint, typecheck, unit, build, API e2e, step checks) and summarise failures by owner
argument-hint: "[STEP-ID] [--full | --quick]"
---

Run `node scripts/verify.mjs $ARGUMENTS` and show the PASS/FAIL/SKIP table.
For each failure, give the likely root cause in one line and the owner (backend-dev, frontend-dev or test-runner), with file:line where the output shows it.
Don't fix anything unless I ask.
