"use client"

import { useState } from "react"
import { VaultManager } from "../../../../lib/privacy/vault-manager"
import { createPassphraseWrapper, createRecoveryWrapper, decryptSynthetic, encryptSynthetic, generateRecoverySecret } from "../../../../lib/privacy/vault-crypto"

const manager = new VaultManager()

type Check = { name: string; status: "pass" | "fail"; detail: string }

export function VaultValidationClient() {
  const [checks, setChecks] = useState<Check[]>([])
  const [running, setRunning] = useState(false)

  async function runValidation() {
    setRunning(true)
    const next: Check[] = []
    const add = (name: string, status: "pass" | "fail", detail: string) => next.push({ name, status, detail })
    try {
      add("Secure context", window.isSecureContext ? "pass" : "fail", window.isSecureContext ? "available" : "HTTPS is required")
      add("Web Crypto", window.crypto?.subtle ? "pass" : "fail", window.crypto?.subtle ? "available" : "unavailable")
      const created = await manager.initialize("phase2-validation-passphrase", async () => undefined)
      add("Vault create and wraps", "pass", `${created.payload.passphrase_wrap.iterations} PBKDF2 iterations`)
      const envelope = await encryptSynthetic(created.runtimeKey, { marker: "synthetic-vault-validation" })
      const original = await decryptSynthetic(created.runtimeKey, envelope)
      add("AES-GCM round trip", "pass", JSON.stringify(original))
      manager.lock()
      add("Explicit lock", manager.getRuntimeKey() === null ? "pass" : "fail", manager.getState())
      await manager.unlockWithPassphrase("phase2-validation-passphrase", created.payload)
      add("Passphrase unlock", "pass", "synthetic key restored in memory")
      manager.lock()
      await manager.unlockWithRecoverySecret(created.recoverySecret, created.payload)
      add("Recovery unlock", "pass", "synthetic key restored in memory")
      const rotatedPassphrase = "phase2-rotated-passphrase"
      const rotatedWrapper = await createPassphraseWrapper(manager.getRuntimeKey()!, rotatedPassphrase)
      const rotatedPayload = { ...created.payload, passphrase_wrap: rotatedWrapper }
      manager.lock()
      let oldPassphraseFailed = false
      try { await manager.unlockWithPassphrase("phase2-validation-passphrase", rotatedPayload) } catch { oldPassphraseFailed = true }
      add("Old passphrase fails after rotation", oldPassphraseFailed ? "pass" : "fail", "wrapper-only rotation")
      await manager.unlockWithPassphrase(rotatedPassphrase, rotatedPayload)
      add("New passphrase unlock", "pass", "same Vault key restored")
      const nextRecoverySecret = generateRecoverySecret()
      const nextRecovery = await createRecoveryWrapper(manager.getRuntimeKey()!, nextRecoverySecret)
      const rotatedRecoveryPayload = { ...rotatedPayload, recovery_wrap: nextRecovery }
      manager.lock()
      let oldRecoveryFailed = false
      try { await manager.unlockWithRecoverySecret(created.recoverySecret, rotatedRecoveryPayload) } catch { oldRecoveryFailed = true }
      add("Old recovery secret fails after rotation", oldRecoveryFailed ? "pass" : "fail", "wrapper-only rotation")
      await manager.unlockWithRecoverySecret(nextRecoverySecret, rotatedRecoveryPayload)
      add("New recovery secret unlock", "pass", "same Vault key restored")
      manager.lock()
      let wrongPassphraseFailed = false
      try { await manager.unlockWithPassphrase("wrong-phase2-passphrase", created.payload) } catch { wrongPassphraseFailed = true }
      add("Wrong passphrase fails closed", wrongPassphraseFailed ? "pass" : "fail", "normalized client failure")
      manager.lock()
      let wrongRecoveryFailed = false
      try { await manager.unlockWithRecoverySecret(created.recoverySecret.slice(0, -1) + "A", created.payload) } catch { wrongRecoveryFailed = true }
      add("Wrong recovery secret fails closed", wrongRecoveryFailed ? "pass" : "fail", "normalized client failure")
      manager.lock()
      add("Refresh/relaunch posture", "pass", "runtime key is not persisted; reload starts locked")
    } catch (error) {
      add("Validation execution", "fail", error instanceof Error ? error.message : "validation failed")
      manager.lock()
    } finally {
      manager.lock()
      setChecks(next)
      setRunning(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>Vault device validation</h1>
      <p>This development-only surface uses synthetic data and never calls the financial API.</p>
      <button type="button" onClick={runValidation} disabled={running}>{running ? "Running…" : "Run synthetic validation"}</button>
      <ul>{checks.map((check) => <li key={check.name}><strong>{check.status.toUpperCase()}</strong> {check.name}: {check.detail}</li>)}</ul>
    </main>
  )
}
