# apps/web — Next.js 16 · React 19 · Tailwind 4 · shadcn/ui

Root rules in `/CLAUDE.md` apply. Architecture: `docs/ARCHITECTURE.md §12, §18`.

## Next.js 16 specifics (do not regress to v14/15 patterns)

- Route protection lives in **`src/proxy.ts`** exporting `function proxy(request)` (Node runtime). `middleware.ts` is deprecated — do not create it.
- `params`, `searchParams`, `cookies()`, `headers()` are async — always `await` them.
- Turbopack is the default bundler; `next lint` is gone — use the ESLint CLI via `pnpm lint`.
- Caching: pick ONE approach at bootstrap and record it in `docs/DECISIONS.md` — either `fetch(..., { next: { tags } })` + `revalidateTag(tag, 'max')`, or Cache Components (`cacheComponents: true`, `'use cache'`, `cacheTag`, `cacheLife`). Check the installed version's docs before writing caching code.
- Parallel route slots need explicit `default.tsx`.

## Data access

- **Server (RSC, route handlers, server actions):** `lib/api/server.ts` → `apiServer<T>(path, { tags?, revalidate?, withCookies? })`. Uses `API_INTERNAL_URL`. Public pages call it **without** cookies (cacheable). Personalised calls pass `withCookies: true` (dynamic).
- **Browser:** `lib/api/client.ts` → same-origin `/api/v1/...`, `credentials: 'include'`, adds `X-CSRF-Token` from the `nr_csrf` cookie on mutations, on `401` performs one single-flight `POST /api/v1/auth/refresh` then retries once; on failure redirects to `/login?next=`.
- Errors are parsed into `ApiError` (RFC 9457 problem details). Forms map `error.errors[]` to fields with `setError`.
- Types come from `@newsroom/contracts` (`z.infer`). Never hand-write API types.

## Feature folder pattern

```
src/features/articles/
├── api.ts            # query keys factory + useArticles(), useArticle(id), useUpdateArticle() …
├── components/       # ArticleTable, ArticleStatusBadge, ArticleForm …
├── hooks/            # useAutosave, useEditLock
└── utils/
```
Query keys: `articleKeys = { all: ['articles'] as const, list: (f) => [...articleKeys.all, 'list', f] as const, detail: (id) => [...articleKeys.all, 'detail', id] as const }`. Mutations invalidate the narrowest keys.

## UI rules

- Server Components by default; `'use client'` only where needed (forms, editor, tables, charts, AdSlot, beacons, menus with state).
- Use shadcn/ui primitives from `components/ui`. **All form inputs go through the reusable `components/form/*` wrappers** (label, description, error, required marker, RHF binding). No raw `<input>` in feature code.
- Every list page: `<DataTable>` with URL-synced pagination/sort/filters, loading skeleton, empty state, error state.
- Every page: `generateMetadata` (public) or a static `metadata` title (dashboards). Dashboards/admin are `noindex`.
- Design tokens as CSS variables in `styles/globals.css` (light + dark). No hard-coded colours in components.
- Images: `next/image` with the media loader (`lib/media/loader.ts`) and explicit `sizes`. Alt text always.
- Text through `next-intl` (`useTranslations` / `getTranslations`) — no hard-coded user-facing strings.
- Permission-aware UI: `<Can permission="…">` / `useCan()`; hide or disable actions the user cannot perform, but never rely on it for security.
- Accessibility: keyboard reachable, focus visible, `aria-*` on custom widgets, form errors announced.

## Public site specifics

- Article page renders the **teaser** in the cached HTML for MEMBERS/PREMIUM content; `<ArticleAccessGate>` (client) fetches the full body for entitled users.
- `<AdSlot placement="article_inline_1" />` is a client component: fetches `/api/v1/p/serve`, renders, fires the viewable-impression beacon once (≥ 50% for ≥ 1 s), uses `/api/v1/p/c/:token` for clicks, reserves height to avoid layout shift.
- `<ViewBeacon articleId />` sends one `sendBeacon` after 5 s visible.
- JSON-LD via `lib/seo/json-ld.ts` builders rendered in a `<script type="application/ld+json">`.

## Testing

- Vitest + Testing Library for hooks, utils and complex components (`*.test.tsx` next to the file).
- Playwright in `apps/web/e2e/` for journeys in REQUIREMENTS §6; seed data via API helper, never via UI clicks in `beforeAll`.
