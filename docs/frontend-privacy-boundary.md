# Frontend Privacy Boundary

Status: Inventory baseline  
Date: 2026-07-25

This document describes the current browser exposure boundary. It is not a threat model and does not implement encryption or offline financial-data storage.

## Persistent Browser Storage

| Key / mechanism | Purpose | Financial data? | Security material? | Lifetime / clearing |
|---|---|---:|---:|---|
| `budget.csrf_token` in `localStorage` | Rehydrates the CSRF header and acts as a client-side session hint | No | Yes, CSRF state is JavaScript-readable | Written after sign-in/invite acceptance; removed on sign-out and API 401 |
| `budget-first-month-progress-dismissed` in `localStorage` | Dismisses the Overview setup-progress card | No | No | Persists until browser storage is cleared |
| `transactions-desktop-filters-collapsed` in `localStorage` | Remembers desktop Transactions rail visibility | No | No | Persists until browser storage is cleared |
| `budget-add-transaction-coachmark-dismissed` in `localStorage` | Dismisses the Log/Add coachmark | No | No | Persists until browser storage is cleared |
| `budget.recent-context-ids` in `localStorage` | Remembers recently selected Context IDs for picker ordering | No amounts/descriptions | No | Persists until browser storage is cleared |

No `sessionStorage`, IndexedDB, Cache Storage, or service-worker cache usage was found in the frontend. The app has a PWA manifest, but no service worker or offline financial-response cache.

## Runtime / DOM Exposure

During normal authenticated use, financial and user data necessarily exists in browser memory and rendered DOM, including transaction descriptions and notes, income, budget values, Fund names and balances, and Savings Plan values. This is expected runtime exposure and is not equivalent to persistent browser storage. The later privacy threat model must define which browser/runtime threats are in scope.

## CSRF Lifecycle

1. Sign-in and invite-acceptance responses return `session.csrf_token`.
2. `lib/api/auth.ts` passes that token to `ApiClientCore.setCsrfToken()`.
3. The API core keeps it in memory and writes it to `localStorage`.
4. On reload, the API core reads the stored value before mutating requests.
5. Mutating requests send it as `X-CSRF-Token` with the session cookie.
6. Sign-out and 401 responses clear both memory and persistent storage.

The current persistence is intentional for reload/standalone-session behavior but leaves security material JavaScript-readable. It was not changed because removing it safely requires coordination with backend/session bootstrap behavior. Review it in the dedicated security/privacy threat model; do not move it to another JavaScript-readable store.

## Logging Policy

The frontend contains no application `console.log` or `console.debug` calls that emit user data. Test scripts log only pass/fail status. Continue enforcing:

> Do not log authentication material, complete API payloads, transaction descriptions, notes, income, Fund names, balances, Savings Plan data, or session identifiers.

API errors expose a request ID and sanitized error envelope to the UI; the frontend does not log the full response payload.

## Third-Party Telemetry

No third-party analytics or telemetry provider is mounted in the application shell. No custom analytics events or financial metadata were found in the repository.

## Token-Bearing URLs

- `/invite/[token]` redirects to `/sign-in?invite_token=...`.
- `/sign-in?invite_token=...` uses the token for preview and invite acceptance.
- `/password-reset/[token]` uses the token directly in the confirmation request.

These tokens can appear in browser history, screenshots, referrers, and operational logs. The backend is the source of truth for expiration/single-use semantics. The invite route currently redirects, so token removal would require preserving the active invite flow without moving the token into persistent storage. This remains deferred to the auth/privacy review.

Other query parameters contain navigation/filter state such as month, category, tag IDs, or modal-open flags. Do not put free-text transaction data or financial amounts in URLs.

## Explicit Non-Goals

- No client-side encryption.
- No offline financial-data persistence.
- No new persistent storage for financial data.
- No third-party telemetry provider without a documented privacy/product decision.
