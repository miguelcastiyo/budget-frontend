// Only opaque record identifiers are retained; never store decrypted draft fields.
const pendingCaptures = new Map<string, string>()
const storageKey = (account: string) => `budget.pending-capture-recovery.${encodeURIComponent(account)}`
export function rememberCapture(account: string, id: string) {
  pendingCaptures.set(account, id)
  try { window.sessionStorage.setItem(storageKey(account), id) } catch { /* In-memory fallback. */ }
}
export function getRememberedCapture(account: string) {
  const inMemory = pendingCaptures.get(account)
  if (inMemory) return inMemory
  try { return window.sessionStorage.getItem(storageKey(account)) } catch { return null }
}
export function clearRememberedCapture(account: string, id: string) {
  if (getRememberedCapture(account) !== id) return
  pendingCaptures.delete(account)
  try { window.sessionStorage.removeItem(storageKey(account)) } catch { /* In-memory fallback. */ }
}
