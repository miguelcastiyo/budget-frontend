/** A rollout control only; the opaque backend remains the security boundary. */
export function pendingCapabilitiesForAccount(accountId: string, config: { captureEnabled?: string; recoveryEnabled?: string; accountIds?: string }) {
  const allowed = new Set((config.accountIds ?? "").split(",").map((id) => id.trim()).filter(Boolean))
  return { capture: config.captureEnabled === "1" && allowed.has(accountId), recovery: config.recoveryEnabled === "1" }
}
