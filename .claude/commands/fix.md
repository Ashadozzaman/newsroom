---
description: Fix a bug test-first (usage - /fix <description or failing behaviour>)
---

Bug: $ARGUMENTS

1. Reproduce: locate the code path and write a failing unit or e2e test that demonstrates the bug. Show me the failing output.
2. Explain the root cause in 2–4 sentences (not just the symptom).
3. Implement the smallest fix that makes the test pass without breaking others. No unrelated refactors.
4. Run lint, typecheck and the affected test suites.
5. Report: root cause, fix, files changed, tests added, proposed commit message `fix(<module>): …`. Update `docs/PROGRESS.md` under "Bugs fixed". Then stop.
