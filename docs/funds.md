# Funds

Status: Active  
Last reviewed: 2026-07-17

## UX Overview

Funds is the dedicated savings-goals and reserved-money surface.

Product rule: a Fund is a container for intentionally saved money. A Goal is an optional property of a Fund and is determined by the presence of `goal_amount`.

It covers:

- fund overview
- fund detail
- create and edit fund flows
- archive and restore
- manual add-money and use-money flows
- fund-only ledger entries
- savings-transaction creation during a contribution
- linking an existing savings transaction to a fund contribution
- closeout allocations into active funds

Funds is reachable from:

- `Dashboard` via the compact Funds card
- `Insights` via the Funds notebook card
- direct routes under `/insights/funds`

## Routes

- `/insights/funds`
- `/insights/funds/[fundId]`

The app keeps Funds under Insights instead of Settings so it reads as an active money-management workflow, not configuration.

## Data Sources

Primary endpoints:

```text
GET /me/funds
POST /me/funds
GET /me/funds/{fund_id}
PATCH /me/funds/{fund_id}
POST /me/funds/{fund_id}/archive
POST /me/funds/{fund_id}/restore
GET /me/funds/{fund_id}/entries
POST /me/funds/{fund_id}/entries
PATCH /me/funds/{fund_id}/entries/{entry_id}
DELETE /me/funds/{fund_id}/entries/{entry_id}
GET /me/funds/closeout-summary?year=YYYY
```

Supporting endpoints:

```text
GET /me/tags
GET /me/cards
GET /me/transactions?categories=savings
```

## Overview Page

The overview page shows:

- total balance across active funds
- active fund state summary
- yearly closeout contributions
- filter chips for `active` and `archived`
- per-fund cards with progress, target month, remaining amount, and contribution count

Fund cards use full-card navigation to the fund detail route. Management actions stay secondary in the overflow menu, currently `Edit fund` plus archive or restore depending on fund status. Goal badges and progress UI are derived from `goal_amount`; open-ended Funds do not expose legacy type labels or goal placeholders.

Active funds are grouped by frontend-derived presentation state, with no persisted lifecycle state:

- no goal amount -> Open-ended
- goal amount and balance at or below zero -> Not started
- goal amount and balance between zero and the goal -> In progress
- goal amount and balance at or above the goal -> Goal reached

`Not started` and `In progress` funds render together under `In progress`, sorted by target month when present. `Open-ended` and `Goals reached` render as separate sections only when those states exist. Archived funds keep the existing archived view and are not grouped by presentation state.

Goal reached is not the same as Archived. A reached goal remains active until the user explicitly archives it, and spending money below the goal automatically returns it to the in-progress presentation state.

The overview sidebar is supporting context rather than a dashboard card. It presents compact active-fund totals and separates month-closeout context with a thin divider. Closeout copy is conditional: zero year-to-date closeout contributions says there are no closeout contributions yet, while non-zero totals say the money moved into funds from closed months.

On mobile, `At a glance` is compact inline context instead of mirroring the desktop sidebar. Month Closeouts is also rendered as an inline section with a divider rather than a full card, and the page shell keeps explicit bottom padding so content clears the fixed bottom navigation.

Create and edit fund dialogs no longer expose Fund Type. The form is goal-first: name, optional Savings Goal, optional Target Month, create-only Starting Balance, then optional Notes. Goal Amount is always visible and optional; blank or zero values create an open-ended Fund, while a positive value creates a goal Fund. Starting Balance is secondary and represents money already set aside before the Fund is created.

Target Month belongs to the Savings Goal section. It is disabled until Goal Amount is positive, is cleared when Goal Amount is cleared, and is only sent when `goal_amount` exists. The target month picker uses app-native controls instead of free-form `YYYY-MM` typing.

If no funds exist, the empty state drives the user into `Create fund`.

## Fund Detail

The detail page shows:

- `Add money` and `Use money` actions for active funds
- a strong fund summary card with name, optional `Goal` badge, optional notes preview, saved balance, and primary actions
- goal amount, progress, remaining amount, and target month only when `goal_amount` exists
- a balance breakdown section with non-zero source totals and an explicit current balance row
- a full, flattened ledger list as the primary activity history

Fund management actions are secondary and live in the summary overflow menu: `Edit fund` plus archive or restore depending on status. Open-ended funds do not show a goal badge, goal placeholder, progress bar, remaining amount, or target month.

The previous standalone Closeout Summary card was removed. Closeout totals now appear only as part of Balance Breakdown and closeout-linked activity appears in the ledger.

Balance Breakdown uses derived source totals with user-facing labels: Starting balance, Contributions, Withdrawals, Month closeouts, Corrections, and Current balance. Zero-value source rows are hidden by default, and the ledger entry count does not appear in this section.

Ledger entries render as flat rows directly on the page background on mobile, with subtle dividers instead of nested cards. The Ledger heading owns the entry count and uses compact helper text. Editable ledger actions are intentionally limited to manual, starting-balance, and correction entries and are exposed through each row's overflow menu. Transaction-linked and closeout-linked entries stay source-of-truth driven and do not expose edit/delete actions from the fund detail screen.

The Funds shell uses bottom-navigation-safe page padding on mobile so the Ledger heading, rows, row overflow menus, and final content can scroll fully above the fixed bottom navigation and safe-area inset.

## Entry Flows

Supported contribution tracking modes:

- `fund_only`
- `create_transaction`
- `link_existing_transaction`

`Use money` currently stays fund-only and creates an outflow ledger entry without manufacturing a transaction.

When creating a savings transaction from the fund dialog, the frontend collects:

- expense label
- tag
- optional card
- optional note

When linking an existing transaction, the picker only lists savings-category transactions from the current month query window.

## Closeout Integration

Month closeout allocation editing now supports `allocation_type: "fund"` and sends `fund_id` in the payload.

The closeout tray:

- loads active funds for the picker
- requires a fund selection for fund allocations
- shows the linked fund name in the saved ledger
- provides a `Create new fund` jump to `/insights/funds?create=1`

## QA Checklist

- Create a fund with and without a goal amount.
- Create a fund with a starting balance.
- Create a fund without choosing a type.
- Edit a fund name, goal, target month, and notes.
- Add and remove a savings goal on an existing fund without changing its contribution history.
- Archive and restore a fund.
- Add money with `fund_only`.
- Add money with `create_transaction`.
- Add money with `link_existing_transaction`.
- Use money from a fund.
- Edit a manual ledger entry.
- Delete a manual ledger entry.
- Confirm transaction-linked and closeout-linked entries do not show edit/delete controls.
- Allocate closeout surplus to a fund and confirm it appears in the fund ledger.
- Open `/insights/funds?create=1` and confirm the create dialog opens directly.
