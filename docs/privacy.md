# Frontend privacy architecture

The frontend supports two financial authority modes: legacy server-backed
financial routes and encrypted client-owned financial authority. The mode is
selected from the backend privacy status and is applied consistently through
`FinancialAuthorityProvider`.

## FinancialAuthorityProvider

`components/privacy/financial-authority-provider.tsx` is mounted inside the
authenticated app shell. It reads `GET /me/privacy` and maps the backend state
to these client modes:

| Client mode | Backend state | Behavior |
| --- | --- | --- |
| `setup` | `vault_setup_required` | Financial features remain blocked until Vault setup completes. |
| `legacy` | `legacy_plaintext` or `migration_failed` | Existing financial API routes remain authoritative. |
| `migration` | `migration_in_progress` | Migration UI is active; ordinary financial writes remain blocked. |
| `encrypted` | `encrypted` | The browser-owned encrypted authority handles financial reads and writes. |

When the mode is not `encrypted`, the provider clears the encrypted authority
and locks the Vault. It also installs the mode in the shared routing guard so
legacy financial mutations cannot bypass the privacy boundary.

## Vault lifecycle

`VaultManager` owns the in-memory `CryptoKey` and has `locked`, `unlocking`,
`unlocked`, and `error` states.

1. Setup generates the Vault key, passphrase wrapper, and Recovery Code wrapper
   in the browser.
2. The Recovery Code ceremony displays the code, supports copying it, requires
   the user to confirm that it was saved, and verifies the last four
   characters before continuing.
3. The backend receives wrapped-key material and safe profile metadata, never
   the raw Vault key, passphrase, or Recovery Code.
4. An encrypted account unlocks with the passphrase or Recovery Code. Recovery
   unlock requires a new passphrase, replacing the passphrase wrapper around
   the same Vault key.
5. Passphrase and Recovery Code rotation replace only the selected wrapper.
6. Locking clears the runtime key and removes the active encrypted authority.

The provider locks during unauthenticated state, provider unmount, failed
unlock/bootstrap, and explicit sign-out/lock flows. Raw secrets are cleared
from the relevant form state after successful operations. The encrypted
record store is an in-memory `Map`; it is not persisted to localStorage,
sessionStorage, IndexedDB, Cache Storage, or a service-worker cache.

## Client financial authority

After unlock, `EncryptedFinancialAuthority` bootstraps encrypted records and
rehydrates them into the transport-independent financial domain state. The
provider routes encrypted reads and mutations for:

- Transactions and transaction-linked Fund ledger entries;
- Funds and Fund details;
- Budget settings;
- Tags, Contexts, and Cards;
- Recurring expenses;
- Savings Plans;
- Month Closeouts;
- Overview and Insights derived values; and
- encrypted data screens.

These operations use pure client financial-domain functions over decrypted
runtime state. The server does not calculate or search the financial meaning
of encrypted records. While the Vault is locked, encrypted financial UI is
blocked rather than falling back to legacy routes.

## Encrypted sync

On bootstrap, the authority requests `/me/encrypted-records/sync` in cursor
order, decrypts each envelope with the runtime key, removes tombstones, and
rehydrates the complete client state. The local store tracks the sync cursor
and decrypted records only in memory.

Mutations encrypt a source record with its family, schema version, source ID,
and data, then send opaque envelopes to the backend. Updates and tombstones
use the current record revision as the optimistic-concurrency expectation.
Cross-domain commands use the batch endpoint so related creates, updates, and
tombstones commit together. The local store is updated only after the server
accepts the mutation.

## Runtime memory boundary

While unlocked, decrypted financial data necessarily exists in JavaScript
memory and the rendered DOM. This is runtime exposure, not durable storage.
The browser also holds the usable Vault key in memory. A browser extension,
compromised device, or malicious future JavaScript deployment could capture
secrets or plaintext while the account is unlocked.

## Quick Unlock

Quick Unlock is an optional convenience method for the existing Vault. When
enabled, the current authenticated device can explicitly request device
verification to recover the existing Vault key locally. It does not create an
account session, replace the Vault passphrase or Recovery Code, change the
financial encryption format, or persist the decrypted Vault key.

Runtime destruction or refresh still leaves the Vault locked. An approved
unlock method is then required: Quick Unlock when enrolled and available, the
Vault passphrase, or the existing recovery flow. Quick Unlock status is scoped
to the current Budget device authorization and can be revoked from Privacy &
Vault settings.

The frontend must not log authentication material, complete API payloads,
transaction descriptions or notes, income, Fund names or balances, Savings
Plan data, session identifiers, Vault keys, Recovery Codes, or decrypted
financial records.

## Recovery and cross-device behavior

The Recovery Code is a separate browser-generated unlock path, not an account
sign-in credential. If both the Vault passphrase and Recovery Code are lost,
the service and operator cannot recover encrypted financial data.

A new device starts without the runtime key and must authenticate, retrieve
Vault metadata, and unlock locally with the passphrase or Recovery Code. After
unlock, it downloads encrypted changes, decrypts them in memory, and rebuilds
the same client financial state. Mutations from one device become available to
another through the encrypted sync cursor and change log.

Signing in or resetting the normal account credential does not unlock the
Vault. Authentication recovery and Vault recovery are separate; Vault recovery
uses the user's Recovery Code and requires a new passphrase. A passphrase
wrapper uses PBKDF2-HMAC-SHA-256 with 600,000 iterations, but a database copy
can still be used for offline guesses. New passphrases reject obvious common
words and repeated patterns, while protection still depends partly on
passphrase entropy.

Passphrase and Recovery Code rotation replaces only the selected wrapper around
the same Vault key. The old credential stops working against the live account,
but historical snapshots may retain old wrapper material until the verified
seven-snapshot retention boundary expires. Rotation is not historical-copy
erasure.

Locking or revoking a device prevents future authenticated sync. It does not
claim to erase plaintext or secrets that the device already learned.

Signing out ends the current session but does not remove the Budget device or
disable Quick Unlock. Removing a device is stronger: it revokes all sessions
and Quick Unlock authorization associated with that device. Budget cannot erase
a Vault key already resident in an offline browser or delete a platform
credential from Apple, iCloud Keychain, or another credential manager.
