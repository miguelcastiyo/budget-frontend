# Dashboard Page

## Story-First Layout
- Dashboard now follows a clearer sequence: `Month context` -> `Spending summary` -> `Category health` -> `Drill-down details`.

## Reduced Visual Competition
- Tags and Recent Transactions are now in a single tabbed `Drill Down` section instead of two side-by-side cards.
- This keeps all information on the dashboard while reducing simultaneous visual noise.
- Tabs:
  - `Tags`: Spending by Tag breakdown (clicking a tag still deep-links to Transactions with month + tag filters).
  - `Recent`: Recent Transactions list (See All still deep-links to Transactions with month filter), with tag/card chips matching the Transactions list treatment.

## Category Actions
- Needs, Wants, and Savings & Debts cards remain directly accessible.
- Clicking a category card still deep-links to Transactions with month + category filters.
- On mobile, category cards use a compact 3-across layout so all three fit on one row under the main spend summary.

## Add Transaction Discoverability
- The floating CTA uses explicit `Add Transaction` labeling for clearer intent.
- On mobile, the floating CTA is icon-only (`+`) for reduced visual footprint; desktop remains labeled.
- First-time users get a dismissible coachmark near the CTA when there is no activity.
- Empty states in both `Spending by Tag` and `Recent Transactions` include a direct `Add Transaction` action.
