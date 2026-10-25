# Newsroom Platform — API Specification (v1 inventory)

Base URL: `/api/v1` · Conventions: `docs/ARCHITECTURE.md §19` · Errors: RFC 9457 problem details.
Request/response Zod schemas live in `packages/contracts/src/<module>/` and are named `<Action><Resource>Schema` / `<Resource>ResponseSchema` (e.g. `CreateArticleSchema`, `ArticleDetailResponseSchema`).

**Legend** — Auth: `public` (no login), `user` (any logged-in user), or a permission key. "own" = ownership checked by policy.

---

## Auth (M01) — `auth`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | public | `{ name, email, password }` → 201; sends verification email. Rate-limited |
| POST | `/auth/verify-email` | public | `{ token }` |
| POST | `/auth/resend-verification` | user | rate-limited |
| POST | `/auth/login` | public | `{ email, password }` → sets cookies, returns `{ user }` or `{ requires2fa, challengeToken }` |
| POST | `/auth/2fa/verify` | public | `{ challengeToken, code }` (TOTP or recovery code) |
| POST | `/auth/refresh` | public (refresh cookie) | rotates refresh, sets cookies |
| POST | `/auth/logout` | user | revoke current token family |
| POST | `/auth/logout-all` | user | revoke all families |
| POST | `/auth/forgot-password` | public | `{ email }` → always 202 |
| POST | `/auth/reset-password` | public | `{ token, password }` |
| POST | `/auth/change-password` | user | `{ currentPassword, newPassword }` |
| POST | `/auth/change-email` | user | `{ newEmail, password }` → verification to new email |
| GET | `/auth/me` | user | `{ user, roles, permissions, entitlements }` |
| GET | `/auth/csrf` | public | sets `nr_csrf` cookie, returns token |
| GET | `/auth/sessions` | user | active refresh families (device, ip, lastUsedAt) |
| DELETE | `/auth/sessions/:familyId` | user (own) | revoke one |
| GET | `/auth/google` | public | redirect to Google |
| GET | `/auth/google/callback` | public | sets cookies, redirects to web |
| POST | `/auth/2fa/setup` | user | returns otpauth URL + QR data URL |
| POST | `/auth/2fa/enable` | user | `{ code }` → returns recovery codes once |
| POST | `/auth/2fa/disable` | user | `{ password, code }` (blocked if role requires 2FA) |

## Users, roles, profiles (M02) — `users`, `rbac`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET/PATCH | `/me/profile` | user | name, username, bio, avatarUrl, locale, timezone |
| GET/PUT | `/me/author-profile` | article.create | pen name, designation, long bio, social links |
| GET | `/me/export` | user | JSON export of my data (async → email link if large) |
| DELETE | `/me` | user | `{ password }` → anonymise account |
| POST | `/me/contributor-application` | user | `{ motivation, sampleLinks[] }` |
| GET | `/admin/contributor-applications` | user.manage | filter by status |
| POST | `/admin/contributor-applications/:id/decision` | user.manage | `{ decision: APPROVED\|REJECTED, note }` → grants CONTRIBUTOR |
| GET | `/admin/users` | user.view | `?q&role&status&page&pageSize&sort` |
| GET | `/admin/users/:id` | user.view | details + roles + stats |
| PATCH | `/admin/users/:id/status` | user.manage | `{ status, reason }` (suspend revokes sessions) |
| PUT | `/admin/users/:id/roles` | user.manage | `{ roleKeys[] }` (SUPER_ADMIN role only by SUPER_ADMIN) |
| PATCH | `/admin/users/:id/comment-ban` | comment.moderate | `{ until \| null }` |
| GET | `/admin/roles` | role.manage | roles + permission keys |
| POST | `/admin/roles` | role.manage | custom role |
| PUT | `/admin/roles/:id/permissions` | role.manage | `{ permissionKeys[] }` |
| DELETE | `/admin/roles/:id` | role.manage | non-system only, no users assigned |
| GET | `/admin/permissions` | role.manage | grouped by module |
| GET | `/public/authors/:username` | public | public author profile |

## Taxonomy (M03) — `taxonomy`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/public/categories` | public | active tree (cached, tag `categories`) |
| GET | `/public/tags/:slug` | public | |
| GET | `/categories` | article.create | full list incl. inactive for pickers |
| POST/PATCH/DELETE | `/admin/categories[/:id]` | category.manage | delete blocked if articles reference it |
| PATCH | `/admin/categories/reorder` | category.manage | `[{ id, parentId, sortOrder }]` |
| GET | `/tags?q=` | article.create | typeahead |
| POST | `/tags` | tag.create | create from editor |
| PATCH/DELETE | `/admin/tags/:id` | tag.manage | |
| POST | `/admin/tags/:id/merge` | tag.manage | `{ intoTagId }` |

## Media (M04) — `media`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/media/uploads` | media.upload | `{ fileName, mimeType, sizeBytes, kind }` → `{ mediaId, uploadUrl, headers, expiresAt }` |
| POST | `/media/:id/complete` | media.upload (own) | verifies object, queues processing |
| GET | `/media` | media.upload | own assets; `media.manage.any` sees all. `?kind&q&uploaderId&page` |
| GET | `/media/:id` | media.upload (own/any) | includes `usage` (articles/creatives) |
| PATCH | `/media/:id` | media.upload (own/any) | altText, caption, credit |
| DELETE | `/media/:id` | media.upload (own/any) | soft delete; 409 if in use |

## Articles (M05) — `articles`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/articles` | article.create | creates DRAFT (title required, content optional) |
| GET | `/articles` | article.create | own articles; `article.review` → any. `?status&categoryId&authorId&q&page&sort` |
| GET | `/articles/:id` | own / article.review | full editable model + permissions hints `{ can: { edit, submit, … } }` |
| PATCH | `/articles/:id` | own / article.update.any | `{ version, title?, subtitle?, excerpt?, content?, categoryId?, tagIds?, featuredImageId?, type?, visibility?, seo…, coAuthorIds? }` → 409 on version conflict |
| DELETE | `/articles/:id` | article.delete.own (DRAFT only) / article.delete.any | soft delete |
| POST | `/articles/:id/lock` | can edit | acquire / heartbeat |
| DELETE | `/articles/:id/lock` | lock holder | release |
| POST | `/articles/:id/lock/takeover` | article.update.any | audited |
| GET | `/articles/:id/revisions` | can view | list |
| GET | `/articles/:id/revisions/:revId` | can view | snapshot |
| GET | `/articles/:id/revisions/:revId/diff?against=` | can view | HTML/text diff |
| POST | `/articles/:id/revisions` | can edit | manual "save version" `{ changeNote }` |
| POST | `/articles/:id/revisions/:revId/restore` | can edit | creates RESTORE revision |
| POST | `/articles/:id/preview-token` | can view | `{ url, expiresAt }` |
| POST | `/articles/:id/corrections` | article.update.any | `{ note }` public correction (PUBLISHED only) |
| GET | `/articles/slug-availability?slug=` | article.create | |

## Editorial workflow (M06) — `workflow`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/articles/:id/transitions` | per action (§8.1) | `{ action, note?, assigneeId?, dueAt?, scheduledAt?, acknowledgeCriticalFindings?, version? }` → updated article + transition |
| GET | `/articles/:id/transitions` | can view | audit trail |
| GET | `/articles/:id/available-actions` | can view | actions allowed for current user (drives action bar) |
| GET | `/editorial/queue` | dashboard.editorial | `?view=unassigned\|mine\|all\|overdue&status&categoryId&authorId&page&sort` |
| GET | `/editorial/calendar?from&to` | article.schedule | scheduled + published |
| GET | `/articles/:id/assignments` | can view | |
| GET | `/articles/:id/notes` | can view | INTERNAL notes only for editors |
| POST | `/articles/:id/notes` | can view (author: AUTHOR visibility replies only) | `{ body, parentId?, anchor?, visibility }` |
| PATCH | `/articles/:id/notes/:noteId` | note author | edit body |
| POST | `/articles/:id/notes/:noteId/resolve` | editor or article owner | toggle `{ resolved }` |
| DELETE | `/articles/:id/notes/:noteId` | note author | soft delete |

## AI review (M07) — `ai-review`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/articles/:id/ai-reviews` | ai.review.run.own (own) / ai.review.run.any | manual run → 202 `{ aiReviewId }`; 402 `AI_BUDGET_EXCEEDED`, 429 daily limit |
| GET | `/articles/:id/ai-reviews` | can view | history (latest first) |
| GET | `/ai-reviews/:id` | can view article | review + findings + suggestions |
| PATCH | `/ai-reviews/:id/findings/:findingId` | can edit or article.review | `{ status: ACCEPTED\|DISMISSED }` |
| GET | `/admin/ai/usage?from&to` | ai.settings.manage | tokens, cost by model/day, budget status |
| GET/PUT | `/admin/ai/settings` | ai.settings.manage | enabled checks, style guide, budget, limits, models |

## Public content (M08) — `public-content` (all `public`, cache-friendly)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/public/home` | breaking, featured, latest, per-category blocks, editor's picks |
| GET | `/public/articles?category&tag&author&type&cursor&limit` | feed (cursor) |
| GET | `/public/articles/by-slug/:slug` | article teaser/full per access + `{ access, requires }`, or `{ redirectTo }` |
| GET | `/public/articles/:id/body` | user-dependent full body for MEMBERS/PREMIUM (credentials) |
| GET | `/public/articles/:id/related` | |
| GET | `/public/articles/most-read?window=24h\|7d` | |
| POST | `/public/articles/:id/view` | beacon, 204 |
| GET | `/public/pages/:slug` | CMS page |
| GET | `/public/menus/:key` | |
| GET | `/public/settings` | `isPublic` settings (site name, logo, social, paywall teaser size…) |
| GET | `/public/sitemap/articles?page=` | data for sitemap route handlers |
| GET | `/public/sitemap/news` | last 48 h |
| GET | `/public/preview/:token` | draft preview payload |

## Engagement (M09) — `engagement`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/public/articles/:id/comments?cursor` | public | approved only (+ own pending if logged in) |
| POST | `/articles/:id/comments` | comment.create (verified, not banned) | `{ body, parentId? }` |
| PATCH | `/comments/:id` | own, within 15 min | |
| DELETE | `/comments/:id` | own / comment.moderate | |
| POST | `/comments/:id/like` / DELETE | user | toggle |
| POST | `/comments/:id/reports` | report.create | `{ reason, details? }` |
| GET | `/moderation/comments?status&page` | comment.moderate | queue |
| POST | `/moderation/comments/:id/decision` | comment.moderate | `{ status: APPROVED\|REJECTED\|SPAM, note? }` |
| GET | `/moderation/reports?status` | comment.moderate | |
| POST | `/moderation/reports/:id/resolve` | comment.moderate | `{ status: RESOLVED\|DISMISSED }` |
| PUT/DELETE | `/articles/:id/reaction` | user | `{ type }` |
| GET | `/me/bookmarks` · PUT/DELETE `/articles/:id/bookmark` | user | |
| GET | `/me/following` · PUT/DELETE `/authors/:userId/follow` · `/categories/:id/follow` | user | |
| GET | `/me/feed?cursor` | user | articles from followed authors/categories |
| POST | `/public/newsletter/subscribe` | public | `{ email, categories?, source }` → double opt-in email |
| POST | `/public/newsletter/confirm` | public | `{ token }` |
| POST | `/public/newsletter/unsubscribe` | public | `{ token }` (one-click) |
| GET | `/admin/newsletter/subscribers?status&page` · GET `/admin/newsletter/export.csv` | settings.manage | |

## Search (M10) — `search`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/public/search?q&category&tag&author&type&from&to&page` | public | results with highlighted snippets |
| GET | `/public/search/suggest?q` | public | typeahead (≤ 8) |
| GET | `/search/articles?q&status…` | article.review | dashboard search across statuses |

## Advertising (M11) — `ads`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET/PUT | `/me/advertiser` | advertiser.self | create/update advertiser profile (→ PENDING) |
| GET | `/ads/placements` | advertiser.self | active placements + rate card |
| GET | `/ads/campaigns?status&page` | ad.campaign.manage.own (own) / any | |
| POST | `/ads/campaigns` | ad.campaign.manage.own (advertiser ACTIVE) | DRAFT |
| GET/PATCH/DELETE | `/ads/campaigns/:id` | own (DRAFT/REJECTED editable) | |
| POST | `/ads/campaigns/:id/quote` | own | price estimate for budget/dates/pricing model |
| POST | `/ads/campaigns/:id/submit` | own | → PENDING_PAYMENT (or PENDING_REVIEW if house/invoiced) |
| POST | `/ads/campaigns/:id/checkout` | own, `Idempotency-Key` | → `{ paymentId, redirectUrl }` |
| POST | `/ads/campaigns/:id/pause` · `/resume` · `/cancel` | own / any | lifecycle service |
| POST/PATCH/DELETE | `/ads/campaigns/:id/creatives[/:creativeId]` | own | edits reset to PENDING_REVIEW |
| GET | `/ads/campaigns/:id/stats?from&to&groupBy=day\|placement\|creative` | own / ad.report.view.any | + CSV `?format=csv` |
| GET | `/admin/ads/advertisers?status` · PATCH `/admin/ads/advertisers/:id/status` | ad.campaign.review | |
| GET | `/admin/ads/review-queue` | ad.campaign.review | campaigns + creatives pending |
| POST | `/admin/ads/campaigns/:id/decision` | ad.campaign.review | `{ decision, reason? }` (reject ⇒ refund flow) |
| POST | `/admin/ads/creatives/:id/decision` | ad.campaign.review | |
| POST | `/admin/ads/campaigns` | ad.campaign.manage.any | house/direct-sold campaign |
| CRUD | `/admin/ads/placements[/:id]` | ad.placement.manage | |
| GET | `/admin/ads/reports?from&to&groupBy` | ad.report.view.any | |
| GET | `/p/serve?placement&category&lang` | public | serving (204 = no fill) |
| POST | `/p/i` | public | impression beacon `{ token }` |
| GET | `/p/c/:token` | public | click redirect |

## Billing (M12) — `billing`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/public/plans` | public | active plans |
| POST | `/billing/subscriptions/checkout` | subscription.self, `Idempotency-Key` | `{ planKey }` → `{ redirectUrl }` |
| GET | `/me/subscription` | user | current + entitlements |
| POST | `/me/subscription/cancel` | user | at period end |
| POST | `/me/subscription/resume` | user | before period end |
| GET | `/me/subscription/portal` | user | gateway portal URL (if supported) |
| GET | `/billing/payments/:id` | own / payment.view.any | status polling after checkout |
| GET | `/me/payments` · `/me/invoices` | user | history |
| GET | `/me/invoices/:id/pdf` | own / invoice.view.any | signed URL redirect |
| POST | `/billing/webhooks/:provider` | public (signature) | raw body; 200 fast |
| GET | `/admin/billing/payments?status&purpose&provider&from&to&q` | payment.view.any | + CSV |
| POST | `/admin/billing/payments/:id/refunds` | payment.refund | `{ amount, reason }` |
| GET | `/admin/billing/invoices` | invoice.view.any | |
| CRUD | `/admin/billing/plans[/:id]` | plan.manage | deactivate instead of delete when used |
| GET | `/admin/billing/webhook-events?status` · POST `/:id/replay` | payment.view.any | |

## Payouts (M13) — `payouts` [CONFIRM]

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/me/payouts` | payout.view.own | history + pending estimate |
| GET | `/admin/payouts?status&period` | payout.manage | |
| POST | `/admin/payouts/generate` | payout.manage | `{ periodStart, periodEnd }` → PENDING payouts with items |
| POST | `/admin/payouts/:id/approve` · `/reject` · `/mark-paid` | payout.manage | mark-paid `{ method, reference, paidAt }` |

## Notifications (M14) — `notifications`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/notifications?cursor&unreadOnly` | user | |
| GET | `/notifications/unread-count` | user | |
| POST | `/notifications/:id/read` · `/notifications/read-all` | user | |
| GET/PUT | `/me/notification-preferences` | user | `[{ type, channel, enabled }]` (mandatory types ignored) |
| GET | `/admin/email-logs?status&to&page` | settings.manage | |

## Dashboards (M15) — `dashboards`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/dashboards/me` | user | widgets for the user's roles (server decides which blocks) |
| GET | `/dashboards/author` | article.create | counts by status, action needed, views 30 d |
| GET | `/dashboards/editorial` | dashboard.editorial | queue counts, overdue, today's schedule, AI critical flags |
| GET | `/dashboards/advertiser` | advertiser.self | active campaigns, spend vs budget, 30-day trend |
| GET | `/dashboards/admin` | dashboard.admin | KPIs + system status |

## Site admin (M16) — `site`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/admin/settings?group` | settings.manage | |
| PUT | `/admin/settings/:group` | settings.manage | strict Zod schema per group; audit diff; revalidate if public |
| CRUD | `/admin/pages[/:id]` · POST `/admin/pages/:id/publish` | page.manage | |
| GET/PUT | `/admin/menus/:key` | menu.manage | |
| GET | `/admin/articles?…` · POST `/admin/articles/bulk` | article.update.any | bulk `{ ids[], op: ARCHIVE\|FEATURE\|UNFEATURE\|SET_CATEGORY, value? }`; ARCHIVE also needs article.unpublish, FEATURE/UNFEATURE need article.feature; ARCHIVE goes through WorkflowService per article |
| DELETE | `/admin/articles/:id/hard` | article.delete.any | SUPER_ADMIN, purge |
| GET | `/admin/system/status` | dashboard.admin | queues, failed jobs, last cron runs, storage usage |
| — | `/admin/queues` | dashboard.admin | Bull Board UI |

## Analytics & reports (M17) — `analytics`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/reports/content?from&to&groupBy=day\|category\|author` | report.view | views, top articles |
| GET | `/reports/editorial?from&to` | report.view | submissions, approval rate, avg review time, per editor |
| GET | `/reports/revenue?from&to` | report.view | ads + subscriptions, MRR, churn, refunds |
| GET | `/reports/ads?from&to&groupBy` | ad.report.view.any | |
| GET | `/me/stats/articles?from&to` | article.create | own article views |
| * | any report `?format=csv` | same | streamed CSV |

## Audit & health (M18)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/admin/audit-logs?actorId&action&entityType&entityId&from&to&page` | audit.view | read-only |
| GET | `/health/live` · `/health/ready` | public | no envelope |
