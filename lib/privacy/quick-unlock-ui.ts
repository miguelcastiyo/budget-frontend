export function isQuickUnlockCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError" || error instanceof Error && ["NotAllowedError", "USER_CANCELLED", "QUICK_UNLOCK_CANCELLED"].includes(error.name || error.message)
}

export function quickUnlockErrorMessage(error: unknown): string {
  if (isQuickUnlockCancellation(error)) return ""
  const code = typeof error === "object" && error !== null && "error" in error && typeof (error as { error?: { code?: unknown } }).error?.code === "string" ? String((error as { error: { code: string } }).error.code) : error instanceof Error ? error.message : ""
  if (code === "QUICK_UNLOCK_UNSUPPORTED") return "Quick Unlock isn't available on this device."
  if (code === "QUICK_UNLOCK_NOT_ENROLLED") return "Quick Unlock isn't set up on this device."
  if (code === "WEBAUTHN_CHALLENGE_INVALID" || code === "WEBAUTHN_CHALLENGE_EXPIRED") return "Quick Unlock timed out. Try again."
  if (code === "RECENT_AUTH_REQUIRED") return "Confirm your account to continue."
  return "Quick Unlock isn't available right now. Use your Vault passphrase instead."
}
