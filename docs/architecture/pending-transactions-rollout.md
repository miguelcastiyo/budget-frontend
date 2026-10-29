# Pending transaction compatibility rollout

Phase 1 recognizes and rehydrates `pending_transaction_v1`, but encrypted authority writes to this family are disabled. Older deployed clients reject unknown record families during unlock; they cannot safely ignore these records.

Deploy read support first. Before enabling any pending writes, verify that deployed and cached clients can update and recover from an unsupported family, and confirm how already-open older clients are handled. Do not enable writes solely because this code has shipped. Closeout conflict handling and the rest of the workflow must also be implemented before launch. The backend continues to receive only opaque encrypted records.

The server cannot check encrypted month or pending data. A pending capture on another device can race with closeout after the client refresh. After synchronization the authority reports a closed-month conflict until the month is reopened or its pending records are resolved. Reopening is explicit and uses the existing closeout Fund ledger workflow.

## Local development workflow

Start the frontend with `BUDGET_ENABLE_PENDING_DEV=1 npm run dev` and a local HTTP backend (`BACKEND_ORIGIN` defaults to `http://localhost:8000`). The development server enables the Review destination and pending writes only for a loopback backend and a loopback browser host. Production builds always disable the feature. Use a dedicated test account; older clients do not understand pending records.

## Production readiness controls

The authenticated `/api/pending-capabilities` route asks the PHP API for the current session's account ID and returns only that account's two availability flags. The server environment keys are `BUDGET_PENDING_CAPTURE_ENABLED`, `BUDGET_PENDING_RECOVERY_ENABLED`, and comma-separated `BUDGET_PENDING_ACCOUNT_IDS`. All are off or empty by default. Capture requires both switches and an exact account ID match. Recovery requires the recovery switch and an authenticated session; Review is displayed when decrypted pending records exist even for an account outside the capture cohort. The switch affects client behavior and is not authorization against a modified client. The encrypted backend cannot enforce client-side financial rules.

The `/api/client-readiness` route returns `BUDGET_MIN_CLIENT_VERSION` (default 1) with `no-store`. The current frontend compatibility version is 1. A newer minimum requires shipping a compatible client with an incremented version before raising the minimum. Supported clients check at startup and on foreground return; they offer reload and do not automatically discard drafts. The check cannot reach an offline client or code that predates this mechanism.

## Capture-off recovery

To stop new captures, set `BUDGET_PENDING_CAPTURE_ENABLED` to `0` in the server configuration while retaining `BUDGET_PENDING_RECOVERY_ENABLED=1` and a deployed client that understands `pending_transaction_v1`. Apply the deployment platform's configuration update and verify the capability response using a synthetic account. Existing pending records remain encrypted and Review remains available after unlock; users may finalize or use immediate Undo. If a capture response was lost, synchronize before retrying or navigating away. A same-session retry reuses its prepared batch; after reload reconcile from synchronized state. Stale revisions and closed months require review and, when applicable, explicit reopening. If the recovery switch or capability service is unavailable, pending records remain readable but lifecycle writes are blocked; restore the service and recovery switch to resume.

Never roll back to an incompatible frontend after pending records exist. Keep the compatible reader and recovery controls available. Server-side settings are rollout controls, not a guarantee against modified clients or concurrent devices. Older tabs can still issue operations using stale state; after sync, closed-month conflicts require user action.

## Physical iPhone staging checklist

Before production activation, use an isolated HTTPS staging deployment and backend with a synthetic account and no real financial data. Configure the staging server cohort and both switches for only that account; do not enable the development gate remotely. Verify the staging deployment identity and backend before saving data. In iPhone Safari and an installed Home Screen app, test capture with the keyboard open, orientation changes, safe areas, swipe directions and canceled gestures, edge navigation, page scrolling, reduced motion, Tag selection, finalization, Undo, background/resume, and lock/unlock after an interrupted review. Test turning off capture while recovery remains enabled, then reopening the app and resolving an existing pending record. Verify the latest frontend version loads after a normal reload and after closing/reopening the installed app. Record device, iOS version, browser mode, results, and any observed cache or update behavior. Do not treat simulated touch or desktop WebKit as physical-device evidence.
