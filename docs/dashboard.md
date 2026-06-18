# Dashboard

Status: Active  
Last reviewed: 2026-06-18

## UX Overview

Dashboard remains the monthly home screen. The hierarchy is still:

1. Month selector
2. Spend summary flip card
3. Needs / Wants / Savings cards
4. Drill-down tabs for tags and recent transactions

Month closeout now lives inside the existing spend summary card instead of adding a new dashboard section. The front of the card continues to answer "How much have I spent?" and the back of the card now answers "What is left, or how did this month close?"

## Data Sources

Dashboard month loading now fetches these endpoints in parallel:

```text
GET /me/months/{month}/overview
GET /me/month-closeouts/{month}
```

The overview response still drives:

- spend ring totals
- category cards
- tags
- recent transactions
- current-month pacing information

The month closeout response drives:

- back-of-card state and copy
- closeout CTAs
- closeout detail / review tray

Closeout writes use:

```text
GET /me/month-closeouts?date_from=YYYY-MM&date_to=YYYY-MM&status=closed|reopened
POST /me/month-closeouts/{month}/close
PATCH /me/month-closeouts/{month}
POST /me/month-closeouts/{month}/reopen
```

The list endpoint is supported in the API client for domain completeness, but it is not used by the current dashboard UI.

## Spend Card Behavior

The hero card is still the existing flip interaction. The front face keeps the spend ring and category legend. The card now adds a small muted footer hint with a subtle rotate affordance instead of a pill or badge, so the card still reads like dashboard data rather than a tutorial:

- `open`: `$X left this month`
- `ready_to_close`: `Ready to close [Month]`
- `closed`: `[Month] closed`
- `closed` with stale saved data: `Review closeout`
- `reopened`: `[Month] reopened - ready to close`
- `missing_budget`: `Add a budget to review this month`
- `future`: `Future month preview`

The back face is closeout-aware:

- `open`: shows `Left this month`, daily remaining pace, and days remaining.
- `future`: quiet future-month copy only.
- `missing_budget`: prompts the user to go to Settings -> Budget.
- `ready_to_close`: shows the computed closeout result and a `Close Month` CTA.
- `closed`: shows the saved closeout result, allocated / unassigned totals, and a `View Closeout` CTA.
- `closed` + stale: shows stored vs current result and a `Review Closeout` CTA.
- `reopened`: prompts the user to close the month again.

CTA buttons on the back face stop propagation so they do not accidentally flip the card while opening the tray. Close actions use month-specific labels such as `Close May`.

If the closeout read fails, Dashboard keeps the overview visible and falls back to the safe informational back face instead of blocking the whole page.

## Closeout Tray

Dashboard uses the shared responsive dialog shell:

- mobile: bottom tray
- desktop: centered modal

Supported modes:

- `close`: create a closeout for `ready_to_close` or `reopened` months, and refresh a stale closeout snapshot
- `view`: read-only detail for a closed month
- `edit`: update notes and allocations on an existing closeout
- `review`: stale-state review with stored vs current comparison

The tray supports:

- planned vs actual summary for close actions
- collapsible planned vs actual details to reduce first-screen density on mobile
- surplus or deficit allocation editing
- partial allocation with live remaining amount
- rollover target month entry
- notes
- reopen confirmation

Balanced closeouts do not expose allocation editing. Allocation rows now use a standard compact money field instead of the large hero-style amount input so the tray reads more like a calm monthly review than a form wizard.

## Allocation Rules

The frontend enforces these closeout rules before submit:

- allocations cannot exceed the closeout surplus or deficit amount
- zero-value rows are not submitted
- rollover rows require `target_month`
- non-rollover rows clear `target_month`
- balanced months submit notes only

Surplus quick actions:

- `Send all to savings`
- `Keep as buffer`
- `Split it up`

Deficit quick actions:

- `Covered by buffer`
- `Covered by savings`
- `Split it up`

## Implementation Notes

- Dashboard treats overview as the primary load and closeout as a secondary load.
- If overview fails, the page shows the existing error card.
- If closeout fails, the page renders without closeout CTAs.
- After closeout writes, Dashboard updates local closeout state and reloads the selected month so the spend card, category cards, and transaction-derived summaries stay in sync.
- The current Settings -> Budget navigation remains a generic route push; dashboard does not yet deep-link the selected month into budget settings.

## QA Checklist

- Flip the hero card on mobile and desktop.
- Confirm CTA taps on the back face open the tray without flipping the card again.
- Check `open`, `future`, `missing_budget`, `ready_to_close`, `closed`, `closed stale`, and `reopened` states.
- Close a month with no allocations.
- Close a month with partial allocations.
- Save a rollover allocation and confirm a target month is required.
- View a closed closeout, then edit notes and allocations.
- Reopen a month from the tray and confirm the hero card updates to reopened state.
- Review a stale closeout and confirm `Update Closeout`, `Keep Current Closeout`, and `Reopen Month` all work.
- Confirm closeout read failures do not block the rest of Dashboard.
