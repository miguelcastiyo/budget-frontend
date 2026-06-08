# Insights

Status: Active  
Last reviewed: 2026-06-07

## UX Overview

Insights is a spending review page, not a generic analytics dashboard. It should feel like a calm monthly or range-based financial notebook entry.

The page answers:

- How much did I spend?
- Did I follow my budget?
- Where did the money go?
- What patterns stand out?
- What transactions should I review?

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
- `largest_transactions` -> Notable transactions

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
8. Notable transactions

Desktop layout:

- Main column: Snapshot, Budget check-in, Where the money went, Spending rhythm, Notable transactions.
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

## Mobile / iOS QA Checklist

Check these in Mobile Safari and iOS Home Screen standalone mode:

- Light mode
- Dark mode
- Range selector chips
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
- Notable transactions
- Bottom nav safe area
- Final section not hidden behind bottom nav or home indicator

## Known Limitations

- Previous-period comparison is not available from the current endpoint. Do not show copy like "12% less than last month" unless comparison data is fetched or added to the backend.
- One-month daily trend is not available from the current insights endpoint. The page shows a rhythm empty note for one-month ranges instead of inventing daily data.
- Tag/category drilldowns are informational for v1 unless Transactions routing supports prefilled filters cleanly.
- Notable transactions currently link users to Transactions for deeper review. Opening the shared transaction detail sheet directly would require fetching or exposing a full `Transaction` record for the selected insight item.
- Advanced insights can come later after the core review experience is strong.
