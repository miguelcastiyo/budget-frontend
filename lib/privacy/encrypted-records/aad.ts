import { bytesToBase64Url } from "../encoding"

export interface EncryptedRecordAadInput {
  envelopeVersion: 1
  vaultId: string
  recordId: string
  recordRevision: number
}

function field(name: string, value: string): string {
  return `${name}=${value.length}:${value}`
}

export function canonicalEncryptedRecordAad(input: EncryptedRecordAadInput): Uint8Array {
  if (input.envelopeVersion !== 1 || !Number.isSafeInteger(input.recordRevision) || input.recordRevision < 1) {
    throw new Error("ENCRYPTED_RECORD_METADATA_INVALID")
  }
  const canonical = [
    "phase3-aad-v1",
    field("envelope_version", "1"),
    field("vault_id", input.vaultId),
    field("record_id", input.recordId),
    field("record_revision", String(input.recordRevision)),
  ].join("|")
  return new TextEncoder().encode(canonical)
}

export function canonicalEncryptedRecordAadBase64(input: EncryptedRecordAadInput): string {
  return bytesToBase64Url(canonicalEncryptedRecordAad(input))
}
