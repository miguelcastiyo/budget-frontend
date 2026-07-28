# Privacy & Vault: legacy account setup

This is the production-style path for moving a normal `legacy_plaintext` account to encrypted financial authority.

## Local manual workflow

1. Start the local frontend and backend and sign in with a fresh legacy test account.
2. Add a small representative set of financial data.
3. Open **Settings → Privacy & Vault**.
4. Choose **Protect my financial data**.
5. Create and confirm a Vault passphrase of at least 12 characters.
6. Copy the displayed **Recovery Code**, save it outside the browser, check the acknowledgment, and confirm the last four characters.
7. Review the readiness checkpoint and choose **Encrypt my financial data**.
8. Wait for **Preparing your data**, **Encrypting your data**, **Verifying**, and **Finishing up** to complete.
9. Continue back to Settings, reload, and unlock the Vault with the passphrase.
10. Confirm that the financial data is available after encrypted authority rehydration.

The passphrase and Recovery Code are handled in memory by the browser. They are not placed in URLs, browser storage, analytics, or application logs. Do not record them in screenshots or test output.

## Resume and failure behavior

Refreshing during an active migration returns to **Privacy setup in progress**. Enter the existing Vault passphrase to resume the persisted migration; setup does not create a second Vault or Recovery Code. A failed pre-cutover attempt can be retried, or cancelled when the migration API permits cancellation. Before cutover, the existing financial data remains authoritative.

After the backend confirms atomic cutover, the frontend refreshes privacy status and unlocks encrypted authority through the normal provider path. It does not set an encrypted flag locally.

## Test accounts

Keep separate local accounts for `legacy_plaintext` setup and already-encrypted Vault controls. Never hard-code real account identifiers or secrets into production code or browser fixtures.
