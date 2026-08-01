import { base64UrlToBytes, bytesToBase64Url } from "../encoding"
import { canonicalEncryptedRecordAad } from "./aad"
import { EncryptedRecordClientError, type EncryptedRecordEnvelope } from "./types"

function webCrypto(): Crypto {
  if (typeof window === "undefined" || !window.isSecureContext || !window.crypto?.subtle) throw new EncryptedRecordClientError("VAULT_LOCKED", "A secure unlocked Vault is required")
  return window.crypto
}

function recordId(): string {
  return `rec_${bytesToBase64Url(webCrypto().getRandomValues(new Uint8Array(18)))}`
}

function mutationId(): string {
  return `mut_${bytesToBase64Url(webCrypto().getRandomValues(new Uint8Array(18)))}`
}

export function createEncryptedRecordId(): string { return recordId() }
export function createEncryptedRecordMutationId(): string { return mutationId() }

async function deterministicToken(prefix: string, value: string): Promise<string> {
  const digest = await webCrypto().subtle.digest("SHA-256", new TextEncoder().encode(value))
  return `${prefix}${bytesToBase64Url(new Uint8Array(digest).slice(0, 18))}`
}

export function createDeterministicEncryptedRecordId(value: string): Promise<string> { return deterministicToken("rec_", value) }
export function createDeterministicEncryptedRecordMutationId(value: string): Promise<string> { return deterministicToken("mut_", value) }

export async function encryptSyntheticRecord(runtimeKey: CryptoKey, vaultId: string, value: unknown, revision = 1, id = recordId()): Promise<{ envelope: EncryptedRecordEnvelope; idempotencyKey: string }> {
  if (!runtimeKey || runtimeKey.extractable) throw new EncryptedRecordClientError("VAULT_LOCKED", "An unlocked non-extractable Vault is required")
  const crypto = webCrypto()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aad = canonicalEncryptedRecordAad({ envelopeVersion: 1, vaultId, recordId: id, recordRevision: revision })
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  try {
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, runtimeKey, plaintext)
    return {
      envelope: { vault_id: vaultId, record_id: id, envelope_version: 1, record_revision: revision, iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)), sync_sequence: "0", deleted: false },
      idempotencyKey: mutationId(),
    }
  } catch { throw new EncryptedRecordClientError("ENCRYPTED_RECORD_ENCRYPT_FAILED", "The synthetic record could not be encrypted") }
}

export async function decryptSyntheticRecord(runtimeKey: CryptoKey | null, envelope: EncryptedRecordEnvelope): Promise<unknown> {
  if (!runtimeKey || runtimeKey.extractable) throw new EncryptedRecordClientError("VAULT_LOCKED", "An unlocked non-extractable Vault is required")
  if (envelope.deleted) throw new EncryptedRecordClientError("ENCRYPTED_RECORD_TOMBSTONED", "The encrypted record is deleted")
  if (envelope.envelope_version !== 1 || !envelope.iv || !envelope.ciphertext) throw new EncryptedRecordClientError("ENCRYPTED_RECORD_VERSION_UNSUPPORTED", "The encrypted record envelope is unsupported")
  try {
    const plaintext = await webCrypto().subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(envelope.iv), additionalData: canonicalEncryptedRecordAad({ envelopeVersion: 1, vaultId: envelope.vault_id, recordId: envelope.record_id, recordRevision: envelope.record_revision }) }, runtimeKey, base64UrlToBytes(envelope.ciphertext))
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown
  } catch { throw new EncryptedRecordClientError("ENCRYPTED_RECORD_DECRYPT_FAILED", "The encrypted record could not be authenticated") }
}
