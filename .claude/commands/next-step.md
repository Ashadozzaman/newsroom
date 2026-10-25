---
description: Preview the next playbook step and its plan without changing anything (use /run-step to execute it)
---

1. Run `node scripts/auto.mjs status`. Read `docs/PROGRESS.md` and find the first step that is not `[x]` or `[-]`.
2. Read that step's block in `docs/PROMPTS.md`, its pipeline row in `docs/AUTOMATION.md §4`, and the documents it lists under "Read first".
3. Use the `planner` agent to produce the plan for that step.
4. Reply with:
   - the step ID, title, pipeline and gate;
   - the plan summary: work packages per agent, migrations, new env vars, new dependencies;
   - the requirement IDs covered;
   - risks and questions, especially any **[CONFIRM]** items it touches and the default that would be used.
5. **Don't write or change any file.** To execute the step, I'll run `/run-step` (manual) or `/auto`.
