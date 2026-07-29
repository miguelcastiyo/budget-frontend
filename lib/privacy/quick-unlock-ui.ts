export function isQuickUnlockCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError" || error instanceof Error && ["NotAllowedError", "USER_CANCELLED", "QUICK_UNLOCK_CANCELLED"].includes(error.name || error.message)
}

export function quickUnlockErrorMessage(error: unknown): string {
  if (isQuickUnlockCancellation(error)) return ""
  const code = typeof error === "object" && error !== null && "error" in error && typeof (error as { error?: { code?: unknown } }).error?.code === "string" ? String((error as { error: { code: string } }).error.code) : error instanceof Error ? (error.name && error.name !== "Error" ? error.name : error.message) : ""
  if (code === "QUICK_UNLOCK_UNSUPPORTED") return "Quick Unlock isn't available on this device."
  if (code === "QUICK_UNLOCK_PRF_UNAVAILABLE" || code === "QUICK_UNLOCK_PRF_INVALID") return "This iPhone browser did not provide the security capability Quick Unlock needs. Try Safari or the installed Budget app, then use your Vault passphrase if it continues."
  if (code === "QUICK_UNLOCK_REQUIRES_PASSPHRASE_UNLOCK") return "Unlock your Vault with your passphrase once before enabling Quick Unlock on this device."
  if (code === "VAULT_PASSPHRASE_UNLOCK_REQUIRED") return "Unlock your Vault with your passphrase once before changing its recovery settings."
  if (code === "NotSupportedError" || code === "QUICK_UNLOCK_REGISTRATION_FAILED") return "This browser could not create a Quick Unlock credential. Use Safari or the installed Budget app, then try again."
  if (code === "SecurityError" || code === "OperationError" || code === "DataError") return "This browser rejected the Quick Unlock credential. Confirm you are using the production Budget address and try again."
  if (code === "WEBAUTHN_ORIGIN_INVALID" || code === "WEBAUTHN_RP_ID_INVALID" || code === "WEBAUTHN_RP_ID_NOT_CONFIGURED" || code === "WEBAUTHN_ORIGIN_NOT_CONFIGURED") return "Quick Unlock is not configured for this production address. Use your Vault passphrase and contact support."
  if (code === "WEBAUTHN_VERIFICATION_FAILED") return "This device could not complete Quick Unlock verification. Try again in Safari or use your Vault passphrase."
  if (code === "QUICK_UNLOCK_NOT_ENROLLED") return "Quick Unlock isn't set up on this device."
  if (code === "WEBAUTHN_CHALLENGE_INVALID" || code === "WEBAUTHN_CHALLENGE_EXPIRED") return "Quick Unlock timed out. Try again."
  if (code === "RECENT_AUTH_REQUIRED") return "Confirm your account to continue."
  return "Quick Unlock isn't available right now. Use your Vault passphrase instead."
}
