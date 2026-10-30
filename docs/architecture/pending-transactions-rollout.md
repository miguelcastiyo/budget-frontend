# Pending transaction compatibility rollout

Phase 1 recognizes and rehydrates `pending_transaction_v1`, but encrypted authority writes to this family are disabled. Older deployed clients reject unknown record families during unlock; they cannot safely ignore these records.

Deploy read support first. Before enabling any pending writes, verify that deployed and cached clients can update and recover from an unsupported family, and confirm how already-open older clients are handled. Do not enable writes solely because this code has shipped. Closeout conflict handling and the rest of the workflow must also be implemented before launch. The backend continues to receive only opaque encrypted records.

The server cannot check encrypted month or pending data. A pending capture on another device can race with closeout after the client refresh. After synchronization the authority reports a closed-month conflict until the month is reopened or its pending records are resolved. Reopening is explicit and uses the existing closeout Fund ledger workflow.

## Local development workflow

Start the frontend with `BUDGET_ENABLE_PENDING_DEV=1 npm run dev` and a local HTTP backend (`BACKEND_ORIGIN` defaults to `http://localhost:8000`). This development gate enables the Review destination and pending writes only for a loopback backend and a loopback browser host, and never enables them in a production build. The separate production controls below are disabled by default. Use a dedicated test account; older clients do not understand pending records.

## Production readiness controls

The authenticated `/api/pending-capabilities` route asks the PHP API for the current session's account ID and returns only that account's two availability flags. The server environment keys are `BUDGET_PENDING_CAPTURE_ENABLED`, `BUDGET_PENDING_RECOVERY_ENABLED`, and comma-separated `BUDGET_PENDING_ACCOUNT_IDS`. All are off or empty by default. Capture requires both switches and an exact account ID match. Recovery requires the recovery switch and an authenticated session; Review is displayed when decrypted pending records exist even for an account outside the capture cohort. The switch affects client behavior and is not authorization against a modified client. The encrypted backend cannot enforce client-side financial rules.

The `/api/client-readiness` route returns `BUDGET_MIN_CLIENT_VERSION` (default 1) with `no-store`. The current frontend compatibility version is 1. A newer minimum requires shipping a compatible client with an incremented version before raising the minimum. Supported clients check at startup and on foreground return; they offer reload and do not automatically discard drafts. The check cannot reach an offline client or code that predates this mechanism.

## Capture-off recovery

To stop new captures, set `BUDGET_PENDING_CAPTURE_ENABLED` to `0` in the server configuration while retaining `BUDGET_PENDING_RECOVERY_ENABLED=1` and a deployed client that understands `pending_transaction_v1`. Apply the deployment platform's configuration update and verify the capability response using a synthetic account. Existing pending records remain encrypted and Review remains available after unlock; users may finalize or use immediate Undo. If a capture response was lost, synchronize before retrying or navigating away. A same-session retry reuses its prepared batch; after reload reconcile from synchronized state. Stale revisions and closed months require review and, when applicable, explicit reopening. If the recovery switch or capability service is unavailable, pending records remain readable but lifecycle writes are blocked; restore the service and recovery switch to resume.

Never roll back to an incompatible frontend after pending records exist. Keep the compatible reader and recovery controls available. Server-side settings are rollout controls, not a guarantee against modified clients or concurrent devices. Older tabs can still issue operations using stale state; after sync, closed-month conflicts require user action.

## Physical iPhone staging checklist

Before production activation, use an isolated HTTPS staging deployment and backend with a synthetic account and no real financial data. Configure the staging server cohort and both switches for only that account; do not enable the development gate remotely. Verify the staging deployment identity and backend before saving data. In iPhone Safari and an installed Home Screen app, test capture with the keyboard open, orientation changes, safe areas, swipe directions and canceled gestures, edge navigation, page scrolling, reduced motion, Tag selection, finalization, Undo, background/resume, and lock/unlock after an interrupted review. Test turning off capture while recovery remains enabled, then reopening the app and resolving an existing pending record. Verify the latest frontend version loads after a normal reload and after closing/reopening the installed app. Record device, iOS version, browser mode, results, and any observed cache or update behavior. Do not treat simulated touch or desktop WebKit as physical-device evidence.

### Staging preparation and evidence

1. Provision a dedicated local database and PHP backend with a synthetic account. Verify the backend origin and database name from the running processes; do not use production credentials, production data, or the production backend. Restrict access to the test machine and the test iPhone.
2. Run a production-style frontend pointed at that backend behind a local HTTPS reverse proxy. Use a hostname or IP reachable by the iPhone and a certificate the iPhone trusts. Confirm that secure cookies, authentication, Vault unlock, and the proxy's backend forwarding work from the phone. Do not bypass TLS verification or enable `BUDGET_ENABLE_PENDING_DEV` on a remote host.
3. Configure only the synthetic account in `BUDGET_PENDING_ACCOUNT_IDS`, with capture and recovery enabled. Confirm the authenticated capability response and record the frontend build, backend target, database, certificate identity, and account identifier without recording credentials or decrypted financial data. These steps require a working local HTTPS setup; they have not yet been verified for this repository.
4. Record pass, fail, or blocked for each check below separately in Safari and the installed Home Screen app. Record iPhone model, iOS version, date, build, and sanitized evidence. Do not include a Vault passphrase, recovery code, or financial data in evidence.

| Check | Safari | Installed app |
| --- | --- | --- |
| Unlock, lock, and unlock again during an interrupted review | Pending | Pending |
| Capture Amount only, Description only, and several consecutive items | Pending | Pending |
| Swipe right, left, and down; cancel gestures; scroll and start near screen edges | Pending | Pending |
| Confirm a suggested Tag and create a new Tag | Pending | Pending |
| Skip, finalize, Undo, finish a pass, and review skipped items again | Pending | Pending |
| Check badge counts, keyboard visibility, bottom navigation, safe areas, and reduced motion | Pending | Pending |
| Background and restore; restart, unlock, synchronize, and verify pending items | Pending | Pending |
| Exercise capture-off/recovery-on and resolve an existing item | Pending | Pending |
| Check update and recovery with an authenticated historical deployed build | Pending | Pending |

### Rollback rehearsal

Capture an encrypted-record metadata baseline including record IDs, revisions, and tombstone status. Change only the staging capture setting to `0`, retain recovery at `1`, restart or redeploy the same compatible staging build, and verify the authenticated no-store capability response. Check both an already-open client after foreground return and a newly opened client. New capture must be unavailable, existing pending items readable, and Review usable. Compare metadata before making a financial mutation: the configuration change must not delete or modify records. Then finalize and immediately Undo a synthetic item, sync from another client, and verify expected lifecycle tombstones and preserved unrelated transactions. Restore capture only in staging if another test requires it.

For an uncertain request, retain the exact prepared batch for an in-session retry; after reload synchronize and reconcile before acting. A closed-month conflict requires explicit reopening through the existing workflow. Never restore an incompatible frontend as the rollback mechanism.

### Older-client recovery rehearsal

Obtain a previously deployed artifact and its deployment identity. Preserve its original build assets and caching behavior; a build made from historical source is useful supplemental evidence but does not establish what was deployed. Serve the old and compatible builds in sequence at the same isolated origin, retaining the old tab and installed app and testing a cached relaunch. With only the synthetic account, create a pending record using the compatible build. Observe the old client's next sync and unlock, then update it and verify all encrypted records and finalized transactions remain intact. Compare record IDs, revisions, and tombstones before and after each read-only recovery attempt.

Before reloading, complete and save an open form only if doing so is safe and the old client remains functional; otherwise preserve its contents using a user-controlled secure method. Reloading may discard an unsaved draft, and old clients cannot be retrofitted with a new warning. Do not assume closing and reopening an installed app fetches fresh assets. Record the actual steps that work on the tested iOS version, including offline or cached behavior, and treat inability to update or identify the deployed artifact as a release blocker.
