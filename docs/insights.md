# Insights

Status: Active  
Last reviewed: 2026-06-07

## UX Overview

Insights is a spending review page, not a generic analytics dashboard. It should feel like a calm monthly or range-based financial notebook entry.

Funds now lives as a linked companion surface inside Insights, not as another analytics section. The Insights page includes a small Funds card that routes to `/insights/funds` for savings-goal and reserved-money workflows.

The page answers:

- How much did I spend?
- Did I follow my budget?
- Where did the money go?
- What patterns stand out?
- What transactions should I review?

It can also hand off to Funds when the user wants to move from spending review into goal progress or fund-ledger actions.

The experience is mobile-first. Desktop adds a supporting right column, but the main column still reads like a spending story rather than a metric grid.

## Data Source

Primary endpoint:

```text
GET /me/metrics/insights?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

Required query params:

- `date_from`
- `date_to`

UI section mapping:

- `total_spend` -> Snapshot
- `total_transactions` -> Snapshot
- `category_budget_vs_actual` -> Budget check-in
- `tag_breakdown` -> Where the money went
- `monthly_spend_trend` -> Spending rhythm
- `recurring_vs_variable` -> Fixed vs flexible
- `day_of_week_spend` -> Spending habits
- `largest_transactions` -> Notable spending

The frontend does not require backend changes for the current version.

## Design Direction

Insights follows the modern financial notebook direction used across Settings, Budget, Recurring, Data Import / Export, and transaction detail sheets.

Use:

- Rows, summaries, and quiet bars over chart-heavy dashboards.
- Warm paper-like surfaces.
- Muted supporting text.
- Subtle dividers.
- Existing icon and typography patterns.
- Human copy such as "You spent", "Budget check-in", and "Where the money went".

Avoid:

- Generic KPI grids.
- Default chart-library styling.
- Bright SaaS dashboard colors.
- Donut charts as the main storytelling device.
- Dense admin-table layouts.

## Layout

Mobile order:

1. Header and range selector
2. Snapshot
3. Budget check-in
4. Where the money went
5. Fixed vs flexible
6. Spending rhythm
7. Spending habits
8. Notable spending

Desktop layout:

- Main column: Snapshot, Budget check-in, Where the money went, Spending rhythm, Notable spending.
- Secondary column: Range summary, Fixed vs flexible, Spending habits.

The desktop layout should use available width intentionally without duplicating metrics or becoming a generic dashboard.

## Range Selector

Supported presets:

- This Month
- Last Month
- 3M
- 6M
- YTD
- Custom

Changing a preset immediately fetches insights. Custom ranges require both dates and only fetch after applying a valid range where `date_from <= date_to`.

User-facing range labels use human-readable dates such as `Jan 1 - Jun 7, 2026`. Raw ISO dates are reserved for API calls, state, and internal logic.

On mobile, range chips stay on one horizontally scrollable line. The rail uses hidden scrollbars and trailing padding so `Custom` remains reachable without making the selector card tall.

The Insights page constrains mobile content to the small viewport width (`svw`) and applies `min-width: 0`/overflow guards to review cards and rows. This is specifically to keep iOS Home Screen standalone mode from allowing chips, popovers, or large transaction amounts to create horizontal overflow.

## Notable Spending

The transaction review section is named "Notable spending." It shows both individual large transactions and repeated spending groups from the `largest_transactions` response.

Repeated items are grouped on the frontend when they share:

- Normalized expense name
- Amount
- Category
- Tag id, or tag name when id is unavailable
- Card name
- Split state

Groups sort by total amount across the returned transactions. For example, four matching `$907` rent payments sort as one `$3,628 total` item above a single `$1,000` transaction.

Grouped rows open a grouped detail sheet that lists the individual transactions. Edit and delete actions remain tied to real individual transactions elsewhere in the app; grouped summaries are not directly editable.

This supports the modern financial notebook direction by making Insights feel like a spending review instead of a raw transaction dump.

## Mobile / iOS QA Checklist

Check these in Mobile Safari and iOS Home Screen standalone mode:

- Light mode
- Dark mode
- Range selector chips
- Range selector chips horizontally scroll without clipping
- Custom range date inputs
- Custom range keyboard behavior
- Loading skeletons
- Empty state
- Error state and retry
- Snapshot card
- Budget check-in progress rows
- Tag breakdown rows and Show all
- Spending rhythm
- Fixed vs flexible stacked bar
- Spending habits weekday strip
- Notable spending
- Grouped repeated expense row
- Grouped detail sheet
- View transactions link
- Bottom nav safe area
- Final section not hidden behind bottom nav or home indicator
- No horizontal overflow in iOS Home Screen standalone mode

## Known Limitations

- Previous-period comparison is not available from the current endpoint. Do not show copy like "12% less than last month" unless comparison data is fetched or added to the backend.
- One-month daily trend is not available from the current insights endpoint. The page shows a rhythm empty note for one-month ranges instead of inventing daily data.
- Tag/category drilldowns are informational for v1 unless Transactions routing supports prefilled filters cleanly.
- Notable spending grouping is frontend-only and based only on the API's `largest_transactions` array. It is not full-range merchant aggregation.
- A repeated expense only groups if multiple matching instances appear in `largest_transactions`.
- The Transactions route does not currently accept arbitrary `date_from` and `date_to` query params from Insights, so `View transactions` does not preserve the exact selected range yet.
- Opening the shared transaction detail sheet directly would require fetching or exposing a full `Transaction` record for the selected insight item.
- A future backend enhancement could add `notable_spending_groups` or `largest_expense_groups` to `/me/metrics/insights`, with fields like `expense`, `category`, `tag`, `card_name`, `count`, `total_amount`, `amount_each`, `first_date`, `last_date`, and `transactions`.
- Advanced insights can come later after the core review experience is strong.
