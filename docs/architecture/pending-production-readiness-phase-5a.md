# Quick Capture production readiness: Phase 5A

**Recommendation: NO-GO for production activation.** This phase prepares controls and tests; it does not activate or deploy the feature.

## Compatibility findings

The current reader recognizes `pending_transaction_v1` and rejects unknown families and unsupported pending schemas. Bootstrap stages all pages before publishing state, so a failed sync retains the prior complete state. The existing production write gate was local-development-only; this change adds separate, default-off account-scoped controls and retains the generic production batch guard. The PHP encrypted-record backend remains opaque and receives no new financial rules.

The current repository has no service worker registration. On October 28, 2026, a read-only request to the deployed public home page returned `Cache-Control: public, max-age=0, must-revalidate` and `x-nextjs-stale-time: 300`; a sampled hashed JavaScript chunk returned `public,max-age=31536000,immutable`. These headers do not establish what historical clients or installed apps have cached. An already-open older client cannot receive new error handling or the new version check until it loads newer code; it may remain active while another device creates pending records. That population, its update path, and cross-device behavior remain release blockers.

The new client version check uses a no-store endpoint on startup and foreground return. It does not force reload or recover offline or pre-existing clients. Unsupported record families and schemas now offer update guidance in current unlock flows; old clients can still show a generic error. Do not activate until the deployed compatibility release and recovery instructions are verified in actual cached clients.

## Controls and rollback

See [pending-transactions-rollout.md](pending-transactions-rollout.md) for the account allowlist, separate capture/recovery controls, staged activation prerequisites, capture-off procedure, uncertain-result recovery, and iPhone checklist. The allowlist is an operational rollout control, not backend access control. The frontend cannot guarantee that a concurrent device will not create a pending record while another closes the month; synchronized conflicts require explicit user action.

## Validation and remaining blockers

Frontend fast checks, production build, encrypted lifecycle and PHP batch integration, and Chromium/WebKit Review checks were run locally. Browser coverage includes simulated Chromium touch; it is not physical iPhone testing. A capture-off capability response was simulated in the browser while the local PHP backend handled financial records. No production configuration was changed.

Outstanding before GO: inspect the actual deployed and historical client population, verify installed-app and old-tab update recovery, perform the documented physical-iPhone and installed-PWA tests on isolated HTTPS staging, verify operational configuration and rollback in staging, and obtain a release decision. Any outstanding result keeps the recommendation at NO-GO.

## Files and test results

- Server controls: `app/api/pending-capabilities/route.ts`, `app/api/client-readiness/route.ts`, and `lib/pending-rollout-server.ts`.
- Client availability and update recovery: `components/privacy/financial-authority-provider.tsx`, `components/privacy/vault-recovery-panel.tsx`, `components/common/client-update-notice.tsx`, `lib/privacy/quick-unlock-ui.ts`, `app/layout.tsx`, `app/page.tsx`, `app/review/page.tsx`, and the header and bottom navigation components.
- Scoped authority and compatibility: `lib/privacy/encrypted-authority/authority.ts`, `pending-lifecycle.ts`, `pending-transaction-operations.ts`, and `lib/privacy/encrypted-records/adapters.ts`.
- Tests: `scripts/test-pending-rollout.cjs`, `scripts/test-pending-lifecycle.cjs`, `scripts/test-pending-php-integration.cjs`, `tests/e2e/quick-capture-review.spec.ts`, `tests/e2e/client-readiness.spec.ts`, `scripts/test-fast.cjs`, and `package.json`.
- Documentation: this report and `pending-transactions-rollout.md`.

The production build, lint, and all 18 frontend fast checks passed. The isolated PHP batch and encrypted lifecycle tests passed. Chromium and WebKit passed the local Review workflow and update-notice tests; Chromium additionally passed the local account-scoped path and simulated capture-off recovery. A concurrent test/build run initially failed because Next regenerated `.next` type files during typechecking; rerunning the suite sequentially passed. Temporary test services and their database were removed.

## Phase 5A.1 assessment — NO-GO

**Actual deployed-build recovery, physical iPhone validation, and an operational HTTPS staging rollback remain unverified.** No production settings or accounts were changed. See the rollout document for the acceptance checklist and rehearsal procedure.

### Historical source findings

Repository revision `78db62e`, immediately before pending-family support, is a historical source revision; no deployment artifact or metadata was available to establish that it was actually deployed. Its adapter was loaded from Git and executed locally: parsing a `pending_transaction` payload raises `ENCRYPTED_RECORD_PAYLOAD_INVALID:unsupported_family:pending_transaction`. Its source contains neither the current client-readiness check nor the current update guidance. These are source observations, not a test of a deployed artifact, cached tab, or installed PWA.

That historical authority clears and repopulates its internal store during bootstrap, then publishes rehydrated state only after all pages succeed. A failure can therefore leave its internal store partially rebuilt. Its provider locks the Vault when initial bootstrap fails. Behavior of an already-open client after a failed refresh, draft preservation, and record integrity across recovery require direct testing of the actual deployed build; do not infer complete-state synchronization from the historical implementation. Old running or offline clients cannot receive the newer update check. Until their update and recovery route is established, do not create pending records for their accounts.

### Checks performed in Phase 5A.1

- The 17 non-typecheck fast checks passed, including compatibility, authority, financial domain, encrypted-only boundaries, lifecycle, and rollout controls. Typechecking passed using an isolated temporary configuration that excludes duplicate generated `.next/types/* 2.ts` files. The unmodified `npm test` failed its initial typecheck on those pre-existing duplicate generated declarations; the cache was preserved.
- The real PHP batch integration passed against a disposable local loopback MySQL database and PHP server. It exercised encrypted sync, lost-response retry, stale revisions, cross-device finalization and Undo, Fund reversal, closeout conflict, normal transaction operations, and a synthetic plaintext storage audit. Its authority harness removes write guards in memory for testing, so it is not evidence of production rollout configuration.
- The Review workflow passed in Chromium and WebKit against the local PHP backend using the loopback development gate. The current-client update notice passed in both browsers. Chromium's test includes simulated touch; neither engine is a physical iPhone.
- A full browser-suite attempt had 20 passes, 2 skipped Review tests, and 8 failures: both encrypted-by-default tests could not reach their expected database at port 3307, while the device and transaction mock tests landed on the sign-in page in both browsers. The suite has not passed in this environment. The Review workflow was subsequently run separately against the isolated backend as described above.
- An initial capture-off simulation with the development gate enabled failed in both browsers because that gate independently keeps capture enabled. This is not a valid operational rollback rehearsal; disable the development gate when testing production-style controls.
- With the development gate off and account-scoped controls enabled only for synthetic local accounts, the same Review test passed in Chromium and WebKit against PHP. The capture-off response was intercepted in the browser, not produced by changing server configuration, so this demonstrates simulated recovery rather than operational rollback.

### Outstanding evidence

Obtain an identifiable deployed historical artifact and test old tabs, cached launches, and installed PWA recovery. Provision device-accessible HTTPS staging with a trusted certificate and an isolated account and backend, then verify the actual capture-off configuration change and metadata invariance. Complete and record the physical iPhone checklist in both modes. Establish an operational response for incompatible clients that remain open or offline. Re-run the full browser suite with its intended dependencies and investigate any remaining failures. None of these conditions is satisfied by simulated touch or mock capability responses.
