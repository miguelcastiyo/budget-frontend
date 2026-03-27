# Insights Page

## Route
- `/insights`

## Data Source
- Uses `GET /api/v1/me/metrics/insights?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`.

## Date Controls
- Quick presets: `3M`, `6M`, `YTD`, `12M`.
- Custom range: shared app calendar picker for `From` and `To`.
- `Apply Range` fetches new aggregated metrics.

## Layout Behavior
- Desktop (`lg` and up): full analytics dashboard grid.
  - Spending trends (line)
  - Needs/Wants/Savings split (donut)
  - Budget vs actual (horizontal bars)
  - Recurring vs variable (stacked bar)
  - Tag spending (donut + legend)
  - Weekday behavior (bars)
  - Top transactions list
  - Insight cards (top tag, highest spend day, budget pressure)
- Mobile (`< lg`): tabbed sections for density and reduced scroll.
  - `Overview`: trend + category split
  - `Breakdown`: budget vs actual + tags + top transactions
  - `Behavior`: recurring vs variable + weekday behavior + compact insight cards

## Empty State
- If `total_transactions` is `0`, a no-data card is shown with guidance to add transactions.

## Notes
- Chart colors reuse existing app tokens (`--color-chart-*`, `--color-needs`, `--color-wants`, `--color-savings`).
- Top transactions are read-only on Insights.
- Tooltips are standardized across charts (consistent card style + currency formatting).
- Axes use compact labels/tick spacing tuned for mobile and desktop.
- Chart animations use a shared easing/duration profile for consistent motion.
- Tag breakdown charts use an explicit high-contrast palette with deterministic fallback hues for high-tag-count months.
- Tag breakdown does not collapse long tails into `Other`; every tag is rendered as its own slice.
- Tag charts/legends are sized larger and scrollable to keep all tags accessible in high-volume months.
