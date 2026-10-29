# Pending transaction compatibility rollout

Phase 1 recognizes and rehydrates `pending_transaction_v1`, but encrypted authority writes to this family are disabled. Older deployed clients reject unknown record families during unlock; they cannot safely ignore these records.

Deploy read support first. Before enabling any pending writes, verify that deployed and cached clients can update and recover from an unsupported family, and confirm how already-open older clients are handled. Do not enable writes solely because this code has shipped. Closeout conflict handling and the rest of the workflow must also be implemented before launch. The backend continues to receive only opaque encrypted records.
