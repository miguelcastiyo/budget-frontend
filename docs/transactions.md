# Transactions Page

## Expense List Metadata
- In the transaction list, each row now visually distinguishes metadata with chips.
- `Tag` is shown as a chip with tag icon + tag name.
- `Card` is shown as a chip with card icon + card name (when present).
- On compact list contexts, metadata remains condensed as inline text to preserve density.

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
- Search, date range, category, tag, card, and split filters are now pushed down to the API before rendering the list.
- CSV export reuses the same active transaction filters, including free-text search.
- Shared date-range parsing/formatting now lives in `lib/date-filters.ts` and is reused across Dashboard, Transactions, and Insights.
- Applies to both interactive and read-only list row rendering.
