# Financial Authority responsibility audit (Phase 1)

Date: 2026-08-14. Scope: current frontend source only. This is an analysis-only
baseline; no runtime behavior is changed by this document.

## Executive summary

`FinancialAuthorityProvider` is the application-level React boundary for the
unlocked, decrypted financial runtime. The actual canonical state is owned by
`EncryptedFinancialAuthority`, not React: it syncs encrypted envelopes,
decrypts them, maintains `EncryptedRecordStore`, and rehydrates one
`RehydratedFinancialState` snapshot after every successful mutation.

The architecture is materially cleaner than its migration-era names suggest:
there is no reachable plaintext financial runtime. The strongest refactor case
is therefore deletion/simplification of compatibility routing and feature-level
`mode === "encrypted"` dispatch, not replacement of the encrypted authority or
the introduction of a state-management framework.

The largest ownership problems are (1) the provider exports Vault lifecycle,
raw runtime access, and 31 financial read/command functions from one context;
(2) settings/features bypass that command surface and manipulate
`authority.store`/`commitSourceDiff` directly; and (3) record normalization and
legacy identity compatibility are spread across rehydration, encrypted-record
adapters, and several feature helpers. A staged refactor is justified, but only
after preserving the existing pure-domain and encrypted-runtime test coverage.

## Current architecture and source of truth

```text
React feature/page
  -> useFinancialAuthority() context
  -> provider command wrapper or direct `authority` access
  -> encrypted operation module / pure domain helper
  -> EncryptedFinancialAuthority.commitSourceDiff/create/update/remove
  -> encryptSyntheticRecord + /me/encrypted-records[/batch|/sync]
  -> EncryptedRecordStore
  -> rehydrateFinancialState(store.values())
  -> one decrypted RehydratedFinancialState read by selectors/view models -> UI

VaultManager --runtime key--> EncryptedFinancialAuthority
backend encrypted-record API stores opaque envelopes only
```

`lib/privacy/encrypted-authority/authority.ts` is the state and persistence
source of truth. `bootstrap()` pages through `/me/encrypted-records/sync`,
decrypts into `EncryptedRecordStore`, and calls `rehydrateFinancialState`.
`create`, `update`, `remove`, and `commitSourceDiff` only update the store after
the server operation succeeds, then rebuild the sole state snapshot. No old
REST financial representation participates in that path.

There are nevertheless feature-local derived copies (page data/loading state)
and many direct reads of `authority.getState()`/`authority.store`. Those are not
independent persistence caches, but they make state ownership less obvious and
couple features to runtime internals.

## Responsibility matrix

| Responsibility | Current location | Category | Appropriate? | Recommendation |
| --- | --- | --- | --- | --- |
| Context, mount/unmount, memoized hook value | `components/privacy/financial-authority-provider.tsx` | R | Yes | KEEP |
| Auth/privacy-status lifecycle and locked/setup state | provider `refresh` | R | Mostly | SIMPLIFY after compatibility routing is removed |
| Runtime-key install/lock/recovery/quick-unlock | provider + `VaultManager` | V | Boundary is valid; provider exposure is broad | REVISIT as a separate Vault-facing context/hook only if usage warrants it |
| Decrypted canonical state and cursor | `EncryptedFinancialAuthority`, `EncryptedRecordStore` | S | Yes | KEEP |
| Encryption, revisions, idempotency, batch commit, sync | `authority.ts`, `lib/privacy/encrypted-records/*` | P | Yes | KEEP |
| Rehydrating encrypted records to financial objects | `rehydrate.ts` | S | Necessary, but contains legacy shaping | SIMPLIFY cautiously |
| Transaction/fund/recurring/savings/closeout commands | `lib/privacy/encrypted-authority/*-operations.ts` | C | Yes | KEEP |
| Financial rules/calculations | `lib/domain/financial/*` | D | Mostly | KEEP; MOVE remaining feature rules toward here |
| Overview/funds/recurring presentation shaping | `derived.ts`, `view-models.ts`, feature pages | U | Mixed | MOVE repeated feature shaping to selectors/view models |
| `mode` checks and unavailable-operation routing | provider, `routing.ts`, many features | T | No longer a permanent financial choice | DELETE CANDIDATE |
| Direct `store.values`, record lookup, and source-diff construction in pages | budget/tags/cards/contexts/data/funds pages | X | No | MOVE to explicit operation/feature-hook functions |

## Provider API surface

`FinancialAuthorityContextValue` exposes 47 members: 4 lifecycle/state
members (`mode`, `isLoading`, `refresh`, `authority`); 9 Vault/quick-unlock
members; 5 transaction commands; 4 taxonomy/context commands; 6 fund commands;
4 derived reads; 5 recurring commands; savings replacement; and 4 closeout
commands. It is therefore a useful gateway but also a de facto service locator.

Infrastructure leakage is explicit: `authority` exposes `store`, `getState`,
and raw encrypted mutation methods to all consumers. Compatibility leakage is
`mode`, `setFinancialAuthorityMode` (`routing.ts`), `runEncrypted`, and
`unavailableFinancialOperation`; `FinancialAuthorityMode` in the runtime itself
already has only `"encrypted"`, while the React routing type is `"setup" |
"encrypted"`.

## Representative mutation traces

| Workflow | Current trace | Invariant owner / atomicity |
| --- | --- | --- |
| Create transaction | `transaction-editor-form.tsx` -> provider `createTransaction` -> `transaction-operations.ts:createEncryptedTransaction` -> domain `createTransaction` + `transactionFundDiff` -> `commitSourceDiff` | Domain validates transaction; operation plans transaction/fund records; batch persistence commits and then rehydrates atomically in memory. |
| Fund contribution | funds UI -> provider `createFundEntry` -> `fund-operations.ts:createEncryptedFundEntry` -> fund/domain adapters -> authority write | Operation owns record mapping; fund balance is derived from ledger entries. Direct fund UI paths remain a review point. |
| Recurring change | settings recurring hook/page -> provider recurring facade -> `recurring-commands.ts` -> recurring validation/version planning -> batch diff | `recurring-commands.ts` owns overlap/materialization constraints and commits all related source changes together. |
| Month closeout | `month-closeout-tray.tsx` directly calls `commitEncryptedCloseout`/`reopenEncryptedCloseout` -> `closeout-mutation.ts` -> `commitSourceDiff` | Closeout operation creates closeout, allocation, and fund-ledger records and tombstones prior related records in one batch. This is close to the desired planned-mutation model. |
| Savings | provider `replaceSavingsPlan` -> `savings-plan-operations.ts` -> budget resolution + planned records -> batch diff | Domain calculation and record planning are appropriately below React. |
| CSV/import | settings data page performs direct store scans, lineage repair, batch construction | Import lineage has useful pure analysis in `import-lineage-repair.ts`, but UI currently owns too much encrypted-runtime orchestration. |

## Read traces

| Feature | Current path | Finding |
| --- | --- | --- |
| Overview | `app/page.tsx` -> provider `getMonthOverview` -> `derived.ts:encryptedMonthOverview(state, month)` -> view | Good selector boundary, but page also materializes recurring records directly. |
| Transactions | `app/transactions/page.tsx` -> `authority.getState()` / transaction operations -> transaction domain/view helpers -> components | Canonical state is clear; page has runtime checks and recurring orchestration. |
| Funds | `components/funds/funds-ui-legacy.tsx` -> provider fund reads plus direct `authority` state -> `derived.ts`/fund helpers -> UI | The `legacy` component keeps compatibility branches and broad ownership; high-value audit target. |
| Recurring | `use-recurring-data.ts` -> mode dispatch -> recurring materialization -> `getState()` -> recurring UI | Domain command is good; hook includes obsolete routing and runtime access. |

## Domain, persistence, normalization, and error boundaries

`lib/domain/financial` contains pure money, transactions, budgets, recurring,
fund, closeout, CSV, insights, savings, taxonomy, and view-model helpers. The
fast suite exercises these without Vault setup (`test-financial-domain-
foundations.cjs` and the client parity runner). This is a strong foundation to
retain.

Persistence is appropriately financial-record generic in `authority.ts`: it
knows families/schema versions, envelopes, revision checks, tombstones,
idempotency, sync, and crypto, but not needs/wants/savings or closeout rules.
The inverse boundary is mostly good: domain modules do not import crypto or the
API client. The exception is `rehydrate.ts` and encrypted-record adapters,
which intentionally translate encrypted record families and legacy field/family
aliases (`transactions`, camelCase IDs, namespaced references) into domain
objects. Those aliases are transition debt, not ordinary business logic.

Duplicate/unclear ownership candidates:

- `rehydrate.ts` normalizes transaction/taxonomy/budget values while
  `encrypted-records/adapters.ts` canonicalizes family/schema/field aliases;
  document an eventual canonicalization boundary before consolidating.
- `app/settings/tags/page.tsx`, `cards/page.tsx`, and `contexts/page.tsx` each
  find records and construct updates/tombstones, duplicating operation-layer
  responsibilities already represented by `taxonomy-operations.ts`.
- `app/settings/budget/page.tsx` and `app/settings/data/page.tsx` directly
  inspect `store` and commit source records; these are command orchestration,
  not presentation.
- Error ownership is split: domain errors can be specific, while runtime and
  provider often throw string codes such as `ENCRYPTED_AUTHORITY_LOCKED`.
  Features frequently map these themselves. Do not centralize error text until
  command boundaries are clarified.

## Transition-debt inventory

| Artifact | Classification | Evidence and disposition |
| --- | --- | --- |
| `routing.ts` global financial mode | DELETE CANDIDATE | Only tracks `setup`/`encrypted`; it does not select a plaintext runtime. Keep setup/locked UI state, remove it as a financial-authority routing abstraction. |
| Feature `mode === "encrypted"` dispatch | DELETE CANDIDATE | Present in pages for transactions, tags/cards/contexts, data, funds, recurring, and closeout. Replace later with one explicit “authority ready” boundary. |
| `unavailableFinancialOperation` dual error | SIMPLIFY | It distinguishes locked/setup but is not a provider selector. Preserve useful user-state errors without a mode-routing concept. |
| `selectFinancialAuthority` | REVISIT | Only constructs encrypted authority; name/factory may be unnecessary, but it may document the Vault-to-runtime boundary. |
| Legacy aliases in adapters/rehydration | UNCLEAR | Needed for already-persisted migrated encrypted records; retain until a corpus/data-retention decision proves them removable. |
| `funds-ui-legacy.tsx` name/comments | DELETE CANDIDATE (naming/branches, not behavior) | Contains encrypted guards and a comment about legacy financial requests. Audit each branch before deletion. |
| Historical privacy/migration documents and fixture corpus | HISTORICAL | Keep as evidence/tests; not runtime authority. |

## Change-surface assessment

| Future feature | Current surface | Why |
| --- | --- | --- |
| Context Insights | LOW | Pure selector/domain calculation + feature hook/view + UI; no new record type is required. |
| New Overview metric | LOW | Add derived/domain selector and presentation consumption; provider already exposes overview state access. |
| Recurring forecasting | MEDIUM | Domain forecast selector and UI should suffice, but current feature materialization/runtime access may tempt provider changes. |
| Fund analytics | LOW–MEDIUM | Ledger-derived domain selector plus UI; avoid expanding funds UI direct-store access. |
| New transaction attribute | MEDIUM | Record schema/rehydration/operation/domain/UI change is legitimate; avoid adding feature-local persistence logic. |
| New closeout allocation type | MEDIUM | Extend closeout planned diff, domain calculation, schema/rehydration, UI. Batch authority stays unchanged. |

## Minimal target responsibility model

Keep the existing concepts rather than adding a service/factory/command-bus
layer:

- The React provider owns authentication-aware Vault lifecycle, locked/ready
  rendering state, subscription/value assembly, and one encrypted authority
  instance.
- `EncryptedFinancialAuthority` owns decrypted state, encrypted persistence,
  sync, revision/idempotency, and atomic in-memory post-commit rehydration.
- `lib/domain/financial` owns pure calculations, validation, selectors, and
  deterministic multi-record mutation plans.
- Existing `*-operations.ts` modules own the translation of a feature command
  to a domain plan and `commitSourceDiff`.
- Feature hooks own ergonomic feature reads/loading and command invocation;
  pages/components own forms, dialogs, toasts, and navigation.
- Remove the retired financial-mode routing and direct feature use of raw
  `store` where an existing or small explicit operation is clearer.

## Recommended follow-up phases

| Phase | Goal and scope | Risk / dependency | Expected simplification |
| --- | --- | --- | --- |
| 2 | Replace feature-level encrypted-vs-other dispatch with explicit ready/locked authority access; retain setup UI. | Low–medium; requires encrypted-only boundary tests. | Deletes routing debt without changing financial rules. |
| 3 | Move tags/cards/contexts/budget/data direct-store mutations into existing small operation modules. | Medium; add focused operation tests first. | Features stop knowing record IDs, tombstones, and source diffs. |
| 4 | Make recurring/overview/closeout feature hooks call explicit commands/selectors rather than runtime internals. | Medium; preserve multi-record idempotency tests. | Smaller feature change surface and clearer side-effect ownership. |
| 5 | Review legacy aliases in rehydration/adapters against persisted corpus and remove only proven-obsolete compatibility cases. | Higher data-compatibility risk. | Deletes transition normalization, not valid migrations. |
| 6 | Reassess provider API after consumers no longer need raw authority; split only demonstrably independent Vault concerns. | Medium; avoid abstraction churn. | Context ceases to be a service locator while retaining one state authority. |

## Testing and dependency direction

Current coverage is well layered: pure domain (`test-financial-domain-
foundations.cjs`), command/authority operations (`test-authority-operations.cjs`,
`test-recurring-commands.cjs`), encrypted adapters/boundaries, fixture parity,
and encrypted e2e tests. Preserve this separation. In particular, closeout,
recurring, transaction/fund diffs, and import lineage should remain testable
without React or a Vault.

Dependency direction is generally healthy: features depend on provider/domain;
operation modules depend on authority/domain; crypto does not import React or
financial UI. The actionable violation is the reverse practical dependency
created by pages directly reaching through context into `store` and batch
persistence internals.

## Plain answer to the core question

For a normal new financial feature, the intended future change set is a pure
domain selector/rule or explicit operation, a thin feature hook/view model, and
UI. The provider and encrypted persistence should remain unchanged unless the
feature introduces a genuinely new encrypted record family or persistence
property. Current direct-runtime feature code and mode branches are the main
obstacles to that outcome.
