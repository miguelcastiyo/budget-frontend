import { base64UrlToBytes, bytesToBase64Url } from "./encoding"

export const QUICK_UNLOCK_PROFILE_VERSION = 1
const wrapAlgorithm = { name: "AES-KW", length: 256 } as const
const vaultKeyAlgorithm = { name: "AES-GCM", length: 256 } as const

export interface QuickUnlockCapability {
  supported: boolean
  secureContext: boolean
}

export function quickUnlockCapability(): QuickUnlockCapability {
  const secureContext = typeof window !== "undefined" && window.isSecureContext
  return { supported: secureContext && typeof PublicKeyCredential !== "undefined" && typeof navigator.credentials?.create === "function" && typeof navigator.credentials?.get === "function", secureContext }
}

export function createPrfInput(): Uint8Array {
  if (!quickUnlockCapability().secureContext) throw new Error("QUICK_UNLOCK_UNSUPPORTED")
  return crypto.getRandomValues(new Uint8Array(32))
}

export function extractPrfResult(credential: Credential): ArrayBuffer | null {
  const result = (credential as PublicKeyCredential).getClientExtensionResults?.() as { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } } | undefined
  if (result?.prf?.enabled !== true) return null
  return result.prf.results?.first ?? null
}

export function serializeRegistrationCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAttestationResponse
  return { id: credential.id, type: credential.type, rawId: bytesToBase64Url(new Uint8Array(credential.rawId)), response: { clientDataJSON: bytesToBase64Url(new Uint8Array(response.clientDataJSON)), attestationObject: bytesToBase64Url(new Uint8Array(response.attestationObject)), transports: response.getTransports?.() ?? [] } }
}

export function serializeAssertionCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAssertionResponse
  return { id: credential.id, type: credential.type, rawId: bytesToBase64Url(new Uint8Array(credential.rawId)), response: { clientDataJSON: bytesToBase64Url(new Uint8Array(response.clientDataJSON)), authenticatorData: bytesToBase64Url(new Uint8Array(response.authenticatorData)), signature: bytesToBase64Url(new Uint8Array(response.signature)), userHandle: response.userHandle ? bytesToBase64Url(new Uint8Array(response.userHandle)) : null } }
}

export function registrationOptionsForBrowser(options: Record<string, any>): PublicKeyCredentialCreationOptions {
  return { ...options, challenge: base64UrlToBytes(options.challenge), user: { ...options.user, id: base64UrlToBytes(options.user.id) }, excludeCredentials: (options.excludeCredentials ?? []).map((item: any) => ({ ...item, id: base64UrlToBytes(item.id) })) } as unknown as PublicKeyCredentialCreationOptions
}

export function assertionOptionsForBrowser(options: Record<string, any>): PublicKeyCredentialRequestOptions {
  return { ...options, challenge: base64UrlToBytes(options.challenge), allowCredentials: (options.allowCredentials ?? []).map((item: any) => ({ ...item, id: base64UrlToBytes(item.id) })) }
}

export function quickUnlockRegistrationCredentialOptions(options: Record<string, any>): CredentialCreationOptions {
  return { publicKey: registrationOptionsForBrowser(options) }
}

export function quickUnlockAssertionCredentialOptions(options: Record<string, any>): CredentialRequestOptions {
  return { publicKey: assertionOptionsForBrowser(options) }
}

export async function deriveQuickUnlockKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  if (prfOutput.byteLength !== 32) throw new Error("QUICK_UNLOCK_PRF_INVALID")
  return crypto.subtle.importKey("raw", prfOutput, wrapAlgorithm, false, ["wrapKey", "unwrapKey"])
}

export async function wrapVaultKeyForQuickUnlock(runtimeVaultKey: CryptoKey, prfOutput: ArrayBuffer): Promise<string> {
  const key = await deriveQuickUnlockKey(prfOutput)
  const wrapped = await crypto.subtle.wrapKey("raw", runtimeVaultKey, key, "AES-KW")
  return bytesToBase64Url(new Uint8Array(wrapped))
}

export async function unwrapVaultKeyWithQuickUnlock(wrapped: string, prfOutput: ArrayBuffer): Promise<CryptoKey> {
  try {
    const key = await deriveQuickUnlockKey(prfOutput)
    return await crypto.subtle.unwrapKey("raw", base64UrlToBytes(wrapped), key, "AES-KW", vaultKeyAlgorithm, false, ["encrypt", "decrypt"])
  } catch {
    throw new Error("QUICK_UNLOCK_UNWRAP_FAILED")
  }
}

export async function assertLocalQuickUnlockWrapProof(runtimeVaultKey: CryptoKey, prfOutput: ArrayBuffer): Promise<void> {
  const wrapped = await wrapVaultKeyForQuickUnlock(runtimeVaultKey, prfOutput)
  await unwrapVaultKeyWithQuickUnlock(wrapped, prfOutput)
}

type QuickUnlockApi = {
  getQuickUnlockRegistrationOptions: (prfInput: string) => Promise<Record<string, any>>
  completeQuickUnlockRegistration: (payload: Record<string, unknown>) => Promise<Record<string, any>>
  getQuickUnlockAssertionOptions: () => Promise<Record<string, any>>
  completeQuickUnlockAssertion: (payload: Record<string, unknown>) => Promise<Record<string, any>>
}

export async function enrollQuickUnlock(api: QuickUnlockApi, runtimeVaultKey: CryptoKey): Promise<Record<string, any>> {
  const prfInput = createPrfInput()
  const options = await api.getQuickUnlockRegistrationOptions(bytesToBase64Url(prfInput))
  const credential = await navigator.credentials.create(quickUnlockRegistrationCredentialOptions(options))
  if (!(credential instanceof PublicKeyCredential)) throw new Error("QUICK_UNLOCK_REGISTRATION_FAILED")
  const prfOutput = extractPrfResult(credential)
  const payload: Record<string, unknown> = { challenge_id: options.challenge_id, prf_input: bytesToBase64Url(prfInput), credential: serializeRegistrationCredential(credential) }
  if (prfOutput) {
    await assertLocalQuickUnlockWrapProof(runtimeVaultKey, prfOutput)
    payload.wrapped_vault_key = await wrapVaultKeyForQuickUnlock(runtimeVaultKey, prfOutput)
  }
  return api.completeQuickUnlockRegistration(payload)
}

export async function unlockWithQuickUnlock(api: QuickUnlockApi, runtimeVaultKey?: CryptoKey): Promise<CryptoKey> {
  const options = await api.getQuickUnlockAssertionOptions()
  const credential = await navigator.credentials.get(quickUnlockAssertionCredentialOptions(options))
  if (!(credential instanceof PublicKeyCredential)) throw new Error("QUICK_UNLOCK_ASSERTION_FAILED")
  const prfOutput = extractPrfResult(credential)
  if (!prfOutput) throw new Error("QUICK_UNLOCK_PRF_UNAVAILABLE")
  const assertionPayload: Record<string, unknown> = { challenge_id: options.challenge_id, credential: serializeAssertionCredential(credential) }
  if (runtimeVaultKey) assertionPayload.wrapped_vault_key = await wrapVaultKeyForQuickUnlock(runtimeVaultKey, prfOutput)
  const result = await api.completeQuickUnlockAssertion(assertionPayload)
  return unwrapVaultKeyWithQuickUnlock(result.wrapped_vault_key, prfOutput)
}
