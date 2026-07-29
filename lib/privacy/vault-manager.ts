import type { VaultInitializationPayload } from "./vault-crypto"
import { createVault, unlockWithPassphraseKeys, unlockWithRecoverySecretKeys } from "./vault-crypto"

export type VaultManagerState = "locked" | "unlocking" | "unlocked" | "error"

export class VaultManager {
  private key: CryptoKey | null = null
  private quickUnlockWrapKey: CryptoKey | null = null
  private state: VaultManagerState = "locked"

  getState() { return this.state }
  getRuntimeKey() { return this.key }
  getQuickUnlockWrapKey() { return this.quickUnlockWrapKey }

  async initialize(passphrase: string, onCreated?: (result: Awaited<ReturnType<typeof createVault>>) => Promise<void> | void) {
    this.state = "unlocking"
    try {
      const result = await createVault(passphrase)
      this.key = result.runtimeKey
      this.quickUnlockWrapKey = result.quickUnlockWrapKey
      await onCreated?.(result)
      this.state = "unlocked"
      return result
    } catch (error) {
      this.lock()
      this.state = "error"
      throw error
    }
  }

  async unlockWithPassphrase(passphrase: string, metadata: VaultInitializationPayload) {
    this.state = "unlocking"
    try { const keys = await unlockWithPassphraseKeys(passphrase, metadata); this.key = keys.runtimeKey; this.quickUnlockWrapKey = keys.quickUnlockWrapKey; this.state = "unlocked"; return this.key }
    catch (error) { this.lock(); this.state = "error"; throw error }
  }

  async unlockWithRecoverySecret(secret: string, metadata: VaultInitializationPayload) {
    this.state = "unlocking"
    try { const keys = await unlockWithRecoverySecretKeys(secret, metadata); this.key = keys.runtimeKey; this.quickUnlockWrapKey = keys.quickUnlockWrapKey; this.state = "unlocked"; return this.key }
    catch (error) { this.lock(); this.state = "error"; throw error }
  }

  async installRuntimeKey(runtimeKey: CryptoKey) {
    this.state = "unlocking"
    try { this.key = runtimeKey; this.quickUnlockWrapKey = null; this.state = "unlocked"; return runtimeKey }
    catch (error) { this.lock(); this.state = "error"; throw error }
  }

  lock() { this.key = null; this.quickUnlockWrapKey = null; this.state = "locked" }
}
