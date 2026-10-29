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
