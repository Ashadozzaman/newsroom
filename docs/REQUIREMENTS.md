# Newsroom Platform — Product Requirements (PRD)

> **Status:** Draft v0.1 — prepared before client kickoff. Items marked **[CONFIRM]** must be validated with the client (see `docs/OPEN_QUESTIONS.md`).
> **Working name:** "Newsroom" (rename freely; package scope is `@newsroom/*`).
> **Engagement:** Contractual, remote. Backend / Full-stack.

---

## 1. Product summary

A custom article / news publishing platform where contributors and staff writers submit articles, editors review them through a structured editorial and approval workflow (assisted by AI checks), and approved content is published to a fast, SEO-optimised public website. The platform monetises through **advertising** (self-service advertisers + house/direct-sold campaigns) and **paid subscriptions** (premium content). Every role gets its own dashboard; administrators control users, content, ads, payments and site settings.

### 1.1 Goals

| # | Goal | Measure of success |
|---|------|--------------------|
| G1 | Publish high-quality articles quickly and safely | Submission → publish lead time tracked; zero un-reviewed publishes (except audited fast-track) |
| G2 | Reduce editor workload with AI-assisted review | Every submission gets an AI review in < 2 min; editors can accept/dismiss findings |
| G3 | Generate revenue from ads and subscriptions | Advertisers can self-serve campaign → pay → go live after approval; readers can subscribe |
| G4 | Rank well in search and load fast | Core Web Vitals "good" on article pages; valid NewsArticle structured data; Google News sitemap |
| G5 | Full operational control for admins | All sensitive actions audited; settings editable without deploys |

### 1.2 Out of scope (v1, unless client says otherwise) **[CONFIRM]**

- Native mobile apps (the web app is responsive / PWA-ready).
- Multi-tenant (multiple publications on one install).
- Live blogs, podcasts, video hosting/transcoding (video = embeds only).
- Programmatic ad exchange / header bidding (Google AdSense/GAM slot support can be added as a placement type later).
- Automated contributor payout transfers (v1 records payouts; money moves off-platform).

---

## 2. Roles & personas

| Role key | Who | Core abilities |
|----------|-----|----------------|
| `READER` | Registered visitor (default role on sign-up) | Read, comment, react, bookmark, follow, subscribe, manage profile |
| `CONTRIBUTOR` | External / freelance writer | Everything a reader can + create drafts, submit articles, respond to editor feedback, see own stats (& payouts **[CONFIRM]**) |
| `AUTHOR` | Staff writer | Same as contributor; may be allowed to publish own breaking news via fast-track if also granted `article.publish` |
| `EDITOR` | Section/desk editor | Review queue, claim/assign reviews, edit content, request changes, approve/reject, run AI review, moderate comments in own sections |
| `CHIEF_EDITOR` | Editor-in-chief / publisher | All editor powers + final approval, publish/schedule/unpublish, feature/breaking flags, editorial calendar, fast-track publish |
| `MODERATOR` | Community moderator | Moderate comments and reports |
| `ADVERTISER` | Business buying ads | Advertiser profile, campaigns, creatives, payments, invoices, ad reports |
| `AD_MANAGER` | Internal ad ops | Review/approve campaigns & creatives, manage placements & rates, house ads, ad reports |
| `ADMIN` | Platform administrator | Users, roles, taxonomy, settings, pages, menus, payments, plans, reports, audit log |
| `SUPER_ADMIN` | Owner / technical admin | Everything, including role/permission editing and AI/payment provider settings |

- A user can hold **multiple roles** (e.g. AUTHOR + EDITOR). Effective permissions = union.
- Authorization is **permission-based** (RBAC); roles are bundles of permissions editable by SUPER_ADMIN. Ownership rules ("own" vs "any") are enforced by policies in services.
- Permission keys are defined once in `packages/contracts/src/permissions.ts` and seeded into the DB.

### 2.1 Permission catalogue (seeded)

| Area | Permission keys |
|------|-----------------|
| Articles | `article.create`, `article.update.own`, `article.update.any`, `article.delete.own`, `article.delete.any`, `article.submit`, `article.review`, `article.assign`, `article.approve`, `article.reject`, `article.publish`, `article.schedule`, `article.unpublish`, `article.feature`, `article.fasttrack` |
| Taxonomy | `category.manage`, `tag.manage`, `tag.create` |
| Media | `media.upload`, `media.manage.any` |
| AI | `ai.review.run.own`, `ai.review.run.any`, `ai.settings.manage` |
| Community | `comment.create`, `comment.moderate`, `report.create` |
| Ads | `advertiser.self`, `ad.campaign.manage.own`, `ad.campaign.review`, `ad.campaign.manage.any`, `ad.placement.manage`, `ad.report.view.any` |
| Billing | `subscription.self`, `payment.view.any`, `payment.refund`, `plan.manage`, `invoice.view.any` |
| Payouts | `payout.view.own`, `payout.manage` |
| Users | `user.view`, `user.manage`, `role.manage` |
| Site | `settings.manage`, `page.manage`, `menu.manage` |
| Insight | `report.view`, `audit.view`, `dashboard.editorial`, `dashboard.admin` |

Default role → permission mapping lives in `apps/api/prisma/seed/permissions.seed.ts` (see `docs/ARCHITECTURE.md §7`).

---

## 3. Fixed module list

The scope is frozen as the following modules. Each module has an ID used in branches, commits, prompts and the progress tracker.

| ID | Module | Phase | Summary |
|----|--------|-------|---------|
| **M00** | Foundation | 0 | Monorepo, tooling, config, logging, errors, Prisma, Docker, CI skeleton |
| **M01** | Auth & Identity | 1 | Email/password, email verification, refresh-token sessions, password reset, Google OAuth, optional TOTP 2FA for staff |
| **M02** | Users, Roles & Permissions | 1 | RBAC, user admin, profiles, author profiles |
| **M03** | Taxonomy | 1 | Hierarchical categories, tags |
| **M04** | Media Library | 1 | Direct-to-S3 uploads, image variants, alt text/caption/credit, reuse |
| **M05** | Articles & Editor | 1 | Rich-text authoring (TipTap), autosave, revisions, SEO fields, co-authors, slugs & redirects |
| **M06** | Editorial Workflow | 1 | Submission → review → changes → approval → schedule → publish → archive; assignments, notes, audit trail |
| **M07** | AI-Assisted Review | 2 | Automatic + on-demand AI checks with structured findings & suggestions; advisory, never auto-publishes |
| **M08** | Public Site & SEO | 1 | Home, category, article, author, tag, static pages; metadata, JSON-LD, sitemaps, RSS; paywall gate |
| **M09** | Engagement | 2 | Comments + moderation, reactions, bookmarks, follows, newsletter (double opt-in) |
| **M10** | Search | 2 | Full-text search (PostgreSQL FTS) with filters; upgrade path to Meilisearch |
| **M11** | Advertising Management | 3 | Advertisers, campaigns, creatives, placements, targeting, review, serving, impression/click tracking, reports |
| **M12** | Payments, Subscriptions & Billing | 3 | Gateway abstraction, ad campaign checkout, reader subscriptions, invoices, refunds, webhooks |
| **M13** | Contributor Payouts | 4 | **[CONFIRM]** Payout records per contributor/article, approval, mark-as-paid |
| **M14** | Notifications & Email | 1→2 | In-app notifications, transactional emails, preferences |
| **M15** | Role-based Dashboards | 2 | Reader, author, editor, advertiser, admin dashboards |
| **M16** | Admin Panel & Site Settings | 1→4 | User/role admin, settings, CMS pages, menus, audit log viewer |
| **M17** | Analytics & Reports | 4 | Article views, author performance, ad performance, revenue; CSV export |
| **M18** | Security, Audit & Compliance | cross-cutting | Audit log, rate limits, headers, data export/delete, backups |

---

## 4. Functional requirements by module

Format: **ID — requirement** (priority: **M**ust / **S**hould / **C**ould).

### M01 — Auth & Identity

- **AUTH-01 (M)** Register with name, email, password; account starts `PENDING_VERIFICATION`; verification email with single-use token (24 h).
- **AUTH-02 (M)** Login with email + password; returns short-lived access token (15 min) and rotating refresh token (30 days) in httpOnly cookies.
- **AUTH-03 (M)** Refresh token rotation with reuse detection (reuse ⇒ revoke whole token family, force re-login).
- **AUTH-04 (M)** Logout (current device) and "log out of all devices".
- **AUTH-05 (M)** Forgot / reset password (token 1 h, single use); all sessions revoked on reset.
- **AUTH-06 (S)** Google OAuth sign-in / account linking by verified email.
- **AUTH-07 (S)** TOTP 2FA, mandatory for `ADMIN`, `SUPER_ADMIN`, `CHIEF_EDITOR` **[CONFIRM]**; recovery codes.
- **AUTH-08 (M)** Brute-force protection: per-IP and per-account rate limits; generic error messages (no user enumeration).
- **AUTH-09 (M)** Change email (verify new address) and change password (requires current password).
- **AUTH-10 (S)** Session list (device, IP, last used) with revoke.

### M02 — Users, Roles & Permissions

- **USR-01 (M)** Admin can list/search/filter users, view details, suspend/reactivate, assign/remove roles.
- **USR-02 (M)** SUPER_ADMIN can create custom roles and edit role→permission mapping; system roles cannot be deleted.
- **USR-03 (M)** Profile: name, username, avatar, bio, locale, timezone, social links.
- **USR-04 (M)** Author profile (public): pen name, designation, bio, socials, verified badge, article list.
- **USR-05 (S)** Contributor application: reader applies to become contributor (sample links, bio) → admin approves → role granted **[CONFIRM]**.
- **USR-06 (M)** GDPR-style self-service: export my data (JSON), delete/anonymise my account (articles retained under "Former contributor").

### M03 — Taxonomy

- **TAX-01 (M)** Categories with parent/child (max depth 2), slug, description, SEO title/description, sort order, active flag, show-in-nav flag.
- **TAX-02 (M)** Tags (free-form, slug unique); editors manage, authors may create if `tag.create`.
- **TAX-03 (S)** Merge tags; prevent deleting a category that has articles (must reassign).
- **TAX-04 (C)** Editors scoped to categories ("desk editors") **[CONFIRM]**.

### M04 — Media Library

- **MED-01 (M)** Upload images (JPEG/PNG/WebP/AVIF/GIF) directly to object storage using presigned URLs; max size configurable (default 10 MB).
- **MED-02 (M)** Server validates real MIME type, strips EXIF/GPS, generates responsive variants (WebP; 320/640/1024/1600 widths + thumbnail).
- **MED-03 (M)** Alt text (required before an image can be used as featured image), caption, credit/source.
- **MED-04 (M)** Library browser with search, filter by type/uploader, pagination; reuse across articles.
- **MED-05 (S)** Documents (PDF) for attachments; video/audio as embeds only (YouTube, Vimeo, X, Facebook, Instagram, SoundCloud).

### M05 — Articles & Editor

- **ART-01 (M)** Create/edit article: title, subtitle (dek), excerpt, body (rich text), primary category, tags, featured image, type (`NEWS`, `FEATURE`, `OPINION`, `ANALYSIS`, `INTERVIEW`, `EXPLAINER`, `SPONSORED`), visibility (`PUBLIC`, `MEMBERS`, `PREMIUM`), language.
- **ART-02 (M)** Rich-text editor (TipTap): headings, bold/italic/underline, lists, links, block quotes, pull quotes, images from library (with caption), embeds, tables, horizontal rule, code (for tech content), undo/redo, word count.
- **ART-03 (M)** Autosave every few seconds of inactivity with optimistic locking (`version`), conflict warning if someone else saved.
- **ART-04 (M)** Revision history: snapshot on each submit/approve/publish and on manual "save version"; view and diff; restore (creates new revision).
- **ART-05 (M)** Soft edit lock: show "X is editing" banner; lock auto-expires after 5 min without heartbeat; editors can take over (logged).
- **ART-06 (M)** SEO panel: SEO title, meta description, canonical URL, OG image; live character counters; slug editing before first publish.
- **ART-07 (M)** Slug changes after publish create a permanent redirect (old slug → article).
- **ART-08 (S)** Co-authors (ordered byline).
- **ART-09 (M)** Preview as it will appear on the public site (signed preview URL, expires in 1 h).
- **ART-10 (M)** Sanitised HTML generated server-side from the editor JSON (allow-list); plain text extracted for search/AI; reading time & word count computed.
- **ART-11 (S)** Sponsored content flag + sponsor name, clearly labelled on the public site.
- **ART-12 (M)** Authors see "My articles" filtered by status; can delete own drafts only.

### M06 — Editorial Workflow

Statuses: `DRAFT → SUBMITTED → IN_REVIEW → (CHANGES_REQUESTED ↺) → APPROVED → SCHEDULED → PUBLISHED → ARCHIVED`, plus `REJECTED`. Full transition table in `docs/ARCHITECTURE.md §8`.

- **WF-01 (M)** Submit: validates completeness (title, excerpt, category, featured image with alt text, min word count — configurable). Creates a revision and triggers AI review.
- **WF-02 (M)** Editorial queue: filter by status, category, author, assignee, age; sort by submitted date / priority; "unassigned" view.
- **WF-03 (M)** Claim (self-assign) or assign to an editor with due date; reassign; one active reviewer at a time.
- **WF-04 (M)** Editorial notes: threaded comments, optionally anchored to a text selection; visibility `INTERNAL` (editors only) or `AUTHOR` (visible to author); resolve/unresolve.
- **WF-05 (M)** Request changes (note required) → author notified → author edits and resubmits (new revision; diff vs previous submission available to editor).
- **WF-06 (M)** Approve / reject (reason required for reject). If AI review has unresolved `CRITICAL` findings, approval requires an explicit acknowledgement checkbox (logged).
- **WF-07 (M)** Publish now or schedule (date-time in site timezone). Scheduled publishing executes within 60 s of target time; failures alert admins.
- **WF-08 (M)** Two-step approval configurable: `workflow.requireChiefApproval` — when on, EDITOR approval moves to `APPROVED` but only `article.publish` holders can publish/schedule.
- **WF-09 (M)** Unpublish (→ `ARCHIVED`) and republish; corrections on published articles by editors create a revision and optional public "Correction" note.
- **WF-10 (M)** Full audit trail per article (every transition: from, to, actor, note, timestamp).
- **WF-11 (S)** Fast-track publish for breaking news (`article.fasttrack`): DRAFT → PUBLISHED, still logged and flagged for post-publish review.
- **WF-12 (S)** Editorial calendar (scheduled + published by day/week) with drag to reschedule.
- **WF-13 (M)** Notifications on every transition to the relevant people (author, assignee, chief editors).

### M07 — AI-Assisted Review

- **AI-01 (M)** Auto-run on submit/resubmit; manual run by author (pre-submit self-check, rate-limited per day) and editors (any time).
- **AI-02 (M)** Checks: grammar & spelling, style & clarity, headline quality, structure, factual claims needing verification, potential legal risk (defamation, unverified accusations), toxicity/hate, bias/one-sidedness, policy violations, SEO (title/meta/keywords), readability score.
- **AI-03 (M)** Output is **structured** findings: category, severity (`INFO…CRITICAL`), message, suggestion, quoted excerpt, position — validated against a schema before saving.
- **AI-04 (M)** Suggestions: 3–5 alternative headlines, SEO title, meta description, excerpt/summary, suggested tags (from existing tags first).
- **AI-05 (M)** Duplicate/similarity check against the platform's own archive (trigram similarity) — flags near-duplicates. External plagiarism API is optional **[CONFIRM]**.
- **AI-06 (M)** Editor/author can accept or dismiss each finding; one-click apply for headline/SEO/excerpt/tag suggestions.
- **AI-07 (M)** AI is **advisory only**: never changes status, never publishes, never edits content without a human click.
- **AI-08 (M)** Track provider, model, prompt version, tokens, cost and latency per review; admin dashboard of AI spend; monthly budget cap with alert.
- **AI-09 (S)** Admin-configurable: enable/disable checks, house style guide text injected into prompts, severity thresholds.
- **AI-10 (M)** Failures are retried (3×, backoff) and surfaced as "AI review unavailable" without blocking the human workflow.

### M08 — Public Site & SEO

- **PUB-01 (M)** Home: breaking ticker, featured/hero, latest, category blocks, most-read (24 h / 7 d), editor's picks, newsletter CTA, ad slots.
- **PUB-02 (M)** Category page (with sub-categories), tag page, author page, search page, static CMS pages (About, Contact, Terms, Privacy, Advertise with us).
- **PUB-03 (M)** Article page: headline, dek, byline(s), dates (published/updated), featured image with caption/credit, body, tags, share buttons, author box, related articles, comments, in-article ad slots, sponsored label, correction notes.
- **PUB-04 (M)** Paywall: `MEMBERS` requires login, `PREMIUM` requires active subscription; show teaser (first N paragraphs) + CTA. Metered free premium articles per month **[CONFIRM]**.
- **PUB-05 (M)** SEO: per-page metadata, Open Graph/Twitter cards, canonical, `NewsArticle` + `BreadcrumbList` + `Organization` JSON-LD, XML sitemap (index + articles + categories + authors), Google News sitemap (last 48 h), RSS (site + per category), robots.txt.
- **PUB-06 (M)** Performance: static/ISR rendering with on-demand revalidation when content changes; responsive images; Core Web Vitals "good".
- **PUB-07 (M)** View counting via lightweight beacon (deduplicated per visitor per article per 30 min, bots excluded).
- **PUB-08 (S)** Dark mode, accessible (WCAG 2.1 AA), print-friendly article view.
- **PUB-09 (C)** Multi-language UI (English + Bangla / Arabic RTL) **[CONFIRM]**.

### M09 — Engagement

- **ENG-01 (M)** Comments (logged-in users), 1-level replies, edit within 15 min, delete own.
- **ENG-02 (M)** Moderation: pre-moderation or post-moderation per site setting; queue for `PENDING`; approve/reject/spam; ban users from commenting; profanity filter; AI toxicity check (optional).
- **ENG-03 (M)** Report comment (reason) → moderation queue.
- **ENG-04 (S)** Reactions on articles (one per user), comment likes.
- **ENG-05 (M)** Bookmarks ("Saved") list in reader dashboard.
- **ENG-06 (S)** Follow authors and categories → personalised "For you" feed and notifications on new publish.
- **ENG-07 (M)** Newsletter subscription with double opt-in, unsubscribe link, category preferences. Sending campaigns via external ESP **[CONFIRM]** (v1 stores list + exports CSV / syncs to ESP).

### M10 — Search

- **SRC-01 (M)** Full-text search over title, subtitle, excerpt, body of published, visible articles; ranking by relevance + recency.
- **SRC-02 (M)** Filters: category, tag, author, type, date range; pagination.
- **SRC-03 (S)** Typeahead suggestions (titles) in header search.
- **SRC-04 (M)** Admin/editor search across all statuses in dashboards.

### M11 — Advertising Management

- **ADS-01 (M)** Advertiser onboarding: company, contact, billing details; status `PENDING → ACTIVE` (approved by AD_MANAGER) **[CONFIRM self-service vs sales-led]**.
- **ADS-02 (M)** Placements (managed by AD_MANAGER): key (e.g. `home_leaderboard`, `article_inline_1`, `sidebar_mrec`), page, size, allowed creative types, max rotating ads, rate card (CPM / CPC / flat daily).
- **ADS-03 (M)** Campaign wizard: name, placements, schedule (start/end), pricing model, budget (total, optional daily cap), targeting (categories, device, language; country **[CONFIRM]**), frequency cap.
- **ADS-04 (M)** Creatives: image banner (from upload), text, native (headline + image + body), HTML5 (sandboxed iframe) **[CONFIRM]**; target URL with UTM; multiple creatives per campaign with weights.
- **ADS-05 (M)** Lifecycle: `DRAFT → PENDING_PAYMENT → PENDING_REVIEW → SCHEDULED/ACTIVE → PAUSED → COMPLETED`, or `REJECTED`/`CANCELED`. Review covers campaign + each creative (reason on reject). Auto-complete on end date or budget exhausted.
- **ADS-06 (M)** House / direct-sold campaigns created by AD_MANAGER without payment (`isHouse`), lowest priority filler.
- **ADS-07 (M)** Ad serving: eligible campaigns by placement, schedule, budget, targeting, status → weighted rotation by priority & creative weight; frequency cap per visitor.
- **ADS-08 (M)** Tracking: viewable impression beacon, click redirect with signed token; bot filtering; aggregated daily stats; spend computed per pricing model.
- **ADS-09 (M)** Advertiser reports: impressions, clicks, CTR, spend by day/placement/creative; CSV export.
- **ADS-10 (S)** Low-budget and campaign-ending notifications; pause/resume by advertiser.
- **ADS-11 (C)** Third-party ad code placement type (AdSense/GAM snippet) per slot **[CONFIRM]**.

### M12 — Payments, Subscriptions & Billing

- **PAY-01 (M)** Payment gateway abstraction; first adapter per client's market **[CONFIRM: Stripe / SSLCommerz / bKash / PayPal / Tap / HyperPay]**.
- **PAY-02 (M)** Ad campaign checkout (prepaid budget): hosted checkout → webhook confirms → campaign moves to `PENDING_REVIEW`.
- **PAY-03 (M)** Reader subscription plans (monthly/yearly, optional trial): checkout, renewals via webhooks, cancel at period end, grace period for `PAST_DUE`.
- **PAY-04 (M)** Webhooks are the source of truth; verified signatures; idempotent processing; raw event stored.
- **PAY-05 (M)** Invoices with sequential numbers, PDF download, billing details snapshot; tax/VAT rate configurable **[CONFIRM]**.
- **PAY-06 (M)** Refunds (full/partial) by admins with `payment.refund`; campaign budget adjusted accordingly.
- **PAY-07 (M)** Payment history for users/advertisers; admin payments ledger with filters and CSV export.
- **PAY-08 (M)** Never store card data (PCI scope stays with the gateway).

### M13 — Contributor Payouts **[CONFIRM whether in scope]**

- **PO-01** Rate per published article (by type/category) or manual amount.
- **PO-02** Monthly payout batches: auto-collect published articles in period → admin reviews → approves → marks paid with reference.
- **PO-03** Contributor sees payout history and pending earnings.

### M14 — Notifications & Email

- **NTF-01 (M)** In-app notifications (bell + list, unread count, mark read/all read), polling or SSE.
- **NTF-02 (M)** Transactional emails via queue: verify email, reset password, workflow events, comment replies, payment receipts, invoices, campaign status, subscription lifecycle.
- **NTF-03 (M)** Per-user preferences per notification type & channel (security emails cannot be disabled).
- **NTF-04 (M)** Email log with status for support/debugging.

### M15 — Role-based Dashboards

- **DSH-01 (M)** Reader: saved articles, following, subscription status, notifications, comments.
- **DSH-02 (M)** Author/Contributor: articles by status, items needing my action (changes requested), views on my published articles, AI checks, (earnings).
- **DSH-03 (M)** Editor: my assignments, unassigned queue count, overdue reviews, today's schedule, recent AI critical flags.
- **DSH-04 (M)** Advertiser: active campaigns, spend vs budget, impressions/clicks trend, invoices, pending reviews.
- **DSH-05 (M)** Admin: KPIs (published today/week, pending reviews, new users, active subscribers, ad revenue, subscription revenue, AI spend), system health.

### M16 — Admin Panel & Site Settings

- **ADM-01 (M)** Site settings (grouped): general (name, logo, timezone, locale), SEO defaults, social links, workflow toggles, comment moderation mode, paywall settings, AI settings, ads settings, payment settings (non-secret), email sender.
- **ADM-02 (M)** CMS pages (rich text) and menus (header/footer) editable without deploy.
- **ADM-03 (M)** Content admin: all articles, bulk actions (archive, feature, change category), hard delete restricted to SUPER_ADMIN.
- **ADM-04 (M)** Audit log viewer with filters (actor, action, entity, date) — read-only.
- **ADM-05 (S)** System status page: queue sizes, failed jobs (retry), last scheduled-publish run, storage usage.

### M17 — Analytics & Reports

- **RPT-01 (M)** Article performance: views per day, top articles, by category/author/period.
- **RPT-02 (M)** Editorial metrics: submissions, approval rate, average review time, per-editor throughput.
- **RPT-03 (M)** Revenue: ad revenue (by advertiser/placement), subscription MRR, churn, refunds.
- **RPT-04 (M)** CSV export for every report; date-range picker; site timezone.
- **RPT-05 (C)** Google Analytics 4 / Plausible integration for traffic (script injection from settings).

### M18 — Security, Audit & Compliance (cross-cutting)

- **SEC-01 (M)** Audit log for all admin/editorial/financial actions (actor, action, entity, before/after diff, IP, user agent, request id).
- **SEC-02 (M)** Rate limiting (global + per-route), secure headers, CSP, CORS allow-list, CSRF protection for cookie-authenticated mutations.
- **SEC-03 (M)** Input validation on every endpoint, HTML sanitisation, upload validation, SSRF-safe embeds (oEmbed allow-list).
- **SEC-04 (M)** Secrets only via environment; encryption at rest for 2FA secrets and any stored provider credentials.
- **SEC-05 (M)** Daily DB backups with 14–30 day retention and tested restore procedure.
- **SEC-06 (M)** Cookie consent banner (analytics/ads) **[CONFIRM jurisdiction]**.

---

## 5. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Performance | Cached article page TTFB < 200 ms at CDN; uncached API p95 < 300 ms for reads, < 600 ms for writes; LCP < 2.5 s on 4G |
| Scalability | Stateless API & web (horizontal scale); sessions in DB/Redis; jobs in BullMQ workers that can run as a separate process |
| Availability | 99.5% target for v1; graceful degradation when AI/payment/email providers fail |
| Security | OWASP ASVS L2 as the checklist; OWASP Top 10 mitigations documented in ARCHITECTURE §14 |
| Data integrity | All multi-row writes in DB transactions; money as `Decimal`; idempotency keys for payments; optimistic locking on articles |
| Observability | Structured JSON logs with request id; error tracking (Sentry); health/readiness endpoints; queue dashboard (admin only) |
| Accessibility | WCAG 2.1 AA on public site and dashboards |
| SEO | Valid structured data; sitemap & news sitemap; canonical URLs; no duplicate content |
| Browser support | Last 2 versions of Chrome, Edge, Firefox, Safari; iOS Safari 16+, Android Chrome |
| Testing | Unit tests for services/policies (≥ 70% lines in `apps/api/src/modules`), integration tests for every controller, Playwright E2E for critical flows (auth, submit→publish, ad checkout, subscription) |
| Maintainability | Modular monolith, Controller → Service → Repository, SOLID, strict TypeScript, lint + format in CI, conventional commits |
| Localisation | All UI strings through an i18n layer from day one (even if only English ships) |
| Time | Store UTC; display in site timezone (configurable) or user timezone in dashboards |

---

## 6. Key user journeys (acceptance scenarios)

1. **Contributor submits → published**: register → verify → (apply/get CONTRIBUTOR) → write draft with image → run AI self-check → submit → editor claims → requests changes with anchored note → contributor edits & resubmits → editor approves → chief editor schedules → article auto-publishes → contributor notified → article appears on home/category, in sitemap and RSS within 60 s.
2. **Advertiser campaign**: register → advertiser profile → create campaign (2 placements, 14 days, CPM, budget) → upload 2 creatives → pay → AD_MANAGER approves campaign, rejects 1 creative with reason → advertiser replaces creative → approved → ads serve on start date → daily stats visible → campaign auto-completes when budget is spent.
3. **Reader subscription**: hits premium article → sees teaser + paywall → subscribes (monthly) → returns to full article → renewal webhook extends period → cancels → access until period end.
4. **Moderation**: comment reported 3 times → auto-hidden (configurable threshold) → moderator reviews → spam → user comment-banned.
5. **Breaking news fast-track**: chief editor writes short update → fast-track publish → flagged "post-publish review" → editor reviews later.

---

## 7. Indicative delivery plan

Single full-stack developer using Claude Code with review gates. Estimates are indicative and depend on confirmed scope.

| Phase | Modules | Indicative effort |
|-------|---------|-------------------|
| 0 Foundation | M00 | 1 week |
| 1 Core publishing | M01, M02, M03, M04, M05, M06, M08, M14 (basic), M16 (basic) | 5–6 weeks |
| 2 Intelligence & community | M07, M09, M10, M15 | 3 weeks |
| 3 Monetisation | M11, M12 | 3–4 weeks |
| 4 Ops & polish | M13 (if confirmed), M16 (full), M17, M18 hardening, deployment | 2–3 weeks |
| **Total** | | **≈ 14–17 weeks** |

Each phase ends with a demo on staging and client sign-off before the next phase starts.
