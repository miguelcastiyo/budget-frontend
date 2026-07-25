# Frontend Health Audit

Status: Audit baseline  
Date: 2026-07-25

## Executive Summary

The frontend is coherent and production-buildable. Domain API modules, the shared API core, the app shell, responsive dialog primitives, and server-authoritative financial values are all established patterns. The current implementation is simpler than a global state/data library migration would be, but feature growth has produced several predictable pressure points.

The highest-value follow-up work is targeted rather than a rewrite:

- remove the duplicate Transactions reference/summary request;
- establish lightweight domain read/mutation conventions before adding more derived features;
- add interaction tests for Transactions, Funds, Savings Plan, and Month Closeout;
- define the privacy boundary for browser-readable CSRF state and third-party analytics;
- split the largest feature files only when changing those flows next.

No production code was changed during this audit. The existing identity, routes, API contract, and responsive model were preserved.

## Baseline

All available frontend checks passed on 2026-07-25:

- `npm test` — passed; includes typecheck and `scripts/smoke-budget-helpers.cjs`.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed with Next.js 16.1.6 and all current routes generated successfully.

The package exposes no component, integration, or end-to-end test script. The only checked-in automated test is the helper smoke script.

## Changes Implemented

No application changes were implemented as part of this audit. This report is the deliverable and intentionally separates evidence-backed findings from deferred refactors.

## State and Data-Fetching Findings

### Strengths

- Request, CSRF, credentials, blob/form-data, and API error handling are centralized in [`lib/api/core.ts`](../lib/api/core.ts).
- Domain endpoint ownership is split across modules under [`lib/api/`](../lib/api/), composed by [`lib/api/client.ts`](../lib/api/client.ts).
- Overview independently loads month overview and closeout data with `Promise.allSettled`, so an optional closeout failure does not discard the overview response ([`app/page.tsx`](../app/page.tsx)).
- Transactions keeps one in-memory filter model for mobile and desktop controls and explicitly revalidates loaded pages after mutation ([`app/transactions/page.tsx`](../app/transactions/page.tsx)). This preserves collection context better than a full reset.
- Savings Plan and Fund values use backend response fields rather than recreating accounting rules in the client.

### Findings

1. **Medium — Transactions makes a duplicate collection request.** `loadReferenceData()` requests `getTransactions({ page: 1, page_size: 1 })` only to derive `hasAnyTransactions`, while `loadTransactionsData()` immediately requests the first filtered page ([`app/transactions/page.tsx:216-224`](../app/transactions/page.tsx:216)). This adds a request and can produce inconsistent empty-state timing. Prefer a dedicated lightweight existence/summary field if the API already exposes one, or derive the empty-state decision from the primary response when semantics allow it.

2. **Medium — There is no shared server-state cache or canonical invalidation layer.** The app uses local `useEffect` loaders and local state; the only shared data hook currently added for Savings Plan still performs a request per mounted consumer ([`lib/savings-plan.ts`](../lib/savings-plan.ts)). This is workable for the current scale, but Funds, Fund Detail, Overview, closeout, and budget mutations can become stale independently. Do not migrate libraries speculatively; define domain-level read/mutation ownership and invalidation rules first, then introduce a small cache only where repeated reads are demonstrated.

3. **Low — Reference data is repeatedly loaded by independent surfaces.** Tags, Cards, Contexts, and suggestions are fetched in Transactions and again when the transaction sheet opens. This is currently understandable and keeps modal state local, but it is a candidate for a request cache or parent-owned reference-data loader once request traces show it matters.

4. **Low — Transactions has URL-derived filters plus local filter state.** URL parameters intentionally seed month/category/tag filters, while the complete active filter model remains local. This is acceptable for the current UX, but future deep-linking should either make the URL the canonical model or explicitly document that URL state is initialization-only.

5. **Good boundary — Financial calculations remain server-authoritative.** The frontend performs formatting, temporary draft totals, filtering composition, and display-only percentages, but does not replace backend Savings Plan, Fund balance, budget, or closeout calculations. Preserve this boundary.

## Performance Improvements

The only demonstrated request inefficiency found in this pass is the duplicate Transactions existence request described above. No bundle analyzer, browser profiler, or production network trace is checked in, so no claims are made about render-time or bundle-size gains.

The app does parallelize several independent initial loads. Large component files are a maintainability concern first; they should not be memoized or split solely on file length without a measured render problem.

Recommended next measurement: capture request counts and timing for Overview, Transactions, Funds, Fund Detail, and Savings Plan in a production-like session before introducing caching.

## Component / CSS Simplification

### Strengths

- Shared primitives exist for Amount Input, Month Selector, responsive dialogs, confirmation dialogs, transaction filters, context selection, bottom navigation, and error dialogs.
- Shell geometry is centralized through `.pb-mobile-nav` and the mobile navigation tokens in [`app/globals.css`](../app/globals.css).
- API modules and UI pattern documentation already discourage universal components with many modes.

### Findings

- **Medium — Feature orchestration files are very large:** `components/funds/funds-ui.tsx` (~1,887 lines), `components/budget/month-closeout-tray.tsx` (~1,367), `components/budget/add-transaction-sheet.tsx` (~1,132), and `components/budget/transaction-filters.tsx` (~678). This is not automatically a defect, but safe changes require more context than necessary. Extract route/feature-local sections next time those flows change; avoid a broad rewrite.
- **Low — `lib/api/types.ts` is a large cross-domain type module** (~1,174 lines). It is currently a stable public type surface. Split by domain only when ownership or generated-contract workflow requires it.
- The design-token direction is sound: light/dark tokens, shared radii/shadows, safe-area utilities, and reduced-motion handling are present. No broad CSS migration is justified by this audit.

## Accessibility Improvements

Positive evidence includes semantic links/buttons for navigation and actions, explicit labels on core amount fields, accessible names for navigation and icon-only controls, dialog primitives, progressbar semantics, focus-visible styles, and reduced-motion handling for the mobile navigation.

Remaining gaps:

- **Medium — No automated accessibility or interaction test harness exists.** Keyboard focus restoration, mobile tray behavior, screen-reader announcements, and collection-state preservation are not protected by tests.
- **Low — Accessibility requires manual browser verification** for the largest composite flows: transaction editor, transaction filters, month closeout, Funds, and Savings Plan. The code is generally using the correct primitives, but the audit did not run a browser/assistive-technology session.
- Continue checking that muted copy is not the only indicator of state and that sticky mobile form actions remain visible above the software keyboard.

## Responsive / Mobile Findings

The app follows the intended shared behavior model: bottom navigation owns its geometry, pages use `pb-mobile-nav`, the center Log control remains an action, and responsive dialogs/trays handle mobile versus desktop presentation. `globals.css` includes safe-area and installed-standalone handling, backdrop fallbacks, reduced motion, and high-contrast adjustments.

Remaining concern:

- **Low/medium — Installed-iOS behavior is documented but not covered by automated or recorded device checks.** Keyboard visibility, scroll padding, tray focus restoration, and final-content clearance should be manually verified at 320–390px widths and in standalone mode after substantial form changes.

No separate desktop product semantics or duplicated mobile/desktop filter state was found in the Transactions page; the desktop rail and mobile controls receive the same filter model.

## Privacy-Readiness Findings

This section inventories current exposure. It does not recommend client-side encryption or implement privacy architecture.

### Browser storage

- `budget.csrf_token` is stored in `localStorage` by [`lib/api/core.ts`](../lib/api/core.ts:4). It is also used as a client-side session hint by [`components/auth/auth-provider.tsx`](../components/auth/auth-provider.tsx:106). This is JavaScript-readable and should be part of the next privacy/security threat model. **Priority: medium.**
- `localStorage` also stores non-financial UI state: first-month progress dismissal, desktop transaction-filter collapse, add-transaction coachmark dismissal, and recent Context IDs. These values do not contain transaction amounts or descriptions. **Priority: low.**
- No IndexedDB, Cache Storage, or service-worker cache usage was found.

### Logging and third-party telemetry

- No application `console.log`/`console.debug` calls or full API-payload logging were found. The helper test script logs its pass/fail result only.
- No third-party analytics or telemetry provider is loaded by the frontend application shell.

### URLs and runtime exposure

- Invite and password-reset tokens are necessarily represented by route parameters, and sign-in accepts `invite_token` in the query string. URLs can enter browser history, screenshots, referrers, and operational logs. Confirm expiration, referrer policy, and post-consumption URL cleanup in the privacy/security review. **Priority: medium.**
- Month, category, tag, and settings flow parameters appear in query strings. These are identifiers/navigation state rather than transaction descriptions or amounts, but should remain free of sensitive free text.
- Financial data necessarily exists in React state and rendered DOM during normal authenticated use: transaction descriptions/notes, income/budget values, Fund names/balances, and Savings Plan values. This is expected browser exposure and should be included in the later threat model. **Priority: low as an observation; not a defect by itself.**

### Service worker and cache

- The app has a manifest and standalone metadata but no service worker or offline financial-data cache. This reduces stale-data/privacy-cache risk, but means there is no offline mode or explicit update strategy to audit. **Priority: low.**
- API calls use `fetch` with credentials and no frontend response persistence. Keep it that way unless an explicit privacy-aware cache policy is designed.

### Authentication material and security

- Authenticated API requests use `credentials: "include"`; mutation requests add the CSRF header from the shared client. 401 responses clear the stored CSRF token.
- No secrets are embedded in the inspected frontend code. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is a public OAuth client identifier by design, not a secret.
- No unsafe HTML injection, `postMessage`, or custom cookie handling was found in the frontend search.

## Dependency Findings

- Manifest dependencies are coherent for the current feature set: Next, React, Radix primitives, Lucide, date-fns, Recharts, and theme support.
- `npm ls --depth=0` reports multiple extraneous packages in the installed `node_modules` tree, including Radix packages, React Hook Form, and platform/build helpers that are not declared in `package.json`. This is an environment/install hygiene issue, not evidence that the app bundles them. **Priority: low.** Reinstall from the lockfile in CI and investigate only if reproducible from a clean install.
- No mass upgrades or dependency removals are justified without a clean-install and vulnerability review.

## Test Improvements

The helper smoke test is useful for pure budget/date/formatting logic, and all current checks pass. High-value missing coverage is interaction-level testing for:

1. Transactions create/edit/delete while preserving filters, search, sort, pagination, and Context/Tag/Card state.
2. Savings Plan no-plan, planned-versus-directed, unplanned Fund activity, and mutation refresh behavior.
3. Fund contributions and Fund Detail monthly context.
4. Month Closeout ready/closed/reopened/stale states and Fund allocations.
5. Dialog/tray focus, Escape, pending mutation, and safe-area behavior.

Add focused tests before adding a test framework-wide snapshot suite. A browser test runner is a deliberate dependency decision and was not introduced during this audit.

## Documentation Improvements

The existing [`docs/ui-patterns.md`](../docs/ui-patterns.md) is a strong base: it documents shell clearance, responsive trays, date helpers, feature-local structure, and API module ownership.

Add a short architecture section to that document or a dedicated frontend architecture document covering:

- server-derived financial values are authoritative;
- Transactions mobile and desktop controls share one filter model;
- URL filter parameters are initialization/deep-link state unless explicitly promoted;
- optional enrichment/reference data must not block the core flow;
- domain mutations must document affected surfaces and refresh behavior;
- privacy-sensitive values must not be put in logs or persistent browser storage.

The current feature docs cover most product behavior, but there is no documented query/cache convention because the frontend currently has no shared cache layer.

## Findings Not Changed

### Medium — Browser-readable CSRF persistence

**Problem:** CSRF state is stored in `localStorage` and doubles as a session hint.  
**Why unchanged:** Changing session/CSRF architecture requires coordination with backend cookie and auth behavior and is explicitly outside a health cleanup.  
**Next step:** Include it in the privacy/security threat model; evaluate an HttpOnly/server-managed approach or a narrowly scoped bootstrap mechanism.

### Medium — Global third-party telemetry — resolved

**Resolution:** No third-party analytics or telemetry provider is mounted in the frontend.

### Medium — No interaction/E2E coverage

**Problem:** Only helper-level tests are checked in; critical flows are not regression-protected.  
**Why unchanged:** Introducing a browser test runner is a project-level tooling decision, not a safe incidental cleanup.  
**Next step:** Add focused transaction and Savings Plan interaction coverage first.

### Medium — No shared server-state cache/invalidation convention

**Problem:** Feature loaders own local state and refetch independently, increasing stale-data and duplicate-request risk.  
**Why unchanged:** A migration to a query library or custom cache could introduce more complexity than it removes without request traces and defined invalidation rules.  
**Next step:** Measure repeated reads, document canonical read/write owners, then introduce the smallest cache needed for demonstrated duplication.

### Low — Large feature files

**Problem:** Funds, closeout, transaction entry, and filter implementations are large and have broad change surfaces.  
**Why unchanged:** Splitting them without a behavior change would create churn and risk hiding domain boundaries.  
**Next step:** Extract feature-local sections when each flow next receives functional work.

### Low — No service worker/update policy

**Problem:** Standalone PWA metadata exists, but offline/update behavior is unspecified.  
**Why unchanged:** Offline financial-data storage is explicitly a non-goal and would need a privacy design.  
**Next step:** Decide whether the product needs install/update affordances; do not add API caching casually.

## Current Technical Health

| Area | Rating | Assessment |
|---|---|---|
| Architecture | good | Clear app shell, domain API modules, and feature boundaries; a few large orchestration files remain. |
| Maintainability | needs attention | Large feature files and local async state make cross-surface changes harder to reason about. |
| State management | needs attention | Local state is understandable, but there is no shared server-state/cache convention. |
| Data fetching | needs attention | API ownership is clear, but Transactions has a duplicate request and feature-level refetches are independent. |
| Performance | good | Baseline build passes and independent loads are parallelized; only limited measurement exists. |
| Responsive implementation | good | Shared shell clearance, responsive trays, safe-area utilities, and shared filter behavior are established. |
| Accessibility | needs attention | Many low-level semantics are present, but there is no automated interaction/accessibility coverage or browser verification record. |
| Test confidence | needs attention | Type/lint/build/helper checks pass, but critical user workflows lack interaction tests. |
| Documentation | good | UI patterns and feature docs exist; query/invalidation/privacy conventions need to be added. |
| Privacy readiness | needs attention | Exposure is limited and no financial data cache/logging or third-party telemetry was found, but CSRF localStorage and token-bearing URLs need a dedicated review. |

## Recommended Order of Follow-Up

1. Add focused browser interaction tests for Transactions and Savings Plan/Funds.
2. Remove or justify the duplicate Transactions reference request.
3. Run a production-like network trace and define canonical domain invalidation rules.
4. Review CSRF storage and token-bearing URLs in the privacy/security threat model.
5. Split large feature files incrementally during normal feature work.

## Follow-Up Resolution

This section records the cleanup pass against the findings above without rewriting the historical audit.

### Duplicate Transactions request — resolved

The separate unfiltered `getTransactions({ page: 1, page_size: 1 })` existence request was removed from `app/transactions/page.tsx`. The primary transaction-list response now establishes account existence when the request is unfiltered. For an initially URL-filtered load where account existence is unknown, the UI uses the filtered-empty state rather than falsely claiming that the account has no transactions. Existing filter, search, sort, pagination, and mutation revalidation behavior remains local and intact.

### Read/mutation conventions — documented / intentional

Read ownership, server-authoritative financial values, targeted mutation refresh, collection-context preservation, optional data behavior, and the no-speculative-cache rule were added to [`docs/ui-patterns.md`](ui-patterns.md). No global cache, event bus, or state-management migration was introduced.

### Interaction-test foundation — resolved for initial coverage

Playwright is now configured in `playwright.config.ts` with an isolated development output directory and local browser-server workflow. `npm run test:interaction` runs the checked-in browser tests; `npm run test:interaction:headed` is available for local investigation.

### Critical workflow coverage — partially resolved

Initial Transactions coverage now protects the account-empty state, filtered-empty state, request-count cleanup, and URL-derived category filtering. Savings Plan/Funds/Month Closeout mutation workflows remain deferred for a follow-up coverage pass. The existing typecheck, lint, build, helper smoke, and interaction checks pass.

### CSRF persistence — documented / intentional

The token lifecycle and the reason for persistence are documented in [`docs/frontend-privacy-boundary.md`](frontend-privacy-boundary.md). The token remains in memory plus `localStorage`; changing that safely requires backend/session bootstrap coordination and belongs in the dedicated privacy/security review.

### Third-party telemetry — removed

The frontend no longer mounts or depends on a third-party analytics provider. No replacement was added.

### Token-bearing URLs — documented / intentional

Invite and password-reset token routes, the invite redirect, and the sign-in query flow are documented in the privacy boundary. URL cleanup was not forced because the active invite flow currently depends on the query token and moving it to persistent storage would be a worse privacy tradeoff. Expiration, single-use semantics, and referrer policy remain backend/security review items.

### Privacy-boundary documentation — resolved

[`docs/frontend-privacy-boundary.md`](frontend-privacy-boundary.md) inventories persistent browser keys, runtime/DOM exposure, CSRF lifecycle, logging rules, analytics, token URLs, and explicit non-goals. No financial data storage, service worker, offline cache, or encryption was added.

### Original finding status

| Audit finding | Status |
|---|---|
| Duplicate Transactions existence request | resolved |
| Shared server-state cache/invalidation convention | documented / intentional; cache deferred |
| Repeated reference-data reads | documented / intentional; request caching deferred until measured |
| URL-derived plus local transaction filter state | documented / intentional |
| Large feature files | deferred |
| Limited interaction/accessibility test coverage | partially resolved; Transactions covered, broader workflows deferred |
| Browser-readable CSRF persistence | documented / intentional |
| Global third-party telemetry | resolved; provider removed |
| Token-bearing auth URLs | documented / intentional |
| No service worker/offline financial cache | documented / intentional; do not add |
