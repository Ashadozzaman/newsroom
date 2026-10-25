# Progress Tracker

Legend: `[ ]` not started · `[~]` in progress / needs fixes / blocked · `[x]` done & committed · `[-]` skipped (out of scope).

Rules:

- Only `scripts/commit-step.mjs` sets `[x]`, after a passing `scripts/verify.mjs`. Only `scripts/auto.mjs skip` sets `[-]`.
- Claude may set `[ ]` → `[~]` and write Notes. Never put `|` inside a cell.
- Mode (manual/auto) is in `.claude/state/auto.json`. Check it with `node scripts/auto.mjs status`.

## Current status

- **Phase:** 0 — Foundation
- **Next step:** P00
- **Blocked by:** —

## Steps

| Step | Module | Title | Status | Branch | Notes |
|------|--------|-------|--------|--------|-------|
| P00 | M00 | Monorepo bootstrap | [~] | main | |
| P01 | M00 | API platform core | [ ] | | |
| P02 | M00 | Database layer, migrations & seed | [ ] | | |
| P03 | M01 | Authentication API | [ ] | | |
| P04 | M02 | RBAC, users & profiles API | [ ] | | |
| P05 | web | Web foundation, auth UI & shells | [ ] | | |
| P06 | M03/M04 | Taxonomy & media API | [ ] | | |
| P07 | web | Taxonomy & media UI | [ ] | | |
| P08 | M05 | Articles API | [ ] | | |
| P09 | web | Article editor UI | [ ] | | |
| P10 | M06 | Editorial workflow API | [ ] | | |
| P11 | web | Editorial UI | [ ] | | |
| P12 | M14 | Notifications & email | [ ] | | |
| P13 | M08 | Public site pages | [ ] | | |
| P14 | M08 | SEO, feeds, revalidation & views | [ ] | | Phase 1 gate (auto pauses after) |
| P15 | M07 | AI review API | [ ] | | |
| P16 | web | AI review UI | [ ] | | |
| P17 | M09 | Engagement | [ ] | | |
| P18 | M10 | Search | [ ] | | |
| P19 | M15 | Role-based dashboards | [ ] | | Phase 2 gate (auto pauses after) |
| P20 | M12 | Payments core | [ ] | | Needs ADR-015 (gateway) first |
| P21 | M12 | Subscriptions & paywall | [ ] | | |
| P22 | M11 | Advertising API | [ ] | | |
| P23 | web | Advertising UI | [ ] | | Phase 3 gate (auto pauses after) |
| P24 | M16 | Admin panel & settings | [ ] | | |
| P25 | M17 | Analytics & reports | [ ] | | |
| P26 | M13 | Contributor payouts | [ ] | | Needs ADR-016; skip if out of scope |
| P27 | M18 | Hardening & E2E | [ ] | | |
| P28 | ops | Deployment & CI/CD | [ ] | | Needs ADR-017 (hosting) first |

## Open TODOs (carried between steps)

| Added in | TODO | Owner | Target step |
|----------|------|-------|-------------|
| — | — | — | — |

## Auto-assumed decisions (confirm with client)

| Step | [CONFIRM] item | Default used | Confirmed? |
|------|----------------|--------------|------------|
| — | — | — | — |

## Bugs fixed

| Date | Bug | Root cause | Commit |
|------|-----|-----------|--------|
| — | — | — | — |

## Session log

| Date | Step | Mode | Summary |
|------|------|------|---------|
| — | — | — | — |
