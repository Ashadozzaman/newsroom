# Decisions Log

The initial architecture decisions are ADR-001 to ADR-013 in `docs/ARCHITECTURE.md §24`. Add new ones here. Never edit an old row; write a new row that supersedes it.

**Auto mode reads this file.** A step listed under `confirmBefore` in `.claude/auto.config.json` cannot start while its ADR row still says `TBD`. To unblock it, replace `TBD` with the real decision.

| ADR | Date | Decision | Why | Alternatives | Supersedes |
|-----|------|----------|-----|--------------|-----------|
| 014 | | Next.js caching approach: TBD (Claude decides in P13: fetch tags + revalidateTag **or** Cache Components) | | | |
| 015 | | Payment gateway(s): TBD (from kickoff, OPEN_QUESTIONS E1) | | | |
| 016 | | Contributor payouts in scope: TBD (A3). If "no", auto mode skips P26 | | | |
| 017 | | Hosting / deployment target: TBD (F1) | | | |
