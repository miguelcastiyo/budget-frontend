# Pending transaction compatibility rollout

Phase 1 recognizes and rehydrates `pending_transaction_v1`, but encrypted authority writes to this family are disabled. Older deployed clients reject unknown record families during unlock; they cannot safely ignore these records.

Deploy read support first. Before enabling any pending writes, verify that deployed and cached clients can update and recover from an unsupported family, and confirm how already-open older clients are handled. Do not enable writes solely because this code has shipped. Closeout conflict handling and the rest of the workflow must also be implemented before launch. The backend continues to receive only opaque encrypted records.

The server cannot check encrypted month or pending data. A pending capture on another device can race with closeout after the client refresh. After synchronization the authority reports a closed-month conflict until the month is reopened or its pending records are resolved. Reopening is explicit and uses the existing closeout Fund ledger workflow.

## Local development workflow

Start the frontend with `BUDGET_ENABLE_PENDING_DEV=1 npm run dev` and a local HTTP backend (`BACKEND_ORIGIN` defaults to `http://localhost:8000`). The development server enables the Review destination and pending writes only for a loopback backend and a loopback browser host. Production builds always disable the feature. Use a dedicated test account; older clients do not understand pending records.
