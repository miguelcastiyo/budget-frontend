# Funds

Status: Active  
Last reviewed: 2026-07-17

## UX Overview

Funds is the dedicated savings-goals and reserved-money surface.

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
- active fund count
- count of funds with goals
- yearly closeout contributions
- filter chips for `active` and `archived`
- per-fund cards with progress, target month, remaining amount, and contribution count

Fund cards use full-card navigation to the fund detail route. Management actions stay secondary in the overflow menu, currently `Edit fund` plus archive or restore depending on fund status.

The overview sidebar is supporting context rather than a dashboard card. It presents compact active-fund totals and separates month-closeout context with a thin divider. Closeout copy is conditional: zero year-to-date closeout contributions says there are no closeout contributions yet, while non-zero totals say the money moved into funds from closed months.

Create and edit fund dialogs use the shared month selector for optional target month selection instead of free-form `YYYY-MM` typing.

If no funds exist, the empty state drives the user into `Create fund`.

## Fund Detail

The detail page shows:

- saved balance
- goal and remaining amount
- goal progress bar when a goal amount exists
- source breakdown across closeouts, savings transactions, manual entries, starting balance, and corrections
- full ledger list
- `Add money` and `Use money` actions for active funds

Editable ledger actions are intentionally limited to manual, starting-balance, and correction entries. Transaction-linked and closeout-linked entries stay source-of-truth driven.

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
- Edit a fund name, type, target month, and notes.
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
