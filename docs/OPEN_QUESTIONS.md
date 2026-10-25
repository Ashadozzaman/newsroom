# Open Questions — Interview & Kickoff Checklist

Use this in the interview (to show structured thinking) and in the kickoff call (to freeze scope). Record each answer in the **Answer** column, then update `docs/REQUIREMENTS.md` (remove the matching **[CONFIRM]** tag) and log the decision in `docs/DECISIONS.md`.

Priority: 🔴 blocks architecture or schema · 🟠 blocks a module · 🟢 nice to know.

## A. Business & scope

| # | P | Question | Why it matters | Default if no answer | Answer |
|---|---|----------|----------------|----------------------|--------|
| A1 | 🔴 | Who is the audience and which country/market? (BD, Gulf, global?) | Payment gateway, currency, language, legal | Global, USD, English | |
| A2 | 🔴 | What do people pay for: ads only, reader subscriptions, both, paid submissions? | Billing model & schema | Ads + subscriptions | |
| A3 | 🔴 | Are contributors paid through the platform (payouts)? Per article, per view, flat? | M13 in/out of scope | Out of v1 (records only, Phase 4) | |
| A4 | 🟠 | Is there an existing site/content to migrate (WordPress, custom DB)? Volume? | Import scripts, URL redirects for SEO | No migration | |
| A5 | 🟠 | Expected traffic at launch and in 12 months (monthly page views, concurrent users)? | Hosting size, caching, CDN | 1–3 M PV/month | |
| A6 | 🟠 | Launch date / hard deadlines? Phased launch acceptable? | Phase plan | Phased per REQUIREMENTS §7 | |
| A7 | 🟢 | Reference sites they like (look & feel, features)? | UI direction | Clean news layout | |

## B. Users & editorial process

| # | P | Question | Why it matters | Default | Answer |
|---|---|----------|----------------|---------|--------|
| B1 | 🔴 | Exact editorial roles and how many approval levels? (editor → chief editor?) | Workflow state machine | 2-level configurable | |
| B2 | 🟠 | Can anyone sign up and submit, or are contributors invited/approved? | Contributor application flow | Apply → admin approves | |
| B3 | 🟠 | Are editors limited to certain categories (desks)? | Category-scoped permissions | No scoping in v1 | |
| B4 | 🟠 | Is there a fast-track for breaking news? Who can use it? | WF-11 | Chief editor only | |
| B5 | 🟠 | Required fields and minimum word count for submission? House style guide available? | Validation, AI prompt context | Title, excerpt, category, image, 300 words | |
| B6 | 🟢 | Do they need an editorial calendar / planning (pitches before drafts)? | Possible "pitch" stage | Calendar only | |
| B7 | 🟢 | Corrections policy (visible correction notes on published articles)? | Public correction block | Yes | |

## C. AI-assisted review

| # | P | Question | Why it matters | Default | Answer |
|---|---|----------|----------------|---------|--------|
| C1 | 🔴 | Which checks matter most? (grammar, fact-check flags, plagiarism, legal risk, SEO, tone) | Prompt design & cost | All in AI-02 | |
| C2 | 🟠 | Preferred AI provider / any restriction on sending content to third parties? | Provider adapter, privacy | Anthropic Claude via API | |
| C3 | 🟠 | External plagiarism service needed (e.g. Copyleaks) or internal duplicate check enough? | Extra integration & cost | Internal only | |
| C4 | 🟠 | Monthly AI budget? Who pays API costs? | Budget cap & model choice | Client's API key, cap configurable | |
| C5 | 🟢 | Should AI also help write (headline/summary generation in the editor)? | Scope creep check | Suggestions only, from review | |
| C6 | 🟠 | Content languages (English only? Bangla/Arabic)? | Prompting, FTS config, RTL | English | |

## D. Advertising

| # | P | Question | Why it matters | Default | Answer |
|---|---|----------|----------------|---------|--------|
| D1 | 🔴 | Self-service advertisers, sales-led (admin creates campaigns), or both? | Advertiser portal scope | Both | |
| D2 | 🔴 | Pricing models: CPM, CPC, flat (per day/week), sponsored articles? | Billing & spend logic | CPM + CPC + flat | |
| D3 | 🟠 | Ad formats: image banners, native, HTML5, video? Third-party (AdSense/GAM) slots too? | Creative types, sandboxing | Image, text, native | |
| D4 | 🟠 | Targeting needed: category, device, country, time of day? | Serving logic | Category + device | |
| D5 | 🟠 | Do advertisers pay upfront (prepaid budget) or get invoiced (postpaid)? | Payment flow | Prepaid | |
| D6 | 🟢 | Fixed ad positions on the site (list them) and sizes? | Seed placements | 6 standard placements | |
| D7 | 🟢 | Need for sponsored article packages sold together with ads? | Sponsored article flow | Manual via SPONSORED type | |

## E. Payments

| # | P | Question | Why it matters | Default | Answer |
|---|---|----------|----------------|---------|--------|
| E1 | 🔴 | Which gateway(s)? Who owns the merchant account? (Stripe, SSLCommerz, bKash, PayPal, Tap, HyperPay…) | Adapter implementation | Stripe | |
| E2 | 🔴 | Currencies? Single or multiple? | Pricing & reports | Single currency | |
| E3 | 🟠 | VAT/tax requirements and invoice format (legal entity, tax ID, numbering)? | Invoice module | Configurable VAT %, INV-YYYY-NNNNNN | |
| E4 | 🟠 | Subscription plans and prices; trial? metered paywall (N free premium articles)? | Plans seed, paywall | Monthly + yearly, no meter | |
| E5 | 🟢 | Refund policy? | Refund rules | Admin manual | |

## F. Technical & operations

| # | P | Question | Why it matters | Default | Answer |
|---|---|----------|----------------|---------|--------|
| F1 | 🔴 | Hosting preference/constraint (AWS, DigitalOcean, client VPS, Vercel)? Who pays infra? | Deployment design | Docker on VPS + managed Postgres + Cloudflare | |
| F2 | 🟠 | Domain(s) and email sending domain/provider (SES, Postmark, SMTP)? | DNS, SPF/DKIM | Postmark or SES | |
| F3 | 🟠 | Object storage (S3, R2, Spaces)? | Media module config | Cloudflare R2 | |
| F4 | 🟠 | Is the stack (NestJS + Next.js + PostgreSQL + Prisma) acceptable? Any existing codebase/repo/design system? | Avoid rework | As proposed | |
| F5 | 🟠 | Design: will they provide Figma, or do I design with a UI kit (shadcn/ui)? | Frontend effort | shadcn/ui-based design | |
| F6 | 🟢 | Analytics tool preference (GA4, Plausible)? | Script injection | GA4 via settings | |
| F7 | 🟢 | SSO requirements for staff (Google Workspace)? | Auth | Google OAuth optional | |

## G. Contract & collaboration

| # | P | Question | Default | Answer |
|---|---|----------|---------|--------|
| G1 | 🔴 | Milestones and payment schedule tied to phases? | Per phase, demo + sign-off | |
| G2 | 🟠 | Who reviews/accepts deliverables? Turnaround time for feedback? | 2 business days | |
| G3 | 🟠 | Repository ownership (client's GitHub org?), access for CI/CD and hosting | Client org, I'm a collaborator | |
| G4 | 🟠 | Communication cadence (weekly demo, daily async update)? Tools (Slack, Jira, ClickUp)? | Weekly demo + async daily | |
| G5 | 🟢 | Post-launch support/maintenance period and bug-fix warranty? | 30 days warranty | |
| G6 | 🟢 | Is there a QA person or am I responsible for testing? | I write automated tests; client UAT | |

---

## Talking points for the interview (60-second architecture pitch)

- **Modular monolith** (NestJS 12) with clear module boundaries — fast to build, easy to split later (AI worker and ad tracking can run as separate processes).
- **Strict layering** Controller → Service → Repository, SOLID, Prisma 7 on PostgreSQL; transactions + optimistic locking for editorial safety.
- **Editorial workflow as an explicit state machine** with an audit trail of every transition; AI review is asynchronous (BullMQ), structured, versioned and **advisory only**.
- **Next.js 16** public site uses static/ISR rendering with on-demand tag revalidation → fast pages, strong SEO (NewsArticle JSON-LD, news sitemap).
- **Payments via a gateway interface** (Stripe/SSLCommerz/etc. adapters), webhooks as the source of truth, idempotent processing; no card data touches our servers.
- **Ads**: placements + campaigns + creatives, weighted rotation, signed click tracking, Redis counters flushed to daily stats → accurate spend and reports.
- **Delivery**: phased milestones, staging demo each phase, CI with lint/type-check/tests, Dockerised deploys, daily backups.
