import { VAULT_CRYPTO_PROFILE } from "./crypto-profile"
import { base64UrlToBytes, bytesToBase64Url } from "./encoding"

export interface VaultInitializationPayload {
  crypto_profile_version: 1
  passphrase_wrap: {
    kdf: "PBKDF2"
    kdf_hash: "SHA-256"
    iterations: number
    salt: string
    wrap_algorithm: "AES-KW"
    wrapped_vault_key: string
  }
  recovery_wrap: {
    wrap_algorithm: "AES-KW"
    wrapped_vault_key: string
  }
}

export interface CreatedVault {
  payload: VaultInitializationPayload
  recoverySecret: string
  runtimeKey: CryptoKey
  /**
   * A memory-only extractable copy used for an explicit wrapper operation
   * (for example Quick Unlock enrollment). The operational runtime key stays
   * non-extractable and this copy is never persisted.
   */
  quickUnlockWrapKey: CryptoKey
}

export interface VaultUnlockKeys {
  runtimeKey: CryptoKey
  quickUnlockWrapKey: CryptoKey
}

const vaultKeyAlgorithm = { name: "AES-GCM", length: 256 } as const
const wrapAlgorithm = { name: "AES-KW", length: 256 } as const

function cryptoApi(): Crypto {
  if (typeof window === "undefined" || !window.isSecureContext || !window.crypto?.subtle) {
    throw new Error("A secure browser Web Crypto context is required")
  }
  return window.crypto
}

export function validateNewPassphrase(passphrase: string): string | null {
  const normalized = passphrase.trim().toLowerCase().replace(/\s+/g, "")
  if (normalized.length < 12) return "Use at least 12 characters for your Vault passphrase."
  if (/^(.)\1+$/.test(normalized) || /^(password|qwerty|budget|123456|letmein)+$/.test(normalized)) {
    return "Choose a longer, unique Vault passphrase that is not a common word or pattern."
  }
  return null
}

function requireNewPassphrase(passphrase: string) {
  const error = validateNewPassphrase(passphrase)
  if (error) throw new Error("VAULT_PASSPHRASE_TOO_WEAK")
}

function requireUnlockPassphrase(passphrase: string) {
  if (passphrase.trim().length < 12) throw new Error("Passphrase must be at least 12 characters")
}

async function derivePassphraseKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const crypto = cryptoApi()
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: VAULT_CRYPTO_PROFILE.passphraseKdfIterations, hash: "SHA-256" },
    material,
    wrapAlgorithm,
    false,
    ["wrapKey", "unwrapKey"]
  )
}

async function derivePassphraseKeyWithIterations(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const crypto = cryptoApi()
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, wrapAlgorithm, false, ["wrapKey", "unwrapKey"])
}

async function unwrapVaultKey(wrapped: Uint8Array, wrappingKey: CryptoKey, extractable: boolean): Promise<CryptoKey> {
  return cryptoApi().subtle.unwrapKey(
    "raw",
    wrapped,
    wrappingKey,
    "AES-KW",
    vaultKeyAlgorithm,
    extractable,
    ["encrypt", "decrypt"]
  )
}

export async function createVault(passphrase: string): Promise<CreatedVault> {
  requireNewPassphrase(passphrase)
  const crypto = cryptoApi()
  const salt = crypto.getRandomValues(new Uint8Array(VAULT_CRYPTO_PROFILE.saltBytes))
  const recoveryBytes = crypto.getRandomValues(new Uint8Array(VAULT_CRYPTO_PROFILE.recoverySecretBytes))
  const vaultKey = await crypto.subtle.generateKey(vaultKeyAlgorithm, true, ["encrypt", "decrypt"])
  const passphraseKey = await derivePassphraseKey(passphrase, salt)
  const recoveryKey = await crypto.subtle.importKey("raw", recoveryBytes, wrapAlgorithm, false, ["wrapKey", "unwrapKey"])
  const [passphraseWrapped, recoveryWrapped] = await Promise.all([
    crypto.subtle.wrapKey("raw", vaultKey, passphraseKey, "AES-KW"),
    crypto.subtle.wrapKey("raw", vaultKey, recoveryKey, "AES-KW"),
  ])
  const runtimeKey = await unwrapVaultKey(new Uint8Array(passphraseWrapped), passphraseKey, false)
  return {
    payload: {
      crypto_profile_version: 1,
      passphrase_wrap: {
        kdf: "PBKDF2",
        kdf_hash: "SHA-256",
        iterations: VAULT_CRYPTO_PROFILE.passphraseKdfIterations,
        salt: bytesToBase64Url(salt),
        wrap_algorithm: "AES-KW",
        wrapped_vault_key: bytesToBase64Url(new Uint8Array(passphraseWrapped)),
      },
      recovery_wrap: { wrap_algorithm: "AES-KW", wrapped_vault_key: bytesToBase64Url(new Uint8Array(recoveryWrapped)) },
    },
    recoverySecret: bytesToBase64Url(recoveryBytes),
    runtimeKey,
    quickUnlockWrapKey: vaultKey,
  }
}

export async function unlockWithPassphraseKeys(passphrase: string, metadata: VaultInitializationPayload): Promise<VaultUnlockKeys> {
  requireUnlockPassphrase(passphrase)
  try {
    const key = await derivePassphraseKey(passphrase, base64UrlToBytes(metadata.passphrase_wrap.salt))
    const wrapped = base64UrlToBytes(metadata.passphrase_wrap.wrapped_vault_key)
    const [runtimeKey, quickUnlockWrapKey] = await Promise.all([
      unwrapVaultKey(wrapped, key, false),
      unwrapVaultKey(wrapped, key, true),
    ])
    return { runtimeKey, quickUnlockWrapKey }
  } catch {
    throw new Error("VAULT_UNLOCK_FAILED")
  }
}

export async function unlockWithPassphrase(passphrase: string, metadata: VaultInitializationPayload): Promise<CryptoKey> {
  return (await unlockWithPassphraseKeys(passphrase, metadata)).runtimeKey
}

export async function unlockWithRecoverySecretKeys(recoverySecret: string, metadata: VaultInitializationPayload): Promise<VaultUnlockKeys> {
  try {
    const recoveryBytes = base64UrlToBytes(recoverySecret)
    if (recoveryBytes.length !== VAULT_CRYPTO_PROFILE.recoverySecretBytes) throw new Error("invalid recovery secret")
    const key = await cryptoApi().subtle.importKey("raw", recoveryBytes, wrapAlgorithm, false, ["wrapKey", "unwrapKey"])
    const wrapped = base64UrlToBytes(metadata.recovery_wrap.wrapped_vault_key)
    const [runtimeKey, quickUnlockWrapKey] = await Promise.all([
      unwrapVaultKey(wrapped, key, false),
      unwrapVaultKey(wrapped, key, true),
    ])
    return { runtimeKey, quickUnlockWrapKey }
  } catch {
    throw new Error("VAULT_RECOVERY_FAILED")
  }
}

export async function unlockWithRecoverySecret(recoverySecret: string, metadata: VaultInitializationPayload): Promise<CryptoKey> {
  return (await unlockWithRecoverySecretKeys(recoverySecret, metadata)).runtimeKey
}

export async function createPassphraseWrapper(runtimeKey: CryptoKey, passphrase: string): Promise<VaultInitializationPayload["passphrase_wrap"]> {
  requireNewPassphrase(passphrase)
  const salt = cryptoApi().getRandomValues(new Uint8Array(VAULT_CRYPTO_PROFILE.saltBytes))
  const wrappingKey = await derivePassphraseKeyWithIterations(passphrase, salt, VAULT_CRYPTO_PROFILE.passphraseKdfIterations)
  const wrapped = await cryptoApi().subtle.wrapKey("raw", runtimeKey, wrappingKey, "AES-KW")
  return { kdf: "PBKDF2", kdf_hash: "SHA-256", iterations: VAULT_CRYPTO_PROFILE.passphraseKdfIterations, salt: bytesToBase64Url(salt), wrap_algorithm: "AES-KW", wrapped_vault_key: bytesToBase64Url(new Uint8Array(wrapped)) }
}

export async function createRecoveryWrapper(runtimeKey: CryptoKey, recoverySecret: string): Promise<VaultInitializationPayload["recovery_wrap"]> {
  const bytes = base64UrlToBytes(recoverySecret)
  if (bytes.length !== VAULT_CRYPTO_PROFILE.recoverySecretBytes) throw new Error("invalid recovery secret")
  const key = await cryptoApi().subtle.importKey("raw", bytes, wrapAlgorithm, false, ["wrapKey"])
  const wrapped = await cryptoApi().subtle.wrapKey("raw", runtimeKey, key, "AES-KW")
  return { wrap_algorithm: "AES-KW", wrapped_vault_key: bytesToBase64Url(new Uint8Array(wrapped)) }
}

export function generateRecoverySecret(): string {
  return bytesToBase64Url(cryptoApi().getRandomValues(new Uint8Array(VAULT_CRYPTO_PROFILE.recoverySecretBytes)))
}

export async function encryptSynthetic(runtimeKey: CryptoKey, value: unknown) {
  const iv = cryptoApi().getRandomValues(new Uint8Array(VAULT_CRYPTO_PROFILE.ivBytes))
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertext = await cryptoApi().subtle.encrypt({ name: "AES-GCM", iv }, runtimeKey, plaintext)
  return { algorithm: "AES-GCM" as const, iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) }
}

export async function decryptSynthetic(runtimeKey: CryptoKey, envelope: { algorithm: "AES-GCM"; iv: string; ciphertext: string }) {
  if (envelope.algorithm !== "AES-GCM") throw new Error("Unsupported synthetic envelope")
  const plaintext = await cryptoApi().subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(envelope.iv) }, runtimeKey, base64UrlToBytes(envelope.ciphertext))
  return JSON.parse(new TextDecoder().decode(plaintext)) as unknown
}
