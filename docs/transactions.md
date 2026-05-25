# Transactions Page

## Expense List Metadata
- In the transaction list, each row now visually distinguishes metadata with chips.
- `Tag` is shown as a chip with tag icon + tag name.
- `Card` is shown as a chip with card icon + card name (when present).
- On compact list contexts, metadata remains condensed as inline text to preserve density.

## Pagination And Summary Stats
- The page loads the first 50 matching transactions, then uses `Load More` to append additional pages.
- Stats cards use the API `summary` object from `GET /api/v1/me/transactions`, so totals reflect the full filtered result set instead of only loaded rows.
- Filter, search, sort, import, create, update, and delete actions refresh from page 1 to keep the loaded rows and summary aligned.
- The footer shows how many matching rows are loaded out of `total_items`.

## CSV Import And Export
- CSV import accepts backend response statuses `completed`, `partial`, and `failed`.
- Partial and failed imports show the backend-provided message plus the first 8 returned row errors.
- Backend import guardrails enforce file size, data-row count, and returned-error limits before commit writes occur.
- CSV export reuses the active transaction filters; the backend streams rows and escapes spreadsheet formula prefixes in exported cell values.

## Collapsible Desktop Filters
- The left filters panel on desktop can now be collapsed into a slim icon rail.
- When collapsed, the transactions content area expands to use the freed space.
- Clicking the tab re-expands the filters panel.
- The collapse control appears inline with the search row (left of search) to match desktop sidebar-toggle behavior.
- Collapse state is persisted in `localStorage` (`transactions-desktop-filters-collapsed`) per browser.
- Mobile behavior is unchanged: filters remain fully visible in-page.

## Add Transaction Discoverability
- The floating CTA now uses explicit text (`Add Transaction`) instead of icon-only styling.
- On mobile, the floating CTA is compact icon-only (`+`) to preserve screen space; desktop keeps the text label.
- First-time users get a dismissible coachmark pointing to the CTA.
- Empty transaction states include a primary `Add Transaction` action so users can start immediately.

## Add Transaction Amount Input
- Amount entry accepts both whole numbers and decimals (for example, `20` and `20.50`).
- On submit, frontend normalizes valid amounts to 2-decimal format before API requests.

## Notes
- Header and bottom navigation links to Transactions include the current month query (`/transactions?month=YYYY-MM`) so normal navigation loads a bounded month-sized result set by default.
- Search, date range, category, tag, card, split filters, and pagination are pushed down to the API before rendering the list.
- Shared date-range parsing/formatting now lives in `lib/date-filters.ts` and is reused across Dashboard, Transactions, and Insights.
- Applies to both interactive and read-only list row rendering.
