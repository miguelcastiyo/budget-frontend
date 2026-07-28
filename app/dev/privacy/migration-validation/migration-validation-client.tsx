"use client"

import { useEffect, useState } from "react"
import { ApiError, apiClient } from "../../../../lib/api/client"
import { encryptMigrationRecords, runMigrationStaging } from "../../../../lib/privacy/migration"
import { VaultManager } from "../../../../lib/privacy/vault-manager"
import { useFinancialAuthority } from "../../../../components/privacy/financial-authority-provider"
import Link from "next/link"
import { createEncryptedRecordId } from "../../../../lib/privacy/encrypted-records/crypto"
import { transactionFundDiff, transactionFundState, type SourceRecord } from "../../../../lib/domain/financial/transaction-fund-diff"
import { RecoveryCodeCeremony } from "../../../../components/privacy/recovery-code-ceremony"

const passphrase = "phase5-browser-passphrase"
const manager = new VaultManager()

export function MigrationValidationClient() {
  const financialAuthority = useFinancialAuthority()
  const [migrationId, setMigrationId] = useState<string | null>(null)
  const [stage, setStage] = useState("idle")
  const [error, setError] = useState<string | null>(null)
  const [partialLimit, setPartialLimit] = useState(0)
  const [lastStatus, setLastStatus] = useState<unknown>(null)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)

  useEffect(() => { void apiClient.getPrivacyStatus().then((status) => { const migration = status.active_migration ?? status.latest_migration; if (migration) setMigrationId(migration.migration_id) }).catch(() => undefined) }, [])

  async function unlockOrInitialize() {
    let existing: Awaited<ReturnType<typeof apiClient.getVault>> | null = null
    try { existing = await apiClient.getVault() } catch (cause) { if (!(cause instanceof ApiError) || cause.status !== 404) throw cause }
    if (existing) {
      await manager.unlockWithPassphrase(passphrase, {
        crypto_profile_version: 1,
        passphrase_wrap: existing.passphrase,
        recovery_wrap: existing.recovery,
      })
      setStage("vault_unlocked")
      return
    }
    await manager.initialize(passphrase, async (created) => { setRecoveryCode(created.recoverySecret); await apiClient.initializeVault(created.payload) })
    setStage("vault_unlocked")
  }

  async function start() {
    setError(null)
    try { const result = await apiClient.startMigration(); setMigrationId(result.migration.migration_id); setLastStatus(result); setStage("migration_in_progress") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "start failed") }
  }

  async function upload(limit = 0) {
    if (!migrationId) throw new Error("MIGRATION_NOT_STARTED")
    const runtimeKey = manager.getRuntimeKey()
    if (!runtimeKey) throw new Error("VAULT_LOCKED")
    const snapshot = await apiClient.getMigrationSnapshot(migrationId)
    const vault = await apiClient.getVault()
    const encrypted = await encryptMigrationRecords(runtimeKey, vault.vault_id, snapshot)
    await apiClient.putMigrationManifest(migrationId, encrypted.manifest)
    const records = limit > 0 ? encrypted.records.slice(0, limit) : encrypted.records
    for (const record of records) await apiClient.putMigrationRecord(migrationId, record.target_record_id, record)
    if (limit === 0) { setStage("verifying"); await apiClient.verifyMigration(migrationId); setStage("staged_ready") }
    else setStage(`partial:${records.length}/${encrypted.records.length}`)
  }

  async function cancel() { if (!migrationId) throw new Error("MIGRATION_NOT_STARTED"); await apiClient.cancelMigration(migrationId); manager.lock(); setStage("cancelled") }
  async function cutover() {
    if (!migrationId) throw new Error("MIGRATION_NOT_STARTED")
    const result = await apiClient.cutoverMigration(migrationId)
    setStage(result.financial_privacy_state === "encrypted" ? "encrypted_authority" : "cutover_unexpected_state")
    return result
  }
  async function syncEncryptedAuthority() {
    const result = await apiClient.syncEncryptedRecords("0", 100)
    setStage(`encrypted_sync:${result.changes.length}`)
    return result
  }
  async function unlockFinancialAuthority() {
    await financialAuthority.unlock(passphrase)
    setStage("authority_unlocked")
  }
  async function conflictProof() {
    const authority = financialAuthority.authority
    if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
    const transaction = [...authority.store.values()].find((record) => record.family === "transaction")
    if (!transaction) throw new Error("NO_TRANSACTION_RECORD")
    const transactionNumericId = transaction.sourceId.split(":").pop()
    let entry = [...authority.store.values()].find((record) => record.family === "fund_ledger_entry" && [transaction.sourceId, transactionNumericId].includes(String(record.data.source_transaction_id ?? "")))
    if (!entry) throw new Error("NO_RELATED_FINANCIAL_RECORDS")
    const previous = transactionFundState(
      { id: transaction.envelope.record_id, family: "transaction", data: transaction.data } as SourceRecord,
      { id: entry.envelope.record_id, family: "fund_ledger_entry", data: entry.data } as SourceRecord,
    )
    const next = transactionFundState(
      { id: transaction.envelope.record_id, family: "transaction", data: { ...transaction.data, notes: `${String(transaction.data.notes ?? "")} conflict-probe` } } as SourceRecord,
      { id: entry.envelope.record_id, family: "fund_ledger_entry", data: { ...entry.data, note: `${String(entry.data.note ?? "")} conflict-probe` } } as SourceRecord,
    )
    try {
      await authority.commitSourceDiff(transactionFundDiff(previous, next), `phase6c_conflict_${transaction.envelope.record_id.replace(/[^A-Za-z0-9_-]/g, "_")}`, { expectedRevisionOverrides: { [entry.envelope.record_id]: entry.envelope.record_revision + 1 } })
    } catch (cause) {
      if (cause instanceof ApiError && cause.error.code === "ENCRYPTED_RECORD_REVISION_CONFLICT") { setStage("conflict_rollback_passed"); return }
      throw cause
    }
    throw new Error("CONFLICT_NOT_REJECTED")
  }
  async function idempotencyProof() {
    const authority = financialAuthority.authority
    if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
    const id = createEncryptedRecordId()
    const record: SourceRecord = { id, family: "transaction", data: { id, date: "2026-07-01", expense: "6C idempotency probe", amount_cents: 1234, category: "needs", is_split: false, notes: null, source: "manual", tag_id: null, context_id: null, card_id: null, is_deleted: false } }
    const key = `phase6c_idempotency_${id}`
    await authority.commitSourceDiff({ creates: [record], updates: [], tombstones: [] }, key)
    const replay = await authority.commitSourceDiff({ creates: [record], updates: [], tombstones: [] }, key)
    if (!replay.idempotent) throw new Error("IDEMPOTENCY_REPLAY_NOT_STABLE")
    setStage("idempotency_passed")
  }
  function lockFinancialAuthority() {
    financialAuthority.lock()
    setStage("authority_locked")
  }
  async function mutation() {
    const tags = await apiClient.getTags()
    const tag = tags.items?.[0]
    if (!tag) throw new Error("NO_SYNTHETIC_TAG")
    const result = await apiClient.createTransaction({ date: "2026-07-01", expense: "Phase 5 browser mutation", amount: "1.00", category: "needs", tag_id: tag.id })
    setStage("mutation_succeeded")
    return result
  }
  async function run(action: () => Promise<unknown>) { setError(null); try { setLastStatus(await action()) } catch (cause) { const message = cause instanceof ApiError ? `${cause.error.code}: ${cause.error.message}` : cause instanceof Error ? cause.message : "operation failed"; setError(message); setStage(`error:${message}`) } }

  return <main data-testid="migration-validation" style={{ maxWidth: 760, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
    <h1>Migration staging validation</h1>
    <p>This development-only surface uses the real session, Vault, migration APIs, and MariaDB-backed staging. It never displays financial snapshot contents.</p>
    <div style={{ display: "grid", gap: 12 }}>
      <button type="button" data-testid="vault-unlock" onClick={() => void run(unlockOrInitialize)}>Initialize or unlock Vault</button>
      <button type="button" data-testid="migration-start" onClick={() => void run(start)}>Start migration</button>
      <label>Partial upload count <input data-testid="partial-limit" type="number" min="0" value={partialLimit} onChange={(event) => setPartialLimit(Number(event.target.value))} /></label>
      <button type="button" data-testid="migration-partial" onClick={() => void run(() => upload(partialLimit || 1))}>Upload partial staging</button>
      <button type="button" data-testid="migration-resume" onClick={() => void run(() => upload())}>Resume and verify staging</button>
      <button type="button" data-testid="migration-cancel" onClick={() => void run(cancel)}>Cancel migration</button>
      <button type="button" data-testid="migration-cutover" onClick={() => void run(cutover)}>Promote encrypted authority</button>
      <button type="button" data-testid="encrypted-sync" onClick={() => void run(syncEncryptedAuthority)}>Sync encrypted authority</button>
      <button type="button" data-testid="authority-unlock" onClick={() => void run(unlockFinancialAuthority)} disabled={financialAuthority.mode !== "encrypted"}>Unlock financial authority</button>
      <button type="button" data-testid="authority-lock" onClick={lockFinancialAuthority}>Lock financial authority</button>
      <button type="button" data-testid="authority-conflict" onClick={() => void run(conflictProof)}>Run atomic conflict proof</button>
      <button type="button" data-testid="authority-idempotency" onClick={() => void run(idempotencyProof)}>Run idempotent retry proof</button>
      <button type="button" data-testid="migration-mutation" onClick={() => void run(mutation)}>Attempt financial mutation</button>
      <Link data-testid="validation-transactions" href="/transactions">Open Transactions</Link>
      <Link data-testid="validation-funds" href="/insights/funds">Open Funds</Link>
    </div>
    <p data-testid="migration-stage">{stage}</p>
    <p data-testid="authority-mode">authority:{financialAuthority.mode}:{financialAuthority.authority ? "unlocked" : "locked"}</p>
    <p data-testid="migration-id">{migrationId ?? ""}</p>
    {error ? <p data-testid="migration-error">{error}</p> : null}
    {recoveryCode ? <RecoveryCodeCeremony code={recoveryCode} onConfirmed={() => setRecoveryCode(null)} /> : null}
    <pre data-testid="migration-status">{lastStatus ? JSON.stringify(lastStatus) : ""}</pre>
  </main>
}
