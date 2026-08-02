# UI Patterns

Status: Current  
Last reviewed: 2026-06-13

This document tracks shared frontend patterns that should be reused before adding page-specific UI plumbing.

## Responsive Dialog / Tray

Use `components/ui/responsive-dialog.tsx` for modal flows that should behave as:

- a bottom tray on mobile and iOS Home Screen web app mode
- a centered modal on desktop
- a scrollable body with fixed header and optional fixed footer
- swipe-dismiss on mobile using the existing `useSwipeDismiss` hook
- safe-area-aware footer spacing for iOS
- the standard drag handle and close button

Mobile size modes:

- `mobileSize="full"` for longer forms and multi-step flows that should claim a full working surface on mobile.
- `mobileSize="compact"` for short forms and lightweight detail trays that should hug content and only grow taller when needed.

Current users:

- Settings -> Budget edit flow
- Settings -> Data Import CSV flow
- Settings -> Recurring create/edit flows
- Settings -> Recurring detail flow
- Settings profile edit flow
- Settings -> Tags create/edit flows
- Settings -> Invites create flow

## Mobile Bottom Navigation

`components/layout/bottom-nav.tsx` owns the five-position mobile navigation: Overview, Transactions, Log, Insights, and Settings. Destination items are links with route-aware `aria-current` state; Log is an action button that opens the existing transaction tray and never changes the route.

The nav is a floating, safe-area-aware glass surface on mobile only. Its geometry and fallback/glass tokens live in `app/globals.css`; pages use the shared `pb-mobile-nav` utility for content clearance instead of reserving a page-specific footer height. The surface uses CSS `@supports` for backdrop-filter enhancement, with solid light/dark fallbacks for browsers without it. Modal and tray layers remain above the nav at the existing z-index level. The center Log action remains the strongest visual anchor, while destination active indicators stay intentionally quiet and inactive icon weights remain balanced.

## Responsive Confirmation Dialog / Tray

Use `components/ui/responsive-confirm-dialog.tsx` for destructive or confirm/cancel flows that should behave as:

- a bottom tray on mobile and iOS Home Screen web app mode
- a centered modal on desktop
- a fixed header and safe-area-aware footer
- guarded dismissal while a destructive action is pending

Current users:

- Settings -> Cards remove confirmation
- Settings -> Tags remove confirmation
- Settings -> Recurring delete confirmation
- Settings -> Data import rollback confirmation

Use page-specific `DialogContent` or `SheetContent` directly only when the layout does not fit the header/body/footer model or when a component already has a specialized interaction contract.

## Notes

- Keep business logic in the page or feature component; `ResponsiveDialog` should only own layout, scroll, close, and mobile tray behavior.
- Keep destructive mutation logic in the page or feature component; `ResponsiveConfirmDialog` should only own presentation and dismissal behavior.
- Prefer passing existing footer actions into the shell instead of duplicating sticky footer classes.
- Prefer `mobileSize="compact"` for short create/edit/detail flows where the content would otherwise leave large empty vertical space.
- If a future iOS tray issue appears, fix the shell first and then audit remaining direct modal implementations.

## Date Helpers

Use shared helpers from `lib/date-filters.ts` for UI-facing date parsing and display instead of page-local `new Date(...)` formatting.

- Use `parseIsoDate` for strict `YYYY-MM-DD` values.
- Use `parseDateValue` when the backend can return either date-only or timestamp values.
- Use `parseMonthKey` and `formatMonthValue` for `YYYY-MM` month keys.
- Use `formatDateValue` and `formatDateTimeValue` for display strings so date-only values stay local-calendar-safe.

This keeps month keys, transaction dates, import/export timestamps, and settings screens on one parsing path and avoids timezone drift from ad hoc browser parsing.

## Feature Structure

When a route grows beyond simple page orchestration, extract feature-local modules next to the route instead of keeping domain helpers and presentational sections inside `page.tsx`.

- Put shared presentational pieces in `_components/`.
- Put route-specific state loaders or async orchestration helpers in `_hooks/`.
- Put feature constants, pure helpers, and flow utilities in `_lib/`.

The route file should stay focused on composing state, handlers, and top-level layout.

## API Modules

Keep frontend API code split by domain under `lib/api/` instead of adding every endpoint to one file.

- Keep request, CSRF, blob/form-data, and error handling in a shared core module.
- Add domain modules such as `auth`, `profile`, `transactions`, `recurring`, or `import-export` for endpoint groups.
- Keep `lib/api/client.ts` as the stable composition layer that assembles the exported `apiClient`.

This keeps endpoint ownership clear and reduces churn when one feature area changes.

## Data Ownership and Mutation Refresh

- Backend-derived financial values are authoritative. Frontend code may format values and calculate temporary draft feedback, but should not recreate accounting, budget, Fund, Savings Plan, or closeout rules.
- Each feature should have an identifiable canonical read path. Keep endpoint ownership in `lib/api/` and keep page/feature loaders responsible for composing the data they present.
- A mutation should explicitly refresh the surfaces whose server state changed. Do not blanket-reload the application or introduce a global event bus for local changes.
- Transactions mutations preserve the current collection context: filters, search, sort, loaded page depth, and selected month/date state should survive edits and deletes where the current UX supports it.
- Mobile and desktop controls may render differently, but they must share state and semantics. URL parameters currently seed/deep-link selected transaction filters; the page-local filter model remains the active source of truth after initialization.
- Optional enrichment/reference data must not block the core action when the core response is available.
- Do not add shared server-state caching until repeated reads and affected-surface invalidation rules are demonstrated and documented.

## Privacy-Sensitive Frontend Behavior

- Do not add financial or user data to persistent browser storage without an explicit privacy/security design.
- Do not log authentication material, complete API payloads, transaction descriptions/notes, income, Fund names/balances, or Savings Plan data.
- Third-party telemetry on authenticated routes must be understood and intentionally approved before it is treated as privacy-safe.
