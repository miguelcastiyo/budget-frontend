export const VAULT_CRYPTO_PROFILE = {
  version: 1,
  vaultKeyAlgorithm: "AES-GCM",
  vaultKeyLength: 256,
  passphraseKdf: "PBKDF2",
  passphraseKdfHash: "SHA-256",
  passphraseKdfIterations: 600_000,
  passphraseWrapAlgorithm: "AES-KW",
  saltBytes: 32,
  recoverySecretBytes: 32,
  ivBytes: 12,
} as const

export type VaultCryptoProfile = typeof VAULT_CRYPTO_PROFILE
