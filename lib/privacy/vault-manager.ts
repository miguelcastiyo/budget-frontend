import type { VaultInitializationPayload } from "./vault-crypto"
import { createVault, unlockWithPassphrase, unlockWithRecoverySecret } from "./vault-crypto"

export type VaultManagerState = "locked" | "unlocking" | "unlocked" | "error"

export class VaultManager {
  private key: CryptoKey | null = null
  private state: VaultManagerState = "locked"

  getState() { return this.state }
  getRuntimeKey() { return this.key }

  async initialize(passphrase: string, onCreated?: (result: Awaited<ReturnType<typeof createVault>>) => Promise<void> | void) {
    this.state = "unlocking"
    try {
      const result = await createVault(passphrase)
      this.key = result.runtimeKey
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
    try { this.key = await unlockWithPassphrase(passphrase, metadata); this.state = "unlocked"; return this.key }
    catch (error) { this.lock(); this.state = "error"; throw error }
  }

  async unlockWithRecoverySecret(secret: string, metadata: VaultInitializationPayload) {
    this.state = "unlocking"
    try { this.key = await unlockWithRecoverySecret(secret, metadata); this.state = "unlocked"; return this.key }
    catch (error) { this.lock(); this.state = "error"; throw error }
  }

  async installRuntimeKey(runtimeKey: CryptoKey) {
    this.state = "unlocking"
    try { this.key = runtimeKey; this.state = "unlocked"; return runtimeKey }
    catch (error) { this.lock(); this.state = "error"; throw error }
  }

  lock() { this.key = null; this.state = "locked" }
}
