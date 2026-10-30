# Budget v2 migration acceptance

Date: 2026-10-30

## Recommendation

**Ready for a limited, opt-in rollout; not yet cleared for unrestricted multi-device production use.** Classic remains available as the default and as the presentation fallback. Resolve the Vault initialization retry issue and complete the physical-device, cached-client, and simultaneous-write checks below before treating the rollout as broadly accepted. Do not change pending financial capability flags as part of enabling the interface.

## Migration completeness and corrections

The existing Overview, Transactions, Review, Budget, Insights, Funds, Savings Plans, Tags, Cards, Contexts, Recurring, Settings, Data, Vault, and Devices routes have v2 presentations backed by the production controllers and encrypted authority. The account sign-in, invitation, onboarding, and password-reset routes remain existing shared presentations; the retired API-key route redirects to Settings. No prototype store or seeded prototype financial data was found in production workflows.

This pass corrected two navigation/presentation gaps: a new account on a financial route now receives a Vault setup link instead of an unusable unlock prompt; the interface-preference provider remains available to the locked view, so its v2 styling can apply without changing Vault or authority ownership. Settings now exposes the account's Privacy & Vault link to members as well as owners; invitation management remains owner-only. The real-backend new-account test now uses fresh synthetic accounts and checks the current setup-and-unlock sequence.

## Validation

- Frontend typecheck, lint, and all 19 fast checks passed after the corrections. The fast suite includes financial domain, authority, client parity, compatibility, and encrypted-only/security boundary checks.
- A full synthetic Chromium/WebKit suite passed 138 tests, with four expected skips for the disabled-flag-only and PHP-dependent cases. It ran before the final small boundary/navigation corrections. A focused post-correction run passed 26 tests with two disabled-flag-only skips, including interface persistence, history, Vault, Add, draft preservation, and member navigation. A separate flag-disabled run passed eight tests.
- One intermediate interface-navigation test timed out while multiple development servers were under load; the same assertion passed in the final focused Chromium/WebKit rerun. No assertion was weakened.
- The production build completed successfully.
- Browser tests using `setupEncryptedFixture` simulate encrypted transport while exercising the real browser-side authority. They are not evidence of PHP persistence.

## Isolated PHP-backed validation

Docker and the pinned MariaDB 11.4 parity service were unavailable. A fresh MySQL 9.6 data directory and synthetic database named `budget_privacy_parity_test` were created under `/tmp`, with a separate loopback PHP server. No existing database or production financial data was used; the temporary services and data were removed afterward. MySQL 9.6 is useful integration evidence, but does not replace the documented MariaDB 11.4 parity environment.

The guarded PHP encrypted-batch test passed, including idempotent retry, atomic rejection, and sync-sequence checks. The encrypted-by-default lifecycle test passed. Real PHP-backed Chromium and WebKit tests passed for new-account Vault setup and unlock; budget creation and update; Quick Capture, Review, Skip, finalization, and Undo; transaction edit and deletion; Fund-only contribution; creating a linked Savings transaction; linking an existing Savings transaction; linked transaction editing/deletion and Fund reversal; mapped CSV import and rollback; and Vault reload/synchronization. The Quick Capture/Review test also injects a client-side revision-conflict response; it is not a real simultaneous PHP concurrency test.

Two PHP scripts did not pass. `test_encrypted_record_substrate.php` attempts record writes while the account is still in `vault_setup_required`, which is inconsistent with the current authority gate. More seriously, `test_vault_foundations.php` demonstrates that a second, identical Vault initialization is rejected after the first request transitions the account to encrypted state: the state check runs before the existing matching-payload retry path. The test cleanup also encountered a synthetic sync-state foreign key. The exact-retry issue needs a focused backend investigation; the failures were not suppressed.

## Remaining issues and release gates

| Classification | Issue | Required handling |
| --- | --- | --- |
| Blocking for unrestricted rollout | A successfully accepted Vault initialization cannot currently be retried identically after its response is lost; the state guard rejects the retry before the matching-payload path. | Verify and fix safe initialization retry or establish and test an explicit recovery procedure before broad rollout. |
| Blocking for unrestricted rollout | Cached or already-open older clients have not been tested against a representative deployed historical artifact. The readiness check cannot force offline or pre-check clients to update. | Verify old tabs, cached launches, and installed PWA update/recovery on staging before broad rollout; retain a compatible reader for existing encrypted records. |
| Blocking for concurrent multi-client Fund rollout | Revision-checked Fund linking is covered by browser fixtures and real single-client PHP flows, but simultaneous competing devices and clients predating the corrected command were not tested against the real backend. | Run the isolated multi-client PHP concurrency test and prevent older clients from bypassing the corrected operation before depending on concurrent linking. |
| Blocking for simultaneous cross-tab Data operations | The opaque local-storage recovery marker is advisory and its read/write is not an atomic cross-tab lock. | Use one Data operation at a time in one tab; establish atomic coordination before supporting simultaneous imports or rollbacks across tabs. |
| Nonblocking with operational restriction | A lost response after the prepared request is no longer available can remain unresolved if sync cannot prove the outcome. The UI blocks replacement operations. | Synchronize and investigate the run before retrying; do not recreate or claim success for the uncertain operation. |
| Nonblocking known limitation | Historical transactions referencing deleted taxonomy records may show blank Tag, Card, or Context labels. | Preserve the financial record; improve historical label retention separately if needed. |
| Nonblocking known limitation | After initial Vault setup the current flow returns to Vault settings in the locked state, requiring an explicit unlock; its planned success screen is not shown. | Follow the unlock prompt; improve setup feedback in a separate focused change. |
| Blocking for broad mobile rollout | Physical iPhone and installed-PWA interaction details have not been measured. | Complete the checklist below and record results before broad mobile rollout. |

## Physical iPhone checklist

Perform once in Safari and once in the installed PWA using an isolated account:

1. Set up or unlock the Vault; test an incorrect passphrase and lock/re-unlock. Switch Classic → v2 → Classic and verify the same unlocked data.
2. Use Quick Capture and Full Entry; test amount keyboard, field focus, scrolling, and inline Tag/Card/Context creation.
3. Review by buttons and gestures; Skip and Undo; confirm pending counts and finalized totals.
4. Search and filter Activity, open details, edit a transaction, and confirm totals. Check bottom sheets, safe areas, touch targets, and keyboard visibility on small and large iPhones.
5. Background and reopen Safari/PWA; check Vault behavior, synchronization, compatibility notices, and a desktop-to-phone change without duplicating writes.
6. Exercise Settings, Vault, and device confirmation dialogs; verify light/dark themes and safe-area placement.

No physical iPhone or installed-PWA test was performed during this pass.

## Deployment and fallback

1. Ship the compatible frontend and existing backend without enabling new financial capabilities. `NEXT_PUBLIC_BUDGET_V2_ENABLED` is a build/deployment setting; leave it unset or `false` for Classic-only availability, or set it to `true` and rebuild/redeploy to expose the Settings selector.
2. Classic is the default. A user can select v2 in Settings and return to Classic on the same device. The preference does not grant financial authority or alter pending-capture permissions. When the availability flag is off, the app renders Classic while retaining a saved v2 preference.
3. Use the selector or disable the presentation flag for visual fallback. Both interfaces use the same encrypted records and backend. Do **not** roll back to an old frontend that cannot read record families already present; retain a compatible client and recovery path.
4. Validate the deployment with a synthetic account and the checklist, and complete the concurrency and cached-client gates above before broadening use.
