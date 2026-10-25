---
description: Turn auto mode on and run playbook steps back to back (each step - agents → verify → review → commit), until a gate, the --until step, or the per-session limit
argument-hint: "[--until P14] [--max-steps 4]"
---

1. Run `node scripts/auto.mjs on $ARGUMENTS` and show me its output (branch, next step, gates ahead).
   - Exit code 3 (BLOCKED by a TBD decision) or any error: explain what I need to do and stop.
2. Remind me in one line: auto mode runs best in the **Auto** permission mode (VS Code: mode indicator below the prompt → Auto; CLI: `claude --permission-mode auto`). In Manual mode I'll get many permission prompts.
3. Start the next step by following `.claude/commands/run-step.md` (no argument; it picks the next step).
4. When the step is committed, end your turn with the step report. The Stop hook (`.claude/hooks/auto-continue.mjs`) then either sends you on to the next step or pauses with a message. Never skip a pause or a gate.

To stop: `/auto-stop` (immediately, when idle), `node scripts/auto.mjs stop` in a terminal (graceful: pauses after the current step), or Esc (interrupts now; resume later with `/auto`).
